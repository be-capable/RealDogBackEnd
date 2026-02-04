import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePostDto } from '../dto/create-post.dto';
import { UpdatePostDto } from '../dto/update-post.dto';
import { FeedOptions } from '../interfaces/feed-options.interface';

@Injectable()
export class SocialPostService {
  constructor(private prisma: PrismaService) {}

  async createPost(userId: number, dto: CreatePostDto) {
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
            Like: true,
            Comment: true,
          },
        },
      },
    });

    return post;
  }

  async getFeed(userId: number, options: FeedOptions = {}) {
    const {
      page = 1,
      limit = 10,
      sort = 'latest',
      type = 'all',
      tag,
    } = options;

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

    const posts = await this.prisma.socialPost.findMany({
      where: whereClause,
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
            Like: true,
            Comment: true,
          },
        },
      },
      orderBy: sort === 'popular' 
        ? { likesCount: 'desc' } 
        : { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    });

    // 将JSON字符串转换回数组
    const processedPosts = posts.map(post => ({
      ...post,
      mediaUrls: JSON.parse(post.mediaUrls),
      tags: JSON.parse(post.tags),
    }));

    return {
      posts: processedPosts,
      pagination: {
        page,
        limit,
        total: await this.prisma.socialPost.count({ where: whereClause }),
        hasNext: posts.length === limit,
      },
    };
  }

  async getPostById(postId: number, userId?: number) {
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
            Like: true,
            Comment: true,
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // 检查权限
    if (post.visibility !== 'PUBLIC' && post.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // 将JSON字符串转换回数组
    return {
      ...post,
      mediaUrls: JSON.parse(post.mediaUrls),
      tags: JSON.parse(post.tags),
    };
  }

  async updatePost(postId: number, userId: number, dto: UpdatePostDto) {
    const post = await this.prisma.socialPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.userId !== userId) {
      throw new ForbiddenException('Permission denied');
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

  async deletePost(postId: number, userId: number) {
    const post = await this.prisma.socialPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // 通过userId直接比较
    if (post.userId !== userId) {
      throw new ForbiddenException('Permission denied');
    }

    await this.prisma.socialPost.delete({
      where: { id: postId },
    });

    return { success: true, message: 'Post deleted successfully' };
  }

  async incrementCount(postId: number, field: 'likesCount' | 'commentsCount' | 'sharesCount') {
    return await this.prisma.socialPost.update({
      where: { id: postId },
      data: {
        [field]: {
          increment: 1,
        },
      },
    });
  }

  async decrementCount(postId: number, field: 'likesCount' | 'commentsCount' | 'sharesCount') {
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