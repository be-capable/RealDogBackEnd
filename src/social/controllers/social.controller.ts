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
import { UserService } from '../../../src/user/user.service';
import { PetsService } from '../../../src/pets/pets.service';
import { CreatePostDto } from '../dto/create-post.dto';
import { UpdatePostDto } from '../dto/update-post.dto';
import { FeedOptions } from '../interfaces/feed-options.interface';
import { Request } from 'express';

interface AuthenticatedUser {
  userId: number;
  email: string;
}

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
    private userService: UserService,
    private petsService: PetsService,
  ) {}

  // 动态相关接口

  @Post('posts')
  @ApiOperation({ summary: '发布动态' })
  @ApiResponse({ status: 201, description: '动态发布成功' })
  async createPost(@Req() req: Request & { user: AuthenticatedUser } & { user: AuthenticatedUser }, @Body() createPostDto: CreatePostDto) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.socialPostService.createPost(req.user.userId, createPostDto, lang);
  }

  @Get('posts')
  @ApiOperation({ summary: '获取信息流' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  @ApiQuery({ name: 'sort', required: false, description: '排序方式' })
  @ApiQuery({ name: 'type', required: false, description: '动态类型' })
  @ApiQuery({ name: 'tag', required: false, description: '标签' })
  async getFeed(@Req() req: Request & { user: AuthenticatedUser } & { user: AuthenticatedUser }, @Query() query: FeedOptions) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.socialPostService.getFeed(req.user.userId, query, lang);
  }

  @Get('posts/:id')
  @ApiOperation({ summary: '获取动态详情' })
  @ApiParam({ name: 'id', description: '动态ID' })
  async getPost(@Req() req: Request & { user: AuthenticatedUser }, @Param('id') id: string) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.socialPostService.getPostById(+id, req.user.userId, lang);
  }

  @Put('posts/:id')
  @ApiOperation({ summary: '更新动态' })
  @ApiParam({ name: 'id', description: '动态ID' })
  async updatePost(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
  ) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.socialPostService.updatePost(+id, req.user.userId, updatePostDto, lang);
  }

  @Delete('posts/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除动态' })
  @ApiParam({ name: 'id', description: '动态ID' })
  async deletePost(@Req() req: Request & { user: AuthenticatedUser }, @Param('id') id: string) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.socialPostService.deletePost(+id, req.user.userId, lang);
  }

  // 互动相关接口

  @Post('likes')
  @ApiOperation({ summary: '点赞' })
  @ApiResponse({ status: 201, description: '点赞成功' })
  async like(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() body: { targetId: number; targetType: 'post' | 'comment' },
  ) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.interactionService.like(req.user.userId, body.targetId, body.targetType, lang);
  }

  @Delete('likes/:id')
  @ApiOperation({ summary: '取消点赞' })
  @ApiParam({ name: 'id', description: '点赞ID' })
  async unlike(@Req() req: Request & { user: AuthenticatedUser }, @Param('id') id: string) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.interactionService.unlike(req.user.userId, +id, lang);
  }

  @Post('comments')
  @ApiOperation({ summary: '发表评论' })
  @ApiResponse({ status: 201, description: '评论成功' })
  async comment(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() body: { postId: number; content: string; parentId?: number },
  ) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.interactionService.comment(
      req.user.userId,
      body.postId,
      body.content,
      body.parentId,
      lang,
    );
  }

  @Get('comments')
  @ApiOperation({ summary: '获取评论列表' })
  @ApiQuery({ name: 'postId', description: '动态ID' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  async getComments(
    @Req() req: Request & { user: AuthenticatedUser },
    @Query('postId') postId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.interactionService.getComments(+postId, parseInt(page), parseInt(limit), lang);
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除评论' })
  @ApiParam({ name: 'id', description: '评论ID' })
  async deleteComment(@Req() req: Request & { user: AuthenticatedUser }, @Param('id') id: string) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.interactionService.deleteComment(+id, req.user.userId, lang);
  }

  // 关系相关接口

  @Post('follow/:userId')
  @ApiOperation({ summary: '关注用户' })
  @ApiParam({ name: 'userId', description: '被关注用户ID' })
  async follow(@Req() req: Request & { user: AuthenticatedUser }, @Param('userId') userId: string) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.relationshipService.follow(req.user.userId, +userId, lang);
  }

  @Delete('follow/:userId')
  @ApiOperation({ summary: '取消关注' })
  @ApiParam({ name: 'userId', description: '被取消关注用户ID' })
  async unfollow(@Req() req: Request & { user: AuthenticatedUser }, @Param('userId') userId: string) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.relationshipService.unfollow(req.user.userId, +userId, lang);
  }

  @Get('followers')
  @ApiOperation({ summary: '获取粉丝列表' })
  @ApiQuery({ name: 'userId', description: '用户ID' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  async getFollowers(
    @Req() req: Request & { user: AuthenticatedUser },
    @Query('userId') userId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.relationshipService.getFollowers(+userId || req.user.userId, parseInt(page), parseInt(limit), lang);
  }

  @Get('following')
  @ApiOperation({ summary: '获取关注列表' })
  @ApiQuery({ name: 'userId', required: false, description: '用户ID' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  async getFollowing(
    @Req() req: Request & { user: AuthenticatedUser },
    @Query('userId') userId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.relationshipService.getFollowing(+userId || req.user.userId, parseInt(page), parseInt(limit), lang);
  }

  @Get('follow-status/:userId')
  @ApiOperation({ summary: '获取关注状态' })
  @ApiParam({ name: 'userId', description: '目标用户ID' })
  async getFollowStatus(@Req() req: Request & { user: AuthenticatedUser }, @Param('userId') userId: string) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.relationshipService.getFollowStatus(req.user.userId, +userId, lang);
  }

  @Get('suggestions')
  @ApiOperation({ summary: '获取推荐关注用户' })
  @ApiQuery({ name: 'limit', required: false, description: '推荐数量' })
  async getSuggestions(
    @Req() req: Request & { user: AuthenticatedUser },
    @Query('limit') limit: string = '10',
  ) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.relationshipService.getSuggestions(req.user.userId, parseInt(limit), lang);
  }

  // 通知相关接口

  @Get('notifications')
  @ApiOperation({ summary: '获取通知列表' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  @ApiQuery({ name: 'type', required: false, description: '通知类型' })
  async getNotifications(
    @Req() req: Request & { user: AuthenticatedUser },
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('type') type?: string,
  ) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.notificationService.getUserNotifications(
      req.user.userId,
      parseInt(page),
      parseInt(limit),
      type,
      lang,
    );
  }

  @Put('notifications/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '标记通知为已读' })
  @ApiParam({ name: 'id', description: '通知ID' })
  async markAsRead(@Req() req: Request & { user: AuthenticatedUser }, @Param('id') id: string) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.notificationService.markAsRead(+id, req.user.userId, lang);
  }

  @Put('notifications/read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '标记所有通知为已读' })
  async markAllAsRead(@Req() req: Request & { user: AuthenticatedUser }) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.notificationService.markAllAsRead(req.user.userId, lang);
  }

  @Get('notifications/unread-count')
  @ApiOperation({ summary: '获取未读通知数量' })
  async getUnreadCount(@Req() req: Request & { user: AuthenticatedUser }) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.notificationService.getUnreadCount(req.user.userId, lang);
  }

  @Get('profile/:userId')
  @ApiOperation({ summary: '获取用户个人资料' })
  async getUserProfile(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('userId') userId: number,
  ) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    const user = await this.userService.findById(userId, lang);
    const pets = await this.petsService.findByOwnerId(userId);
    
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        joinDate: user.createdAt,
      },
      pets: pets.map(pet => ({
        id: pet.id,
        name: pet.name,
        species: pet.species,
        breedId: pet.breedId,
        breedName: pet.breedName,
        bio: pet.bio,
        avatar: pet.avatarMediaId,
        age: this.calculateAge(pet.birthDate),
      }))
    };
  }

  @Get('likes/users/:postId')
  @ApiOperation({ summary: '获取点赞用户列表' })
  async getPostLikers(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('postId') postId: number,
  ) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.interactionService.getPostLikers(postId, lang);
  }

  @Post('shares')
  @ApiOperation({ summary: '分享动态' })
  @ApiResponse({ status: 201, description: '分享成功' })
  async share(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() body: { postId: number },
  ) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.interactionService.share(req.user.userId, body.postId, lang);
  }

  @Delete('shares/:id')
  @ApiOperation({ summary: '取消分享' })
  @ApiParam({ name: 'id', description: '分享ID' })
  async unshare(@Req() req: Request & { user: AuthenticatedUser }, @Param('id') id: string) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.interactionService.unshare(req.user.userId, +id, lang);
  }

  @Get('shares/users/:postId')
  @ApiOperation({ summary: '获取分享用户列表' })
  async getPostSharers(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('postId') postId: number,
  ) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.interactionService.getPostSharers(postId, lang);
  }

  @Get('trending/tags')
  @ApiOperation({ summary: '获取热门标签' })
  async getTrendingTags(@Req() req: Request & { user: AuthenticatedUser }) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.socialPostService.getTrendingTags();
  }

  @Get('search')
  @ApiOperation({ summary: '搜索动态/用户/标签' })
  @ApiQuery({ name: 'q', required: true, description: '搜索关键词' })
  @ApiQuery({ name: 'type', required: false, description: '搜索类型' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  async search(
    @Req() req: Request & { user: AuthenticatedUser },
    @Query('q') query: string,
    @Query('type') type: 'posts' | 'users' | 'tags' = 'posts',
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    
    switch(type) {
      case 'posts':
        return this.socialPostService.searchPosts(query, page, limit, lang);
      case 'users':
        return this.userService.searchUsers(query, page, limit, lang);
      case 'tags':
        return this.socialPostService.searchTags(query, lang);
    }
  }

  private calculateAge(birthDate: Date): number {
    const today = new Date();
    const birth = new Date(birthDate);
    const age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      return age - 1;
    }
    return age;
  }
}