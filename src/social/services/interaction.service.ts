import { Injectable, ConflictException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from './notification.service';
import { NotificationType } from '../enums/notification-type.enum';

@Injectable()
export class InteractionService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async like(userId: number, targetId: number, targetType: 'post' | 'comment') {
    const existingLike = await this.prisma.like.findFirst({
      where: {
        userId,
        targetId,
        targetType,
      },
    });

    if (existingLike) {
      return { message: 'Already liked', liked: true, like: existingLike };
    }

    const like = await this.prisma.like.create({
      data: {
        userId,
        targetId,
        targetType,
      },
    });

    if (targetType === 'post') {
      await this.prisma.socialPost.update({
        where: { id: targetId },
        data: {
          likesCount: { increment: 1 },
        },
      });

      const post = await this.prisma.socialPost.findUnique({
        where: { id: targetId },
        select: { userId: true },
      });

      if (post && post.userId !== userId) {
        await this.notificationService.createNotification({
          userId: post.userId,
          senderId: userId,
          type: NotificationType.LIKE as any,
          content: `用户点赞了你的动态`,
        });
      }
    } else if (targetType === 'comment') {
      await this.prisma.comment.update({
        where: { id: targetId },
        data: {
          likesCount: { increment: 1 },
        },
      });

      const comment = await this.prisma.comment.findUnique({
        where: { id: targetId },
        select: { userId: true },
      });

      if (comment && comment.userId !== userId) {
        await this.notificationService.createNotification({
          userId: comment.userId,
          senderId: userId,
          type: NotificationType.LIKE as any,
          content: `用户点赞了你的评论`,
        });
      }
    }

    return { message: 'Liked successfully', liked: true, like };
  }

  async unlike(userId: number, likeId: number) {
    const like = await this.prisma.like.findUnique({
      where: { id: likeId },
    });

    if (!like) {
      throw new NotFoundException('Like not found');
    }

    if (like.userId !== userId) {
      throw new ForbiddenException('Permission denied');
    }

    const deletedLike = await this.prisma.like.delete({
      where: { id: likeId },
    });

    if (like.targetType === 'post') {
      await this.prisma.socialPost.update({
        where: { id: like.targetId },
        data: {
          likesCount: { decrement: 1 },
        },
      });
    } else if (like.targetType === 'comment') {
      await this.prisma.comment.update({
        where: { id: like.targetId },
        data: {
          likesCount: { decrement: 1 },
        },
      });
    }

    return { message: 'Unliked successfully', liked: false };
  }

  async comment(userId: number, postId: number, content: string, parentId?: number) {
    const post = await this.prisma.socialPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (parentId) {
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: parentId },
      });

      if (!parentComment || parentComment.postId !== postId) {
        throw new NotFoundException('Parent comment not found');
      }
    }

    if (!content || content.trim().length === 0) {
      throw new BadRequestException('Comment content cannot be empty');
    }

    const comment = await this.prisma.comment.create({
      data: {
        postId,
        userId,
        content: content.trim(),
        parentId,
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
        _count: {
          select: {
            Like: true,
          },
        },
      },
    });

    await this.prisma.socialPost.update({
      where: { id: postId },
      data: {
        commentsCount: { increment: 1 },
      },
    });

    if (post.userId !== userId) {
      await this.notificationService.createNotification({
        userId: post.userId,
        senderId: userId,
        type: NotificationType.COMMENT as any,
        content: `用户评论了你的动态`,
      });
    }

    if (parentId) {
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: parentId },
        select: { userId: true },
      });

      if (parentComment && parentComment.userId !== userId && parentComment.userId !== post.userId) {
        await this.notificationService.createNotification({
          userId: parentComment.userId,
          senderId: userId,
          type: NotificationType.COMMENT as any,
          content: `用户回复了你的评论`,
        });
      }
    }

    return comment;
  }

  async getComments(postId: number, page: number = 1, limit: number = 10) {
    const comments = await this.prisma.comment.findMany({
      where: {
        postId,
        parentId: null,
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            Like: true,
            other_Comment: true,
          },
        },
        other_Comment: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            _count: {
              select: {
                Like: true,
              },
            },
          },
          take: 10,
        },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return {
      comments,
      pagination: {
        page,
        limit,
        total: await this.prisma.comment.count({
          where: { postId, parentId: null },
        }),
        hasNext: comments.length === limit,
      },
    };
  }

  async deleteComment(commentId: number, userId: number) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        SocialPost: true,
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId !== userId && comment.SocialPost.userId !== userId) {
      throw new ForbiddenException('Permission denied');
    }

    const childComments = await this.prisma.comment.findMany({
      where: { parentId: commentId },
      select: { id: true },
    });

    if (childComments.length > 0) {
      await this.prisma.comment.deleteMany({
        where: { parentId: commentId },
      });
    }

    await this.prisma.comment.delete({
      where: { id: commentId },
    });

    const totalToDelete = 1 + childComments.length;
    await this.prisma.socialPost.update({
      where: { id: comment.postId },
      data: {
        commentsCount: {
          decrement: totalToDelete,
        },
      },
    });

    return { success: true, message: 'Comment deleted successfully' };
  }
}