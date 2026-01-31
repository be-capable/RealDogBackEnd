import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListDogBreedsQuery {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: '搜索关键词（Query）', example: 'golden' })
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({ description: '分页游标（Query）', example: 0, minimum: 0 })
  cursor?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @ApiPropertyOptional({ description: '分页大小（Query），1~50', example: 20, minimum: 1, maximum: 50 })
  limit?: number;
}
