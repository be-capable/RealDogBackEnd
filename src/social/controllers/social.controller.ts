import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AtGuard } from '../../auth/common/guards/at.guard';
import { SocialPostService } from '../services/social-post.service';
import { InteractionService } from '../services/interaction.service';
import { RelationshipService } from '../services/relationship.service';
import { NotificationService } from '../services/notification.service';
import { CreatePostDto } from '../dto/create-post.dto';
import { UpdatePostDto } from '../dto/update-post.dto';
import { FeedOptions } from '../interfaces/feed-options.interface';

@ApiTags('Social')
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller('social')
export class SocialController {
  constructor(
    private socialPostService: SocialPostService,
    private interactionService: InteractionService,
    private relationshipService: RelationshipService,
    private notificationService: NotificationService,
  ) {}

  // 动态相关接口

  @Post('posts')
  @ApiOperation({ summary: '发布动态' })
  @ApiResponse({ status: 201, description: '动态发布成功' })
  async createPost(@Req() req, @Body() createPostDto: CreatePostDto) {
    return this.socialPostService.createPost(req.user.userId, createPostDto);
  }

  @Get('posts')
  @ApiOperation({ summary: '获取信息流' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  @ApiQuery({ name: 'sort', required: false, description: '排序方式' })
  @ApiQuery({ name: 'type', required: false, description: '动态类型' })
  @ApiQuery({ name: 'tag', required: false, description: '标签' })
  async getFeed(@Req() req, @Query() query: FeedOptions) {
    return this.socialPostService.getFeed(req.user.userId, query);
  }

  @Get('posts/:id')
  @ApiOperation({ summary: '获取动态详情' })
  @ApiParam({ name: 'id', description: '动态ID' })
  async getPost(@Req() req, @Param('id') id: string) {
    return this.socialPostService.getPostById(+id, req.user.userId);
  }

  @Put('posts/:id')
  @ApiOperation({ summary: '更新动态' })
  @ApiParam({ name: 'id', description: '动态ID' })
  async updatePost(
    @Req() req,
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
  ) {
    return this.socialPostService.updatePost(+id, req.user.userId, updatePostDto);
  }

  @Delete('posts/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除动态' })
  @ApiParam({ name: 'id', description: '动态ID' })
  async deletePost(@Req() req, @Param('id') id: string) {
    return this.socialPostService.deletePost(+id, req.user.userId);
  }

  // 互动相关接口

  @Post('likes')
  @ApiOperation({ summary: '点赞' })
  @ApiResponse({ status: 201, description: '点赞成功' })
  async like(
    @Req() req,
    @Body() body: { targetId: number; targetType: 'post' | 'comment' },
  ) {
    return this.interactionService.like(req.user.userId, body.targetId, body.targetType);
  }

  @Delete('likes/:id')
  @ApiOperation({ summary: '取消点赞' })
  @ApiParam({ name: 'id', description: '点赞ID' })
  async unlike(@Req() req, @Param('id') id: string) {
    return this.interactionService.unlike(req.user.userId, +id);
  }

  @Post('comments')
  @ApiOperation({ summary: '发表评论' })
  @ApiResponse({ status: 201, description: '评论成功' })
  async comment(
    @Req() req,
    @Body() body: { postId: number; content: string; parentId?: number },
  ) {
    return this.interactionService.comment(
      req.user.userId,
      body.postId,
      body.content,
      body.parentId,
    );
  }

  @Get('comments')
  @ApiOperation({ summary: '获取评论列表' })
  @ApiQuery({ name: 'postId', description: '动态ID' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  async getComments(
    @Req() req,
    @Query('postId') postId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.interactionService.getComments(+postId, parseInt(page), parseInt(limit));
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除评论' })
  @ApiParam({ name: 'id', description: '评论ID' })
  async deleteComment(@Req() req, @Param('id') id: string) {
    return this.interactionService.deleteComment(+id, req.user.userId);
  }

  // 关系相关接口

  @Post('follow/:userId')
  @ApiOperation({ summary: '关注用户' })
  @ApiParam({ name: 'userId', description: '被关注用户ID' })
  async follow(@Req() req, @Param('userId') userId: string) {
    return this.relationshipService.follow(req.user.userId, +userId);
  }

  @Delete('follow/:userId')
  @ApiOperation({ summary: '取消关注' })
  @ApiParam({ name: 'userId', description: '被取消关注用户ID' })
  async unfollow(@Req() req, @Param('userId') userId: string) {
    return this.relationshipService.unfollow(req.user.userId, +userId);
  }

  @Get('followers')
  @ApiOperation({ summary: '获取粉丝列表' })
  @ApiQuery({ name: 'userId', description: '用户ID' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  async getFollowers(
    @Req() req,
    @Query('userId') userId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.relationshipService.getFollowers(+userId || req.user.userId, parseInt(page), parseInt(limit));
  }

  @Get('following')
  @ApiOperation({ summary: '获取关注列表' })
  @ApiQuery({ name: 'userId', required: false, description: '用户ID' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  async getFollowing(
    @Req() req,
    @Query('userId') userId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.relationshipService.getFollowing(+userId || req.user.userId, parseInt(page), parseInt(limit));
  }

  @Get('follow-status/:userId')
  @ApiOperation({ summary: '获取关注状态' })
  @ApiParam({ name: 'userId', description: '目标用户ID' })
  async getFollowStatus(@Req() req, @Param('userId') userId: string) {
    return this.relationshipService.getFollowStatus(req.user.userId, +userId);
  }

  @Get('suggestions')
  @ApiOperation({ summary: '获取推荐关注用户' })
  @ApiQuery({ name: 'limit', required: false, description: '推荐数量' })
  async getSuggestions(
    @Req() req,
    @Query('limit') limit: string = '10',
  ) {
    return this.relationshipService.getSuggestions(req.user.userId, parseInt(limit));
  }

  // 通知相关接口

  @Get('notifications')
  @ApiOperation({ summary: '获取通知列表' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  @ApiQuery({ name: 'type', required: false, description: '通知类型' })
  async getNotifications(
    @Req() req,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('type') type?: string,
  ) {
    return this.notificationService.getUserNotifications(
      req.user.userId,
      parseInt(page),
      parseInt(limit),
      type,
    );
  }

  @Put('notifications/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '标记通知为已读' })
  @ApiParam({ name: 'id', description: '通知ID' })
  async markAsRead(@Req() req, @Param('id') id: string) {
    return this.notificationService.markAsRead(+id, req.user.userId);
  }

  @Put('notifications/read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '标记所有通知为已读' })
  async markAllAsRead(@Req() req) {
    return this.notificationService.markAllAsRead(req.user.userId);
  }

  @Get('notifications/unread-count')
  @ApiOperation({ summary: '获取未读通知数量' })
  async getUnreadCount(@Req() req) {
    return this.notificationService.getUnreadCount(req.user.userId);
  }
}