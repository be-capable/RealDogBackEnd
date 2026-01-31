import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeaders, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AtGuard } from '../auth/common/guards/at.guard';
import { GetCurrentUserId } from '../auth/common/decorators/get-current-user-id.decorator';
import { DogEventsService } from './dog-events.service';
import { CreateDogEventDto } from './dto/create-dog-event.dto';
import { ListDogEventsQuery } from './dto/list-dog-events.query';
import { APP_HEADERS } from '../common/swagger/app-headers';

@ApiTags('Events')
@ApiHeaders(APP_HEADERS)
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller('pets/:petId/events')
export class PetEventsController {
  constructor(private readonly dogEventsService: DogEventsService) {}

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
