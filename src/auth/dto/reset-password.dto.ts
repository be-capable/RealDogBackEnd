import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  /**
   * The email address to reset password for.
   * @example 'user@example.com'
   */
  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({ description: '邮箱（Body 字段）', example: 'user@example.com' })
  email: string;

  /**
   * The valid 6-digit OTP code.
   * @example '123456'
   */
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @ApiProperty({ description: '验证码 OTP（Body 字段），6 位数字/字符', example: '123456', minLength: 6, maxLength: 6 })
  otp: string;

  /**
   * The new password to set.
   * @minLength 6
   * @example 'NewSecret123!'
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @ApiProperty({ description: '新密码（Body 字段），至少 6 位', example: 'NewSecret123!' })
  newPassword: string;
}
