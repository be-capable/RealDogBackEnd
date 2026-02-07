import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { MailService } from '../mail/mail.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { I18nService } from '../i18n/i18n.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
    private configService: ConfigService,
    private i18nService: I18nService,
  ) {}

  async register(registerDto: RegisterDto, lang: string = 'en') {
    const { email, password, name } = registerDto;
    const normalizedEmail = String(email ?? '').trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException(this.i18nService.t('User with this email already exists', lang));
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const token = await this.generateToken(user);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  async login(loginDto: LoginDto, lang: string = 'en') {
    const { email, password } = loginDto;
    const normalizedEmail = String(email ?? '').trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException(this.i18nService.t('Invalid email or password', lang));
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException(this.i18nService.t('Invalid email or password', lang));
    }

    const token = await this.generateToken(user);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  async logout(userId: number, accessToken: string, lang: string = 'en') {
    try {
      const decoded = this.jwtService.decode(accessToken);
      if (decoded && decoded['exp']) {
        const expiresAt = new Date(decoded['exp'] * 1000);
        await this.prisma.blacklistedToken.upsert({
          where: { token: accessToken },
          update: { expiresAt },
          create: {
            token: accessToken,
            expiresAt,
          },
        });
      }
    } catch (error) {
      this.logger.warn(`Failed to blacklist token during logout: ${error}`);
    }
    return { message: this.i18nService.t('Logged out successfully', lang) };
  }

  async generateToken(user: any) {
    const payload = { sub: user.id, email: user.email };
    return this.jwtService.sign(payload, {
      expiresIn: '7d',
    });
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto, lang: string = 'en') {
    const { email } = forgotPasswordDto;
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (user) {
      const otp = crypto.randomInt(100000, 999999).toString();
      const otpExpiry = new Date();
      otpExpiry.setMinutes(otpExpiry.getMinutes() + 10);

      await this.prisma.user.update({
        where: { id: user.id },
        data: { otp, otpExpiry },
      });

      await this.mailService.sendOtp(normalizedEmail, otp);
    }

    return { message: this.i18nService.t('If the email exists, an OTP has been sent', lang) };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto, lang: string = 'en') {
    const { email, otp } = verifyOtpDto;
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      throw new BadRequestException(this.i18nService.t('Invalid or expired OTP', lang));
    }

    if (user.otp !== otp || !user.otpExpiry || user.otpExpiry < new Date()) {
      throw new BadRequestException(this.i18nService.t('Invalid or expired OTP', lang));
    }

    return { message: this.i18nService.t('OTP verified successfully', lang) };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto, lang: string = 'en') {
    const { email, otp, newPassword } = resetPasswordDto;
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      throw new BadRequestException(this.i18nService.t('Invalid or expired OTP', lang));
    }

    if (user.otp !== otp || !user.otpExpiry || user.otpExpiry < new Date()) {
      throw new BadRequestException(this.i18nService.t('Invalid or expired OTP', lang));
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        otp: null,
        otpExpiry: null,
      },
    });

    return { message: this.i18nService.t('Password reset successfully', lang) };
  }
}
