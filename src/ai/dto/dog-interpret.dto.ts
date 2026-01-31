import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DogInterpretDto {
  /**
   * ID of the pet whose audio is being interpreted.
   * @example 1
   */
  @Type(() => Number)
  @ApiProperty({ description: '宠物 ID（Body/Form 字段）', example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  petId: number;

  /**
   * Locale for the interpretation result.
   * @example 'en-US'
   */
  @IsOptional()
  @ApiPropertyOptional({ description: '语言/地区（Body/Form 字段），如 en-US', example: 'en-US', maxLength: 32 })
  @IsString()
  @MaxLength(32)
  locale?: string;

  /**
   * Additional context to help interpretation (e.g., 'At the park').
   * @maxLength 200
   * @example 'Playing fetch'
   */
  @IsOptional()
  @ApiPropertyOptional({ description: '场景补充（Body/Form 字段），辅助解读', example: 'Playing fetch', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  context?: string;
}
