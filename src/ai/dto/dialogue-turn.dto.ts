import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DialogueMode {
  DOG_TO_HUMAN = 'DOG_TO_HUMAN',
  HUMAN_TO_DOG = 'HUMAN_TO_DOG',
}

export class DialogueTurnDto {
  /**
   * Direction of the dialogue.
   * @enum ['DOG_TO_HUMAN', 'HUMAN_TO_DOG']
   * @example 'DOG_TO_HUMAN'
   */
  @IsEnum(DialogueMode)
  @ApiProperty({
    description: '对话模式（Body 字段）',
    enum: DialogueMode,
    example: DialogueMode.DOG_TO_HUMAN,
  })
  mode: DialogueMode;

  /**
   * Input text to process (user message or dog translation).
   * @maxLength 600
   * @example 'Hello, good boy!'
   */
  @IsString()
  @ApiProperty({ description: '输入文本（Body 字段）', example: 'Hello, good boy!', maxLength: 600 })
  @MaxLength(600)
  inputText: string;

  /**
   * ID of the pet involved in the dialogue.
   * @example 1
   */
  @IsOptional()
  @Type(() => Number)
  @ApiPropertyOptional({ description: '宠物 ID（Body 字段）', example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  petId?: number;

  /**
   * Locale for response generation.
   * @example 'en-US'
   */
  @IsOptional()
  @ApiPropertyOptional({ description: '语言/地区（Body 字段），如 en-US', example: 'en-US', maxLength: 32 })
  @IsString()
  @MaxLength(32)
  locale?: string;
}
