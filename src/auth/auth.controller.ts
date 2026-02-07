import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AtGuard } from './common/guards/at.guard';
import { GetCurrentUserId } from './common/decorators/get-current-user-id.decorator';
import { GetCurrentAccessToken } from './common/decorators/get-current-access-token.decorator';
import { Request } from 'express';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register User' })
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({ type: RegisterDto })
  @ApiOkResponse({
    description: 'User registered successfully',
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            email: { type: 'string' },
            name: { type: 'string' },
          },
        },
      },
    },
  })
  register(@Body() registerDto: RegisterDto, @Req() req: Request) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.authService.register(registerDto, lang);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login' })
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            email: { type: 'string' },
            name: { type: 'string' },
          },
        },
      },
    },
  })
  login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.authService.login(loginDto, lang);
  }

  @UseGuards(AtGuard)
  @Post('logout')
  @ApiOperation({ summary: 'Logout' })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  logout(
    @GetCurrentUserId() userId: number,
    @GetCurrentAccessToken() accessToken: string,
    @Req() req: Request,
  ) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.authService.logout(userId, accessToken, lang);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Forgot Password' })
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto, @Req() req: Request) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.authService.forgotPassword(forgotPasswordDto, lang);
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP' })
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() verifyOtpDto: VerifyOtpDto, @Req() req: Request) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.authService.verifyOtp(verifyOtpDto, lang);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset Password' })
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto, @Req() req: Request) {
    const lang = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';
    return this.authService.resetPassword(resetPasswordDto, lang);
  }
}
