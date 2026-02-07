import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../src/prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async searchPosts(query: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    
    const posts = await this.prisma.socialPost.findMany({
      where: {
        OR: [
          { content: { contains: query } },
          { tags: { contains: query } },
        ],
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        Pet: {
          select: {
            id: true,
            name: true,
            breedId: true,
            breedName: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const total = await this.prisma.socialPost.count({
      where: {
        OR: [
          { content: { contains: query } },
          { tags: { contains: query } },
        ],
      },
    });

    return {
      items: posts.map(post => ({
        ...post,
        mediaUrls: JSON.parse(post.mediaUrls),
        tags: JSON.parse(post.tags),
      })),
      pagination: {
        page,
        limit,
        total,
        hasNext: skip + posts.length < total,
      },
    };
  }

  async searchUsers(query: string, page: number = 1, limit: number = 10) {
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

  async searchTags(query: string) {
    // 从所有帖子的标签中搜索
    const posts = await this.prisma.socialPost.findMany({
      where: {
        tags: { contains: query },
      },
      select: {
        tags: true,
      },
    });

    // 提取所有标签并统计频率
    const allTags: Record<string, number> = {};
    
    posts.forEach(post => {
      const parsedTags = JSON.parse(post.tags);
      if (Array.isArray(parsedTags)) {
        parsedTags.forEach((tag: string) => {
          if (tag.toLowerCase().includes(query.toLowerCase())) {
            allTags[tag] = (allTags[tag] || 0) + 1;
          }
        });
      }
    });

    // 按频率排序
    const sortedTags = Object.entries(allTags)
      .sort(([,a], [,b]) => b - a)
      .map(([tag]) => ({ tag, frequency: allTags[tag] }));

    return sortedTags.slice(0, 10); // 返回前10个
  }

  async getTrendingTags() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const posts = await this.prisma.socialPost.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        tags: true,
        likesCount: true,
        commentsCount: true,
      },
    });

    // 统计标签出现频率
    const tagFrequency: Record<string, number> = {};

    posts.forEach(post => {
      const parsedTags = JSON.parse(post.tags);
      if (Array.isArray(parsedTags)) {
        parsedTags.forEach((tag: string) => {
          tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
        });
      }
    });

    // 按频率排序
    const sortedTags = Object.entries(tagFrequency)
      .sort(([,a], [,b]) => b - a)
      .map(([tag]) => ({ tag, frequency: tagFrequency[tag] }));

    return sortedTags.slice(0, 10); // 返回前10个热门标签
  }
}