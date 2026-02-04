import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const DOG_EVENT_TYPES = ['BARK', 'HOWL', 'WHINE', 'GROWL', 'OTHER'] as const;

export class CreateDogEventDto {
  /**
   * Type of the vocalization event.
   * @example 'BARK'
   */
  @IsString()
  @IsIn(DOG_EVENT_TYPES)
  @ApiProperty({ description: '事件类型', enum: DOG_EVENT_TYPES, example: 'BARK' })
  eventType: string;

  /**
   * Emotional state associated with the event.
   * @example 'HAPPY'
   */
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: '情绪状态（Body 字段）', example: 'HAPPY' })
  stateType?: string;

  /**
   * Context in which the event occurred.
   * @example 'PLAYING'
   */
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: '场景类型（Body 字段）', example: 'PLAYING' })
  contextType?: string;

  /**
   * Confidence score of the classification (0-1).
   * @example 0.95
   */
  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ description: '置信度（Body 字段），0~1', example: 0.95, minimum: 0, maximum: 1 })
  confidence?: number;

  /**
   * URL to the audio recording of the event.
   * @example 'https://example.com/audio.wav'
   */
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: '音频地址（Body 字段）', example: 'https://example.com/audio.wav' })
  audioUrl?: string;
}
