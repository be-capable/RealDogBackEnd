import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../src/prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  // 获取用户活跃度分析
  async getUserActivityStats(userId: number) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [postCount, likeCount, commentCount] = await Promise.all([
      this.prisma.socialPost.count({
        where: {
          userId,
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      this.prisma.like.count({
        where: {
          userId,
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      this.prisma.comment.count({
        where: {
          userId,
          createdAt: { gte: thirtyDaysAgo }
        }
      })
    ]);

    return {
      postCount,
      likeCount,
      commentCount,
      engagementRate: ((likeCount + commentCount) / Math.max(postCount, 1)) * 100
    };
  }

  // 获取内容趋势分析
  async getContentTrends() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const posts = await this.prisma.socialPost.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo }
      },
      select: {
        tags: true,
        likesCount: true,
        commentsCount: true,
        createdAt: true
      }
    });

    // 分析热门标签和趋势
    const tagFrequency: Record<string, number> = {};
    const dailyStats: Record<string, any> = {};

    posts.forEach(post => {
      const tags = JSON.parse(post.tags);
      tags.forEach((tag: string) => {
        tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
      });

      const date = post.createdAt.toISOString().split('T')[0];
      if (!dailyStats[date]) dailyStats[date] = { posts: 0, likes: 0, comments: 0 };
      dailyStats[date].posts++;
      dailyStats[date].likes += post.likesCount;
      dailyStats[date].comments += post.commentsCount;
    });

    return {
      trendingTags: Object.entries(tagFrequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([tag]) => tag),
      dailyStats
    };
  }
}