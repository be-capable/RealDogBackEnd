import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { MailService } from '../mail/mail.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  /**
   * Registers a new user.
   *
   * 1. Checks if a user with the provided email already exists.
   * 2. Hashes the password using bcrypt.
   * 3. Creates the user record in the database.
   * 4. Generates Access and Refresh tokens.
   * 5. Stores the hashed Refresh Token in the database.
   *
   * @param registerDto - Registration data (email, password, name).
   * @returns User object and tokens (accessToken, refreshToken).
   * @throws ConflictException if email is already in use.
   */
  async register(registerDto: RegisterDto) {
    const { email, password, name } = registerDto;
    const normalizedEmail = String(email ?? '').trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name,
      },
    });

    const tokens = await this.generateTokens(user);
    await this.updateRtHash(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  /**
   * Authenticates a user.
   *
   * 1. Finds user by email.
   * 2. Validates password hash.
   * 3. Generates new tokens.
   * 4. Updates Refresh Token hash in DB.
   *
   * @param loginDto - Login credentials.
   * @returns User object and tokens.
   * @throws UnauthorizedException if credentials are invalid.
   */
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const normalizedEmail = String(email ?? '').trim().toLowerCase();

    const user =
      (await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
      })) ??
      (await this.prisma.user.findUnique({
        where: { email },
      }));

    if (!user) {
      const at = normalizedEmail.indexOf('@');
      const maskedEmail =
        at > 0 ? `${normalizedEmail.slice(0, 2)}***${normalizedEmail.slice(at)}` : `${normalizedEmail.slice(0, 2)}***`;
      this.logger.warn(JSON.stringify({ msg: 'auth.login.user_not_found', email: maskedEmail }));
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      this.logger.warn(JSON.stringify({ msg: 'auth.login.password_mismatch', userId: user.id }));
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user);
    await this.updateRtHash(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  /**
   * Logs out a user by removing their Refresh Token hash.
   *
   * @param userId - ID of the user to logout.
   */
  async logout(userId: number) {
    await this.prisma.user.updateMany({
      where: {
        id: userId,
        hashedRt: { not: null },
      },
      data: { hashedRt: null },
    });
    return { message: 'Logged out successfully' };
  }

  /**
   * Refreshes tokens using a valid Refresh Token.
   *
   * 1. Validates user existence and stored hash.
   * 2. Compares provided RT with stored hash.
   * 3. Generates new pair of tokens.
   * 4. Rotates the RT hash in DB (Refresh Token Rotation).
   *
   * @param userId - User ID extracted from RT payload.
   * @param rt - The Refresh Token string.
   * @returns New Access and Refresh tokens.
   */
  async refreshTokens(userId: number, rt: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || !user.hashedRt) throw new ForbiddenException('Access Denied');

    const rtMatches = await bcrypt.compare(rt, user.hashedRt);
    if (!rtMatches) throw new ForbiddenException('Access Denied');

    const tokens = await this.generateTokens(user);
    await this.updateRtHash(user.id, tokens.refreshToken);
    return tokens;
  }

  async updateRtHash(userId: number, rt: string) {
    const hash = await bcrypt.hash(rt, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRt: hash },
    });
  }

  async generateTokens(user: any) {
    const payload = { sub: user.id, email: user.email };
    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET || 'super_secret_key',
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_RT_SECRET || 'super_secret_rt_key',
        expiresIn: '7d',
      }),
    ]);

    return {
      accessToken: at,
      refreshToken: rt,
    };
  }

  /**
   * Initiates password reset flow.
   * Generates OTP and sends via email.
   */
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { otp, otpExpiry },
    });

    const previewUrl = await this.mailService.sendOtp(normalizedEmail, otp);
    return { message: 'OTP sent to email', previewUrl };
  }

  /**
   * Verifies an OTP without resetting password.
   */
  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { email, otp } = verifyOtpDto;
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.otp !== otp || !user.otpExpiry || user.otpExpiry < new Date()) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    return { message: 'OTP verified successfully' };
  }

  /**
   * Resets password using a verified OTP.
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { email, otp, newPassword } = resetPasswordDto;
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.otp !== otp || !user.otpExpiry || user.otpExpiry < new Date()) {
      throw new BadRequestException('Invalid or expired OTP');
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

    return { message: 'Password reset successfully' };
  }
}
