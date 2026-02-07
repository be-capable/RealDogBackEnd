import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { I18nService } from '../i18n/i18n.service';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private i18nService: I18nService,
  ) {}

  async findById(id: number, lang: string = 'en') {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(this.i18nService.t('User not found', lang));
    }

    return user;
  }

  async searchUsers(query: string, page: number = 1, limit: number = 10, lang: string = 'en') {
    const skip = (page - 1) * limit;
    
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { email: { contains: query } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        bio: true,
        createdAt: true,
      },
      skip,
      take: limit,
    });

    const total = await this.prisma.user.count({
      where: {
        OR: [
          { name: { contains: query } },
          { email: { contains: query } },
        ],
      },
    });

    return {
      items: users,
      pagination: {
        page,
        limit,
        total,
        hasNext: skip + users.length < total,
      },
    };
  }
}