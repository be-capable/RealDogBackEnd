import { Controller, Get } from '@nestjs/common';
import { ApiHeaders, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { APP_HEADERS } from './common/swagger/app-headers';

@ApiTags('System')
@ApiHeaders(APP_HEADERS)
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Health Check', description: 'Returns a simple greeting to verify the service is running.' })
  getHello(): string {
    return this.appService.getHello();
  }
}
