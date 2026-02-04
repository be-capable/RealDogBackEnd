import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  code: number;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => {
        // 如果数据本身已经是标准格式（例如分页或手动包装过），则直接返回
        if (data && data.success !== undefined && data.data !== undefined) {
          return data;
        }
        
        return {
          success: true,
          code: 200,
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
