import { IsString, IsDateString, IsBoolean, IsOptional, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PetSex } from '../enums/pet.enum';

export class CreatePetDto {
  /**
   * Name of the pet.
   * @example 'Buddy'
   */
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: '宠物名称（Body 字段）', example: 'Buddy' })
  name: string;

  /**
   * Sex of the pet.
   * @enum ['MALE', 'FEMALE']
   * @example 'MALE'
   */
  @IsNotEmpty()
  @IsEnum(PetSex)
  @ApiProperty({ description: '性别（Body 字段）', enum: PetSex, example: PetSex.MALE })
  sex: PetSex;

  /**
   * Birth date of the pet (ISO 8601 string).
   * @example '2020-01-01'
   */
  @IsNotEmpty()
  @IsDateString()
  @ApiProperty({ description: '出生日期（Body 字段），ISO 8601', example: '2020-01-01' })
  birthDate: string;

  /**
   * ID of the pet breed.
   * @example 'golden_retriever'
   */
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: '犬种 ID（Body 字段）', example: 'golden_retriever' })
  breedId: string;

  /**
   * Whether the pet is spayed or neutered.
   * @default false
   */
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ description: '是否绝育（Body 字段）', default: false })
  isSpayedNeutered?: boolean;
}
