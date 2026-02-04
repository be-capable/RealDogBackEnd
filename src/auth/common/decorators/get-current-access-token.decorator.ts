import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

export const GetCurrentAccessToken = createParamDecorator(
  (data: undefined, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    throw new UnauthorizedException('Access token not found');
  },
);
