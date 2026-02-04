import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeaders, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AtGuard } from '../auth/common/guards/at.guard';
import { GetCurrentUserId } from '../auth/common/decorators/get-current-user-id.decorator';
import { HomeService } from './home.service';
import { APP_HEADERS } from '../common/swagger/app-headers';

/**
 * Home Controller - 首页数据接口
 *
 * 认证方式: Bearer Token (Access Token)
 * 公共请求头: 参见 APP_HEADERS
 *
 * 功能说明:
 * - 返回当前用户的第一只宠物信息
 * - 统计今日和近7天的事件
 * - 生成AI洞察和建议
 * - 提供快捷操作入口
 */
@ApiTags('Home')
@ApiHeaders(APP_HEADERS)
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  /**
   * 获取首页数据
   *
   * @param userId - 从Token中提取的用户ID
   * @returns currentPet: 当前宠物信息 (无宠物时为null)
   * @returns petStatus: 宠物状态 (name, avatarKey, todayEventsCount, dominantMood, moodConfidence)
   * @returns aiInsight: AI洞察 (pattern, recommendation)
   * @returns quickActions: 快捷操作列表
   * @returns recentEvents: 最近5条事件记录
   * @returns weeklyStats: 周统计 (total, byEventType)
   */
  @Get()
  @ApiOperation({ summary: 'Get Home Data', description: 'Retrieve summary data for the home screen (current pet, recent events, weekly stats, and AI insights).' })
  @ApiOkResponse({
    description: 'Home data retrieved',
    schema: {
      type: 'object',
      properties: {
        currentPet: {
          type: 'object',
          nullable: true,
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
            avatarKey: { type: 'string', nullable: true },
          },
          description: 'Current pet info (null if no pets)',
        },
        petStatus: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            avatarKey: { type: 'string', nullable: true },
            todayEventsCount: { type: 'number' },
            dominantMood: { type: 'string' },
            moodConfidence: { type: 'number' },
          },
          description: 'Current pet status and mood analysis',
        },
        aiInsight: {
          type: 'object',
          properties: {
            pattern: { type: 'string' },
            recommendation: { type: 'string' },
          },
          description: 'AI generated insights and recommendations based on weekly behavior',
        },
        quickActions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              icon: { type: 'string' },
              route: { type: 'string' },
            },
          },
          description: 'Quick action buttons for the home screen',
        },
        recentEvents: { type: 'array', items: { type: 'object' }, description: 'List of recent activities' },
        weeklyStats: { type: 'object', description: 'Weekly statistics' },
      },
    },
  })
  getHome(@GetCurrentUserId() userId: number) {
    return this.homeService.getHome(userId);
  }
}
