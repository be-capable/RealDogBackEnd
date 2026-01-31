import { Controller, Get, Query } from '@nestjs/common';
import { ApiHeaders, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DictsService } from './dicts.service';
import { ListDogBreedsQuery } from './dto/list-dog-breeds.query';
import { APP_HEADERS } from '../common/swagger/app-headers';

@ApiTags('Dictionaries')
@ApiHeaders(APP_HEADERS)
@Controller('dicts')
export class DictsController {
  constructor(private readonly dictsService: DictsService) {}

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
