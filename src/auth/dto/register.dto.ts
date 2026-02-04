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
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(50, { message: 'Password cannot exceed 50 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain uppercase, lowercase, number and special character',
  })
  @ApiProperty({
    description: '密码（Body 字段），至少 8 位，必须包含大小写字母、数字和特殊字符',
    example: 'Secret123!',
  })
  password: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: '昵称（Body 字段）', example: 'John Doe' })
  name?: string;
}
