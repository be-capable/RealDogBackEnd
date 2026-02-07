import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({ description: '邮箱（Body 字段）', example: 'user@example.com' })
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(50, { message: 'Password cannot exceed 50 characters' })
  // @Matches removed to allow simple passwords for dev
  @ApiProperty({
    description: '密码（Body 字段），至少 6 位',
    example: '123456',
  })
  password: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: '昵称（Body 字段）', example: 'John Doe' })
  name?: string;
}
