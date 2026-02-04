import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  /**
   * User's display name.
   * @example 'Jane Doe'
   */
  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: '昵称（Body 字段）', example: 'Jane Doe' })
  name?: string;

  /**
   * User email address.
   * @example 'updated@example.com'
   */
  @IsEmail()
  @IsOptional()
  @ApiPropertyOptional({ description: '邮箱（Body 字段）', example: 'updated@example.com' })
  email?: string;
}