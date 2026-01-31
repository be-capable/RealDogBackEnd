import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeaders, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AtGuard } from './common/guards/at.guard';
import { RtGuard } from './common/guards/rt.guard';
import { GetCurrentUserId } from './common/decorators/get-current-user-id.decorator';
import { GetCurrentUser } from './common/decorators/get-current-user.decorator';
import { APP_HEADERS } from '../common/swagger/app-headers';

@ApiTags('Auth')
@ApiHeaders(APP_HEADERS)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register User', description: 'Create a new user account with email and password.' })
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({ type: RegisterDto })
  @ApiOkResponse({
    description: 'User registered successfully',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', description: 'JWT Access Token' },
        refreshToken: { type: 'string', description: 'JWT Refresh Token' },
        user: {
          type: 'object',
          description: 'Registered user details',
          properties: {
            id: { type: 'integer', description: 'User ID' },
            email: { type: 'string', description: 'User Email' },
            name: { oneOf: [{ type: 'string' }, { type: 'null' }], description: 'Display Name' },
          },
        },
      },
    },
  })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login', description: 'Authenticate user and return tokens.' })
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', description: 'JWT Access Token' },
        refreshToken: { type: 'string', description: 'JWT Refresh Token' },
        user: {
          type: 'object',
          description: 'Authenticated user details',
          properties: {
            id: { type: 'integer', description: 'User ID' },
            email: { type: 'string', description: 'User Email' },
            name: { oneOf: [{ type: 'string' }, { type: 'null' }], description: 'Display Name' },
          },
        },
      },
    },
  })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(AtGuard)
  @Post('logout')
  @ApiOperation({ summary: 'Logout', description: 'Invalidate current session (requires Access Token).' })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  logout(@GetCurrentUserId() userId: number) {
    return this.authService.logout(userId);
  }

  @UseGuards(RtGuard)
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh Token', description: 'Get new Access Token using Refresh Token.' })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOkResponse({
    description: 'Tokens refreshed',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', description: 'New JWT Access Token' },
        refreshToken: { type: 'string', description: 'New JWT Refresh Token' },
      },
    },
  })
  refreshTokens(
    @GetCurrentUserId() userId: number,
    @GetCurrentUser('refreshToken') refreshToken: string,
  ) {
    return this.authService.refreshTokens(userId, refreshToken);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Forgot Password', description: 'Request password reset OTP.' })
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP', description: 'Verify the OTP sent to email.' })
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset Password', description: 'Set new password using verified OTP.' })
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }
}
