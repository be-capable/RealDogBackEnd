import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  /**
   * User email address (must be unique).
   * @example 'user@example.com'
   */
  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({ description: '邮箱（Body 字段）', example: 'user@example.com' })
  email: string;

  /**
   * User password.
   * @minLength 6
   * @example 'Secret123!'
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @ApiProperty({ description: '密码（Body 字段），至少 6 位', example: 'Secret123!' })
  password: string;

  /**
   * User's display name.
   * @example 'John Doe'
   */
  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: '昵称（Body 字段）', example: 'John Doe' })
  name?: string;
}