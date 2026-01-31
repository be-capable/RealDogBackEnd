import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeaders, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AtGuard } from '../auth/common/guards/at.guard';
import { GetCurrentUserId } from '../auth/common/decorators/get-current-user-id.decorator';
import { HomeService } from './home.service';
import { APP_HEADERS } from '../common/swagger/app-headers';

@ApiTags('Home')
@ApiHeaders(APP_HEADERS)
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get()
  @ApiOperation({ summary: 'Get Home Data', description: 'Retrieve summary data for the home screen (current pet, recent events, etc).' })
  @ApiOkResponse({
    description: 'Home data retrieved',
    schema: {
      type: 'object',
      properties: {
        currentPet: { oneOf: [{ type: 'object' }, { type: 'null' }], description: 'Active pet details' },
        recentEvents: { type: 'array', items: { type: 'object' }, description: 'List of recent activities' },
        weeklySummary: { type: 'object', description: 'Weekly statistics' },
      },
    },
  })
  getHome(@GetCurrentUserId() userId: number) {
    return this.homeService.getHome(userId);
  }
}
