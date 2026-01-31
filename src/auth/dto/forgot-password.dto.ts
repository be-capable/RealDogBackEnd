import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  /**
   * The email address to send the password reset OTP to.
   * @example 'user@example.com'
   */
  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({ description: '邮箱（Body 字段）', example: 'user@example.com' })
  email: string;
}
