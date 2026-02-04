import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeaders, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AtGuard } from '../auth/common/guards/at.guard';
import { GetCurrentUserId } from '../auth/common/decorators/get-current-user-id.decorator';
import { DogEventsService } from './dog-events.service';
import { APP_HEADERS } from '../common/swagger/app-headers';

/**
 * Events Controller - 单个事件查询接口
 *
 * 认证方式: Bearer Token (Access Token)
 * 公共请求头: 参见 APP_HEADERS
 */
@ApiTags('Events')
@ApiHeaders(APP_HEADERS)
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly dogEventsService: DogEventsService) {}

  /**
   * 获取单个事件详情
   *
   * @param userId - 从Token中提取的用户ID
   * @param eventId - 事件ID (Path)
   * @returns 事件详情 (包含宠物信息)
   * @throws NotFoundException - 事件不存在或无权限
   */
  @Get(':eventId')
  @ApiOperation({ summary: 'Get Event', description: 'Retrieve detailed information for a specific event.' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  get(
    @GetCurrentUserId() userId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ) {
    return this.dogEventsService.getById(userId, eventId);
  }
}
