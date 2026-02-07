import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { I18nService } from '../i18n/i18n.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, I18nService],
})
export class UsersModule {}
