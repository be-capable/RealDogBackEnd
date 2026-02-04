import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeaders, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AtGuard } from '../auth/common/guards/at.guard';
import { GetCurrentUserId } from '../auth/common/decorators/get-current-user-id.decorator';
import { DogEventsService } from './dog-events.service';
import { CreateDogEventDto } from './dto/create-dog-event.dto';
import { ListDogEventsQuery } from './dto/list-dog-events.query';
import { APP_HEADERS } from '../common/swagger/app-headers';

/**
 * Pet Events Controller - 宠物事件管理接口
 *
 * 认证方式: Bearer Token (Access Token)
 * 公共请求头: 参见 APP_HEADERS
 */
@ApiTags('Events')
@ApiHeaders(APP_HEADERS)
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller('pets/:petId/events')
export class PetEventsController {
  constructor(private readonly dogEventsService: DogEventsService) {}

  /**
   * 创建宠物事件
   *
   * @param userId - 从Token中提取的用户ID
   * @param petId - 宠物ID (Path)
   * @param dto - 事件信息
   * @returns 创建的事件详情
   * @throws NotFoundException - 宠物不存在或无权限
   * @throws BadRequestException - 数据验证失败
   */
  @Post()
  @ApiOperation({ summary: 'Create Event', description: 'Manually create a new event (log) for a pet.' })
  @ApiParam({ name: 'petId', description: 'Pet ID' })
  @ApiBody({ type: CreateDogEventDto })
  create(
    @GetCurrentUserId() userId: number,
    @Param('petId', ParseIntPipe) petId: number,
    @Body() dto: CreateDogEventDto,
  ) {
    return this.dogEventsService.create(userId, petId, dto);
  }

  /**
   * 获取宠物事件列表
   *
   * @param userId - 从Token中提取的用户ID
   * @param petId - 宠物ID (Path)
   * @param query - 分页参数 (cursor, limit)
   * @returns data: 事件列表
   * @returns nextCursor: 下一页游标 (null表示无更多数据)
   * @throws NotFoundException - 宠物不存在或无权限
   */
  @Get()
  @ApiOperation({ summary: 'List Pet Events', description: 'Retrieve event history for a specific pet.' })
  @ApiParam({ name: 'petId', description: 'Pet ID' })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: '分页游标（Query）',
    schema: { type: 'integer', minimum: 0 },
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '分页大小（Query），1~50',
    schema: { type: 'integer', minimum: 1, maximum: 50 },
  })
  list(
    @GetCurrentUserId() userId: number,
    @Param('petId', ParseIntPipe) petId: number,
    @Query() query: ListDogEventsQuery,
  ) {
    return this.dogEventsService.listByPet(userId, petId, query);
  }
}
