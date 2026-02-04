import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class AtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    return true; // Middleware handles authentication
  }
}
