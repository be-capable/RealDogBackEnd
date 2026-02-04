import { Controller, Get } from '@nestjs/common';
import { ApiHeaders, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { APP_HEADERS } from './common/swagger/app-headers';

/**
 * App Controller - 系统接口
 *
 * 认证方式: 无需认证
 * 公共请求头: 参见 APP_HEADERS
 */
@ApiTags('System')
@ApiHeaders(APP_HEADERS)
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * 健康检查
   *
   * @returns 服务状态消息
   */
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
