import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  /**
   * The email address associated with the OTP.
   * @example 'user@example.com'
   */
  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({ description: '邮箱（Body 字段）', example: 'user@example.com' })
  email: string;

  /**
   * The 6-digit OTP code received via email.
   * @example '123456'
   */
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @ApiProperty({ description: '验证码 OTP（Body 字段），6 位数字/字符', example: '123456', minLength: 6, maxLength: 6 })
  otp: string;
}
