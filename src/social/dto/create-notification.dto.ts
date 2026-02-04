import { IsString, IsNumber, IsEnum, IsIn } from 'class-validator';

export enum NotificationType {
  LIKE = 'like',
  COMMENT = 'comment',
  FOLLOW = 'follow',
  MENTION = 'mention',
}

export class CreateNotificationDto {
  @IsNumber()
  userId: number;

  @IsNumber()
  senderId: number;

  @IsEnum(NotificationType)
  @IsIn(['like', 'comment', 'follow', 'mention'])
  type: NotificationType;

  @IsString()
  content: string;
}