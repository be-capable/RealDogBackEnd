import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor() {
    this.initTransporter();
  }

  private async initTransporter() {
    try {
      // Use Ethereal for testing (no auth required setup)
      const testAccount = await nodemailer.createTestAccount();

      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: testAccount.user, // generated ethereal user
          pass: testAccount.pass, // generated ethereal password
        },
      });

      this.logger.log(
        `Mail service initialized with Ethereal user: ${testAccount.user}`,
      );
    } catch (error) {
      this.logger.error('Failed to initialize mail transporter', error);
    }
  }

  async sendOtp(email: string, otp: string) {
    if (!this.transporter) {
      await this.initTransporter();
    }

    const info = await this.transporter.sendMail({
      from: '"RealDog Support" <support@realdog.com>',
      to: email,
      subject: 'RealDog Password Reset Verification Code',
      text: `Your verification code is: ${otp}. It expires in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #F97316;">RealDog Password Reset</h2>
          <p>You requested a password reset. Please use the following verification code:</p>
          <div style="background-color: #FFF7ED; padding: 15px; border-radius: 8px; font-size: 24px; font-weight: bold; color: #F97316; text-align: center; letter-spacing: 5px;">
            ${otp}
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
        </div>
      `,
    });

    this.logger.log(`Message sent: ${info.messageId}`);
    // Preview only available when sending through an Ethereal account
    const previewUrl = nodemailer.getTestMessageUrl(info);
    this.logger.log(`Preview URL: ${previewUrl}`);
    return previewUrl;
  }
}
