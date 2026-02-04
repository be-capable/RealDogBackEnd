import { 
  WebSocketGateway, 
  WebSocketServer, 
  OnGatewayInit, 
  OnGatewayConnection, 
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket 
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: "*", // 在生产环境中应该配置具体的域名
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('NotificationGateway');

  afterInit(server: Server) {
    this.logger.log('Initialized');
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
    
    // 客户端连接后加入自己的用户房间
    const userId = client.handshake.auth.userId;
    if (userId) {
      client.join(`user_${userId}`);
      this.logger.log(`Client ${client.id} joined room user_${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // 发送通知给特定用户
  sendNotification(userId: number, notification: any) {
    this.server.to(`user_${userId}`).emit('notification', notification);
  }

  // 发送系统通知
  sendSystemNotification(userId: number, message: string) {
    this.server.to(`user_${userId}`).emit('system_notification', {
      type: 'system',
      message,
      timestamp: new Date(),
    });
  }

  // 广播给所有用户（谨慎使用）
  broadcastToAll(message: any) {
    this.server.emit('broadcast', message);
  }

  // 特定事件处理器
  @SubscribeMessage('join_room')
  handleJoinRoom(
    @MessageBody() roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(roomId);
    return { success: true, message: `Joined room ${roomId}` };
  }

  @SubscribeMessage('leave_room')
  handleLeaveRoom(
    @MessageBody() roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(roomId);
    return { success: true, message: `Left room ${roomId}` };
  }

  @SubscribeMessage('mark_as_read')
  handleMarkAsRead(
    @MessageBody() notificationId: number,
    @ConnectedSocket() client: Socket,
  ) {
    // 这里可以调用服务层来更新通知状态
    // 通常这种操作会通过REST API完成
    return { success: true, notificationId };
  }
}