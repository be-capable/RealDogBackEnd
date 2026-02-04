import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class ApiSignGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  private getAppSecret(): string {
    return this.configService.get<string>('API_SIGN_SECRET') || '';
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // 1. Skip check for Swagger or some specific paths if needed
    if (request.url.includes('/api-docs')) {
      return true;
    }

    // 2. Extract Headers
    const timestamp = request.headers['x-app-timestamp'] as string;
    const nonce = request.headers['x-app-nonce'] as string;
    const sign = request.headers['x-app-sign'] as string;

    if (!timestamp || !nonce || !sign) {
      throw new UnauthorizedException('Missing Signature Headers');
    }

    // 3. Verify Timestamp (e.g. within 5 minutes)
    const now = Date.now();
    const reqTime = parseInt(timestamp, 10);
    if (Math.abs(now - reqTime) > 5 * 60 * 1000) {
      throw new UnauthorizedException('Request Expired');
    }

    // 4. Verify Signature
    const params: Record<string, any> = {};

    // Add Query Params
    Object.assign(params, request.query);

    // Add Body Params (if JSON)
    if (request.body && typeof request.body === 'object') {
      Object.assign(params, request.body);
    }

    // Add Header Params involved in sign
    params['timestamp'] = timestamp;
    params['nonce'] = nonce;

    const calculatedSign = this.generateSignature(params, this.getAppSecret());

    if (calculatedSign !== sign) {
      throw new UnauthorizedException('Invalid Signature');
    }

    return true;
  }

  private generateSignature(params: Record<string, any>, salt: string): string {
    const validParams: Record<string, any> = {};
    for (const key in params) {
      const value = params[key];
      if (value !== null && value !== undefined && value !== '') {
        validParams[key] = value;
      }
    }

    const sortedKeys = Object.keys(validParams).sort();

    let str = '';
    for (let i = 0; i < sortedKeys.length; i++) {
      const key = sortedKeys[i];
      const value = validParams[key];
      str += `${key}=${value}`;
      if (i < sortedKeys.length - 1) {
        str += '&';
      }
    }

    str += salt;

    return crypto.createHmac('sha256', salt).update(str).digest('hex');
  }
}
