import { IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadPetMediaDto {
  /**
   * Type of media being uploaded.
   * @example 'PHOTO'
   */
  @IsString()
  @IsIn(['PHOTO', 'VIDEO'])
  @ApiProperty({ description: '媒体类型（Body/Form 字段）', enum: ['PHOTO', 'VIDEO'], example: 'PHOTO' })
  type: 'PHOTO' | 'VIDEO';
}
