import { Controller, Get, Query } from '@nestjs/common';
import { ApiHeaders, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DictsService } from './dicts.service';
import { ListDogBreedsQuery } from './dto/list-dog-breeds.query';
import { APP_HEADERS } from '../common/swagger/app-headers';

/**
 * Dicts Controller - 字典数据接口
 *
 * 认证方式: 无需认证
 * 公共请求头: 参见 APP_HEADERS
 *
 * 功能说明:
 * - 提供只读的参考数据查询
 * - 如犬种列表等基础数据
 */
@ApiTags('Dictionaries')
@ApiHeaders(APP_HEADERS)
@Controller('dicts')
export class DictsController {
  constructor(private readonly dictsService: DictsService) {}

  /**
   * 获取犬种列表
   *
   * @param q - 搜索关键词 (Query, 可选，支持中英文名称和别名)
   * @param cursor - 分页游标 (Query, 可选，默认0)
   * @param limit - 分页大小 (Query, 可选，默认20，最大50)
   * @returns data: 犬种列表
   * @returns nextCursor: 下一页游标 (null表示无更多数据)
   */
  @Get('dog-breeds')
  @ApiOperation({ summary: 'List Dog Breeds', description: 'Search and retrieve dog breeds reference data.' })
  @ApiQuery({
    name: 'q',
    required: false,
    description: '搜索关键词（Query）',
    schema: { type: 'string' },
  })
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
  listDogBreeds(@Query() query: ListDogBreedsQuery) {
    return this.dictsService.listDogBreeds(query);
  }
}
