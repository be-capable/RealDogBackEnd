import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DogSynthesizeDto {
  /**
   * ID of the pet to synthesize audio for.
   * @example 1
   */
  @Type(() => Number)
  @ApiProperty({ description: '宠物 ID（Body/Form 字段）', example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  petId: number;

  /**
   * Locale for the input text processing.
   * @example 'en-US'
   */
  @IsOptional()
  @ApiPropertyOptional({ description: '语言/地区（Body/Form 字段），如 en-US', example: 'en-US', maxLength: 32 })
  @IsString()
  @MaxLength(32)
  locale?: string;

  /**
   * Desired emotion/style of the dog vocalization (e.g., 'happy', 'aggressive').
   * @example 'excited'
   */
  @IsOptional()
  @ApiPropertyOptional({ description: '期望风格（Body/Form 字段），如 alert/happy/angry', example: 'alert', maxLength: 32 })
  @IsString()
  @MaxLength(32)
  style?: string;
}
