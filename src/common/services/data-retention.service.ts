import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 数据保留策略服务
 * 
 * 根据隐私政策要求自动清理过期数据：
 * - 录音文件相关数据：24小时后删除
 * - 日志/审计数据：90天后删除
 * - 任务记录：30天后删除
 * - 用户导出数据：7天后删除
 */
@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 每日午夜执行数据清理任务
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyCleanup() {
    this.logger.log('Starting daily data retention cleanup...');
    
    try {
      await this.cleanupOldAudioUrls();
      await this.cleanupOldTasks();
      await this.cleanupExportLogs();
      
      this.logger.log('Daily data retention cleanup completed successfully');
    } catch (error) {
      this.logger.error('Data retention cleanup failed', error.stack);
    }
  }

  /**
   * 清理过期的黑名单 token
   * 黑名单中的 token 在其过期时间后自动删除
   */
  private async cleanupExpiredBlacklistedTokens() {
    const now = new Date();
    
    const result = await this.prisma.blacklistedToken.deleteMany({
      where: {
        expiresAt: { lt: now },
      },
    });

    if (result.count > 0) {
      this.logger.log(`Deleted ${result.count} expired blacklisted tokens`);
    }
  }

  /**
   * 清理24小时前的录音URL数据
   * 根据隐私政策：录音数据保留24小时后自动删除
   */
  private async cleanupOldAudioUrls() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // 清理狗事件中的音频URL
    const result = await this.prisma.dogEvent.updateMany({
      where: {
        createdAt: { lt: twentyFourHoursAgo },
        OR: [
          { audioUrl: { not: null } },
          { outputAudioUrl: { not: null } },
        ],
      },
      data: {
        audioUrl: null,
        outputAudioUrl: null,
      },
    });

    if (result.count > 0) {
      this.logger.log(`Cleared ${result.count} audio URLs older than 24 hours`);
    }
  }

  /**
   * 清理30天前的任务记录
   * 异步任务完成后保留30天供查询，之后删除
   */
  private async cleanupOldTasks() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const result = await this.prisma.dogTask.deleteMany({
      where: {
        createdAt: { lt: thirtyDaysAgo },
        status: { in: ['COMPLETED', 'FAILED'] },
      },
    });

    if (result.count > 0) {
      this.logger.log(`Deleted ${result.count} task records older than 30 days`);
    }
  }

  /**
   * 清理过期的导出日志
   * 目前用户数据导出是实时生成的，无需存储历史记录
   * 如果未来添加导出历史功能，需要在此处添加清理逻辑
   */
  private async cleanupExportLogs() {
    // 目前不需要清理任何东西，因为导出是实时生成的
    // 但如果需要记录导出历史，可以创建一个专门的表来存储
    // 这里保留扩展点，以防未来需要实现导出历史功能
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // 如果未来实现导出历史记录功能，可以在这里添加清理逻辑
    // 示例（仅作参考）：
    /*
    const result = await this.prisma.exportHistory.deleteMany({
      where: {
        createdAt: { lt: sevenDaysAgo },
      },
    });
    
    if (result.count > 0) {
      this.logger.log(`Deleted ${result.count} export history records older than 7 days`);
    }
    */
  }

  /**
   * 手动触发清理（用于测试或管理界面）
   */
  async manualCleanup(): Promise<{
    audioUrlsCleared: number;
    tasksDeleted: number;
    blacklistedTokensDeleted: number;
    timestamp: string;
  }> {
    this.logger.log('Manual cleanup triggered');
    
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const audioResult = await this.prisma.dogEvent.updateMany({
      where: {
        createdAt: { lt: twentyFourHoursAgo },
        OR: [
          { audioUrl: { not: null } },
          { outputAudioUrl: { not: null } },
        ],
      },
      data: {
        audioUrl: null,
        outputAudioUrl: null,
      },
    });

    const taskResult = await this.prisma.dogTask.deleteMany({
      where: {
        createdAt: { lt: thirtyDaysAgo },
        status: { in: ['COMPLETED', 'FAILED'] },
      },
    });

    const blacklistedResult = await this.prisma.blacklistedToken.deleteMany({
      where: {
        expiresAt: { lt: now },
      },
    });

    return {
      audioUrlsCleared: audioResult.count,
      tasksDeleted: taskResult.count,
      blacklistedTokensDeleted: blacklistedResult.count,
      timestamp: now.toISOString(),
    };
  }

  /**
   * 获取保留策略统计信息
   */
  async getRetentionStats(): Promise<{
    pendingAudioUrls: number;
    pendingTasks: number;
    blacklistedTokensCount: number;
    nextCleanup: string;
  }> {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const pendingAudioCount = await this.prisma.dogEvent.count({
      where: {
        createdAt: { lt: twentyFourHoursAgo },
        OR: [
          { audioUrl: { not: null } },
          { outputAudioUrl: { not: null } },
        ],
      },
    });

    const pendingTaskCount = await this.prisma.dogTask.count({
      where: {
        createdAt: { lt: thirtyDaysAgo },
        status: { in: ['COMPLETED', 'FAILED'] },
      },
    });

    const blacklistedCount = await this.prisma.blacklistedToken.count({
      where: {
        expiresAt: { gt: now },
      },
    });

    // 计算下次清理时间（明天午夜）
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    return {
      pendingAudioUrls: pendingAudioCount,
      pendingTasks: pendingTaskCount,
      blacklistedTokensCount: blacklistedCount,
      nextCleanup: tomorrow.toISOString(),
    };
  }
}
