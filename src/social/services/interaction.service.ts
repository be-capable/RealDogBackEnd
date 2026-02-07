import { Injectable, ConflictException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from './notification.service';
import { NotificationType } from '../enums/notification-type.enum';
import { I18nService } from '../../i18n/i18n.service';

@Injectable()
export class InteractionService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private i18nService: I18nService,
  ) {}

  async like(userId: number, targetId: number, targetType: 'post' | 'comment', lang: string = 'en') {
    const existingLike = await this.prisma.like.findFirst({
      where: {
        userId,
        targetId,
        targetType,
      },
    });

    if (existingLike) {
      return { message: this.i18nService.t('Already liked', lang), liked: true, like: existingLike };
    }

    // 在创建like之前验证目标是否存在
    if (targetType === 'post') {
      const post = await this.prisma.socialPost.findUnique({
        where: { id: targetId },
      });
      if (!post) {
        throw new NotFoundException(this.i18nService.t('Post not found', lang));
      }
    } else if (targetType === 'comment') {
      const comment = await this.prisma.comment.findUnique({
        where: { id: targetId },
      });
      if (!comment) {
        throw new NotFoundException(this.i18nService.t('Comment not found', lang));
      }
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
          content: this.i18nService.t('用户点赞了你的动态', lang),
        }, lang);
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
          content: this.i18nService.t('用户点赞了你的评论', lang),
        }, lang);
      }
    }

    return { message: this.i18nService.t('Liked successfully', lang), liked: true, like };
  }

  async unlike(userId: number, likeId: number, lang: string = 'en') {
    const like = await this.prisma.like.findUnique({
      where: { id: likeId },
    });

    if (!like) {
      throw new NotFoundException(this.i18nService.t('Like not found', lang));
    }

    if (like.userId !== userId) {
      throw new ForbiddenException(this.i18nService.t('Permission denied', lang));
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

    return { message: this.i18nService.t('Unliked successfully', lang), liked: false };
  }

  async getPostLikers(postId: number, lang: string = 'en') {
    const likes = await this.prisma.like.findMany({
      where: {
        targetId: postId,
        targetType: 'post'
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return likes.map(like => ({
      id: like.User.id,
      name: like.User.name,
      email: like.User.email,
      avatar: like.User.avatar,
      likedAt: like.createdAt
    }));
  }

  async share(userId: number, postId: number, lang: string = 'en') {
    // 验证帖子是否存在
    const post = await this.prisma.socialPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException(this.i18nService.t('Post not found', lang));
    }

    // 检查是否已经分享过这个帖子（使用Like表存储分享记录）
    const existingShare = await this.prisma.like.findFirst({
      where: {
        userId,
        targetId: postId,
        targetType: 'share'
      },
    });

    if (existingShare) {
      throw new ConflictException(this.i18nService.t('Already shared this post', lang));
    }

    // 创建分享记录（使用Like表）
    const shareRecord = await this.prisma.like.create({
      data: {
        userId,
        targetId: postId,
        targetType: 'share',
      },
    });

    // 增加原始帖子的分享计数
    await this.prisma.socialPost.update({
      where: { id: postId },
      data: {
        sharesCount: { increment: 1 },
      },
    });

    // 通知原作者
    if (post.userId !== userId) {
      await this.notificationService.createNotification({
        userId: post.userId,
        senderId: userId,
        type: 'SHARE' as any,
        content: this.i18nService.t('用户分享了你的动态', lang),
      }, lang);
    }

    return { 
      message: this.i18nService.t('Shared successfully', lang), 
      shared: true, 
      shareId: shareRecord.id 
    };
  }

  async unshare(userId: number, shareId: number, lang: string = 'en') {
    const shareRecord = await this.prisma.like.findUnique({
      where: { id: shareId },
    });

    if (!shareRecord) {
      throw new NotFoundException(this.i18nService.t('Share not found', lang));
    }

    if (shareRecord.userId !== userId || shareRecord.targetType !== 'share') {
      throw new ForbiddenException(this.i18nService.t('Permission denied', lang));
    }

    const deletedShare = await this.prisma.like.delete({
      where: { id: shareId },
    });

    // 减少原始帖子的分享计数
    await this.prisma.socialPost.update({
      where: { id: shareRecord.targetId },
      data: {
        sharesCount: { decrement: 1 },
      },
    });

    return { message: this.i18nService.t('Unshared successfully', lang), shared: false };
  }

  async getPostSharers(postId: number, lang: string = 'en') {
    const shares = await this.prisma.like.findMany({
      where: {
        targetId: postId,
        targetType: 'share'
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return shares.map(share => ({
      id: share.User.id,
      name: share.User.name,
      email: share.User.email,
      avatar: share.User.avatar,
      sharedAt: share.createdAt
    }));
  }

  async comment(userId: number, postId: number, content: string, parentId?: number, lang: string = 'en') {
    const post = await this.prisma.socialPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException(this.i18nService.t('Post not found', lang));
    }

    if (parentId) {
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: parentId },
      });

      if (!parentComment || parentComment.postId !== postId) {
        throw new NotFoundException(this.i18nService.t('Parent comment not found', lang));
      }
    }

    if (!content || content.trim().length === 0) {
      throw new BadRequestException(this.i18nService.t('Comment content cannot be empty', lang));
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
            other_Comment: true,
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
        content: this.i18nService.t('用户评论了你的动态', lang),
      }, lang);
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
          content: this.i18nService.t('用户回复了你的评论', lang),
        }, lang);
      }
    }

    return comment;
  }

  async getComments(postId: number, page: number = 1, limit: number = 10, lang: string = 'en') {
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
                other_Comment: true,
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

  async deleteComment(commentId: number, userId: number, lang: string = 'en') {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        SocialPost: true,
      },
    });

    if (!comment) {
      throw new NotFoundException(this.i18nService.t('Comment not found', lang));
    }

    if (comment.userId !== userId && comment.SocialPost.userId !== userId) {
      throw new ForbiddenException(this.i18nService.t('Permission denied', lang));
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

    return { success: true, message: this.i18nService.t('Comment deleted successfully', lang) };
  }
}