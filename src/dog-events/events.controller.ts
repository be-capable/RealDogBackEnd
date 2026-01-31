import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeaders, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AtGuard } from '../auth/common/guards/at.guard';
import { GetCurrentUserId } from '../auth/common/decorators/get-current-user-id.decorator';
import { DogEventsService } from './dog-events.service';
import { APP_HEADERS } from '../common/swagger/app-headers';

@ApiTags('Events')
@ApiHeaders(APP_HEADERS)
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly dogEventsService: DogEventsService) {}

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
