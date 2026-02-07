import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationGateway } from '../gateways/notification.gateway';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { I18nService } from '../../i18n/i18n.service';

@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    private notificationGateway: NotificationGateway,
    private i18nService: I18nService,
  ) {}

  async createNotification(dto: CreateNotificationDto, lang: string = 'en') {
    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        senderId: dto.senderId,
        type: dto.type,
        content: dto.content,
        updatedAt: new Date(),
      },
      include: {
        User_Notification_senderIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // 通过WebSocket实时推送给用户
    this.notificationGateway.sendNotification(dto.userId, notification);

    return notification;
  }

  async getUserNotifications(userId: number, page: number = 1, limit: number = 10, type?: string, lang: string = 'en') {
    const whereClause: any = { userId };
    
    if (type) {
      whereClause.type = type;
    }

    const notifications = await this.prisma.notification.findMany({
      where: whereClause,
      include: {
        User_Notification_senderIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return {
      notifications,
      pagination: {
        page,
        limit,
        total: await this.prisma.notification.count({ where: whereClause }),
        hasNext: notifications.length === limit,
      },
    };
  }

  async markAsRead(notificationId: number, userId: number, lang: string = 'en') {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException(this.i18nService.t('Notification not found', lang));
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException(this.i18nService.t('Permission denied', lang));
    }

    return await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: number, lang: string = 'en') {
    return await this.prisma.notification.updateMany({
      where: { 
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });
  }

  async getUnreadCount(userId: number, lang: string = 'en') {
    return await this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  async deleteNotification(notificationId: number, userId: number, lang: string = 'en') {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException(this.i18nService.t('Notification not found', lang));
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException(this.i18nService.t('Permission denied', lang));
    }

    return await this.prisma.notification.delete({
      where: { id: notificationId },
    });
  }

  async cleanupOldNotifications(days: number = 30, lang: string = 'en') {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return await this.prisma.notification.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });
  }
}