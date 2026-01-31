import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetCurrentUserId = createParamDecorator(
  (data: undefined, context: ExecutionContext): number => {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const id = user?.userId ?? user?.sub;
    if (typeof id === 'string') {
      const parsed = parseInt(id, 10);
      return Number.isNaN(parsed) ? (id as unknown as number) : parsed;
    }
    return id;
  },
);
