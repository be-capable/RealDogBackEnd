import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  /**
   * User email address.
   * @example 'user@example.com'
   */
  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({ description: '邮箱（Body 字段）', example: 'user@example.com' })
  email: string;

  /**
   * User password.
   * @example 'Secret123!'
   */
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: '密码（Body 字段）', example: 'Secret123!' })
  password: string;
}
