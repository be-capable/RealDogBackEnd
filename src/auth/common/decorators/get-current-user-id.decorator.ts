import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

export const GetCurrentUserId = createParamDecorator(
  (data: undefined, context: ExecutionContext): number => {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user) {
      throw new UnauthorizedException({
        message: 'Token missing or invalid',
        code: 'TOKEN_INVALID'
      });
    }

    const userId = user.sub || user.userId || user.id;
    if (!userId) {
      throw new UnauthorizedException({
        message: 'Invalid token payload',
        code: 'TOKEN_INVALID'
      });
    }
    
    return Number(userId);
  },
);
