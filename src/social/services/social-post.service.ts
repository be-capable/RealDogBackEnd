import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePostDto } from '../dto/create-post.dto';
import { UpdatePostDto } from '../dto/update-post.dto';
import { FeedOptions } from '../interfaces/feed-options.interface';
import { I18nService } from '../../i18n/i18n.service';

@Injectable()
export class SocialPostService {
  constructor(
    private prisma: PrismaService,
    private i18nService: I18nService,
  ) {}

  async createPost(userId: number, dto: CreatePostDto, lang: string = 'en') {
    const post = await this.prisma.socialPost.create({
      data: {
        userId,
        petId: dto.petId,
        content: dto.content,
        mediaUrls: JSON.stringify(dto.mediaUrls || []), // 将数组转换为JSON字符串
        location: dto.location,
        tags: JSON.stringify(dto.tags || []), // 将数组转换为JSON字符串
        visibility: dto.visibility || 'PUBLIC',
        updatedAt: new Date(),
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        Pet: {
          select: {
            id: true,
            name: true,
            breedId: true,
          },
        },
        _count: {
          select: {
            Comment: true,
          },
        },
      },
    });

    return post;
  }

  async getFeed(userId: number, options: FeedOptions = {}, lang: string = 'en') {
    const {
      page = 1,
      limit = 10,
      sort = 'latest',
      type = 'all',
      tag,
    } = options;

    // 确保page和limit是数字
    const pageNum = parseInt(page as any) || 1;
    const limitNum = parseInt(limit as any) || 10;

    // 获取用户关注的用户ID列表
    const followingIds = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    }).then(follows => follows.map(f => f.followingId));

    // 查询条件
    let whereClause: any = {
      visibility: 'PUBLIC',
    };

    if (type === 'following') {
      whereClause.userId = { in: [...followingIds, userId] };
    } else if (type === 'self') {
      whereClause.userId = userId;
    }

    if (tag) {
      // 由于tags是JSON字符串，我们需要不同的查询方式
      whereClause.tags = { contains: tag };
    }

    // 一次性查询所有需要的数据，包括当前用户是否点赞
    const posts = await this.prisma.socialPost.findMany({
      where: whereClause,
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,  // 添加头像字段
          },
        },
        Pet: {
          select: {
            id: true,
            name: true,
            breedId: true,
            breedName: true, // 添加品种名称
            bio: true,       // 添加宠物简介
            avatarMediaId: true, // 添加宠物头像ID
          },
        },
        _count: {
          select: {
            Comment: true,
          },
        },
      },
      orderBy: sort === 'popular' 
        ? { likesCount: 'desc' } 
        : { createdAt: 'desc' },
      take: limitNum,
      skip: (pageNum - 1) * limitNum,
    });

    // 批量查询当前用户的点赞状态
    const postIds = posts.map(p => p.id);
    const userLikes = await this.prisma.like.findMany({
      where: {
        userId,
        targetId: { in: postIds },
        targetType: 'post'
      },
      select: { targetId: true }
    });
    const userLikedPostIds = new Set(userLikes.map(l => l.targetId));

    // 批量查询点赞数
    const postLikeCounts = await this.prisma.like.groupBy({
      by: ['targetId'],
      where: {
        targetId: { in: postIds },
        targetType: 'post'
      },
      _count: {
        targetId: true
      }
    });
    const likeCountMap = new Map(postLikeCounts.map(item => [item.targetId, item._count.targetId]));

    // 组装最终数据
    const processedPosts = posts.map(post => {
      const likeCount = likeCountMap.get(post.id) || 0;
      
      return {
        ...post,
        mediaUrls: JSON.parse(post.mediaUrls),
        tags: JSON.parse(post.tags),
        isLikedByCurrentUser: userLikedPostIds.has(post.id),
        isOwner: post.userId === userId,
        _count: {
          ...post._count,
          Like: likeCount
        }
      };
    });

    return {
      posts: processedPosts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: await this.prisma.socialPost.count({ where: whereClause }),
        hasNext: posts.length === limitNum,
      },
    };
  }

  async searchPosts(query: string, page: number = 1, limit: number = 10, lang: string = 'en') {
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

  async searchTags(query: string, lang: string = 'en') {
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

  async getTrendingTags(lang: string = 'en') {
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

  async getPostById(postId: number, userId?: number, lang: string = 'en') {
    const post = await this.prisma.socialPost.findUnique({
      where: { id: postId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        Pet: {
          select: {
            id: true,
            name: true,
            breedId: true,
          },
        },
        _count: {
          select: {
            Comment: true,
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException(this.i18nService.t('Post not found', lang));
    }

    // 检查权限
    if (post.visibility !== 'PUBLIC' && post.userId !== userId) {
      throw new ForbiddenException(this.i18nService.t('Access denied', lang));
    }

    // 由于Like关系已移除，需要单独查询点赞数
    const likeCount = await this.prisma.like.count({
      where: {
        targetId: post.id,
        targetType: 'post'
      }
    });

    // 将JSON字符串转换回数组
    return {
      ...post,
      _count: {
        ...post._count,
        Like: likeCount
      },
      mediaUrls: JSON.parse(post.mediaUrls),
      tags: JSON.parse(post.tags),
    };
  }

  async updatePost(postId: number, userId: number, dto: UpdatePostDto, lang: string = 'en') {
    const post = await this.prisma.socialPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException(this.i18nService.t('Post not found', lang));
    }

    if (post.userId !== userId) {
      throw new ForbiddenException(this.i18nService.t('Permission denied', lang));
    }

    return await this.prisma.socialPost.update({
      where: { id: postId },
      data: {
        content: dto.content,
        mediaUrls: dto.mediaUrls ? JSON.stringify(dto.mediaUrls) : undefined,
        location: dto.location,
        tags: dto.tags ? JSON.stringify(dto.tags) : undefined,
        visibility: dto.visibility,
      },
    });
  }

  async deletePost(postId: number, userId: number, lang: string = 'en') {
    const post = await this.prisma.socialPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException(this.i18nService.t('Post not found', lang));
    }

    // 通过userId直接比较
    if (post.userId !== userId) {
      throw new ForbiddenException(this.i18nService.t('Permission denied', lang));
    }

    await this.prisma.socialPost.delete({
      where: { id: postId },
    });

    return { success: true, message: this.i18nService.t('Post deleted successfully', lang) };
  }

  async incrementCount(postId: number, field: 'likesCount' | 'commentsCount' | 'sharesCount', lang: string = 'en') {
    return await this.prisma.socialPost.update({
      where: { id: postId },
      data: {
        [field]: {
          increment: 1,
        },
      },
    });
  }

  async decrementCount(postId: number, field: 'likesCount' | 'commentsCount' | 'sharesCount', lang: string = 'en') {
    return await this.prisma.socialPost.update({
      where: { id: postId },
      data: {
        [field]: {
          decrement: 1,
        },
      },
    });
  }
}