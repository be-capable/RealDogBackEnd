import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from './notification.service';
import { NotificationType } from '../enums/notification-type.enum';
import { I18nService } from '../../i18n/i18n.service';

@Injectable()
export class RelationshipService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private i18nService: I18nService,
  ) {}

  async follow(followerId: number, followingId: number, lang: string = 'en') {
    // 检查是否已经关注
    const existingFollow = await this.prisma.follow.findFirst({
      where: {
        followerId,
        followingId,
      },
    });

    if (existingFollow) {
      throw new ConflictException(this.i18nService.t('Already following', lang));
    }

    // 不能关注自己
    if (followerId === followingId) {
      throw new BadRequestException(this.i18nService.t('Cannot follow yourself', lang));
    }

    const follow = await this.prisma.follow.create({
      data: {
        followerId,
        followingId,
      },
      include: {
        User_Follow_followerIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        User_Follow_followingIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // 通知被关注的用户
    await this.notificationService.createNotification({
      userId: followingId,
      senderId: followerId,
      type: NotificationType.FOLLOW as any, // 修复类型错误
      content: this.i18nService.t('用户关注了你', lang),
    }, lang);

    return follow;
  }

  async unfollow(followerId: number, followingId: number, lang: string = 'en') {
    const follow = await this.prisma.follow.findFirst({
      where: {
        followerId,
        followingId,
      },
    });

    if (!follow) {
      throw new BadRequestException(this.i18nService.t('Not following', lang));
    }

    await this.prisma.follow.delete({
      where: { id: follow.id },
    });

    return { success: true, message: this.i18nService.t('Unfollowed successfully', lang) };
  }

  async getFollowers(userId: number, page: number = 1, limit: number = 10, lang: string = 'en') {
    const followers = await this.prisma.follow.findMany({
      where: { followingId: userId },
      include: {
        User_Follow_followerIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return {
      followers: followers.map(f => f.User_Follow_followerIdToUser),
      pagination: {
        page,
        limit,
        total: await this.prisma.follow.count({ where: { followingId: userId } }),
        hasNext: followers.length === limit,
      },
    };
  }

  async getFollowing(userId: number, page: number = 1, limit: number = 10, lang: string = 'en') {
    const following = await this.prisma.follow.findMany({
      where: { followerId: userId },
      include: {
        User_Follow_followingIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return {
      following: following.map(f => f.User_Follow_followingIdToUser),
      pagination: {
        page,
        limit,
        total: await this.prisma.follow.count({ where: { followerId: userId } }),
        hasNext: following.length === limit,
      },
    };
  }

  async isFollowing(followerId: number, followingId: number): Promise<boolean> {
    const follow = await this.prisma.follow.findFirst({
      where: {
        followerId,
        followingId,
      },
    });

    return !!follow;
  }

  async getFollowStatus(userId: number, targetUserId: number, lang: string = 'en') {
    const isFollowing = await this.isFollowing(userId, targetUserId);
    const isFollowedBy = await this.isFollowing(targetUserId, userId);

    return {
      isFollowing,
      isFollowedBy,
    };
  }

  async getSuggestions(userId: number, limit: number = 10, lang: string = 'en') {
    // 获取用户关注的人
    const followingIds = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    const followingIdList = followingIds.map(f => f.followingId);

    // 获取关注的人所关注的其他人
    const suggestedFollowRecords = await this.prisma.follow.findMany({
      where: {
        followerId: { in: followingIdList },
        followingId: { not: { in: [...followingIdList, userId] } }, // 排除已关注的和自己
      },
      select: { followingId: true },
      distinct: ['followingId'],
    });

    const suggestedUserIds = suggestedFollowRecords.map(f => f.followingId).slice(0, limit);

    // 获取推荐用户信息
    const suggestedUsers = await this.prisma.user.findMany({
      where: {
        id: { in: suggestedUserIds },
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    // 添加关注状态
    const usersWithStatus = await Promise.all(suggestedUsers.map(async user => {
      const isFollowing = await this.isFollowing(userId, user.id);
      return { ...user, isFollowing };
    }));

    return usersWithStatus;
  }
}