import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DogEventsService } from '../dog-events/dog-events.service';

@Injectable()
export class HomeService {
  constructor(
    private prisma: PrismaService,
    private dogEventsService: DogEventsService,
  ) {}

  async getHome(userId: number) {
    const currentPet = await this.prisma.pet.findFirst({
      where: { ownerId: userId },
      orderBy: [{ updatedAt: 'desc' }],
      include: { PetMedia_Pet_avatarMediaIdToPetMedia: true },
    });

    if (!currentPet) {
      return {
        currentPet: null,
        petStatus: null,
        aiInsight: null,
        quickActions: [
          { label: '添加宠物', icon: 'pet-add', route: '/pets/new' },
          { label: '解读狗叫', icon: 'listen', route: '/ai/dog/interpret' },
          { label: '人狗对话', icon: 'chat', route: '/ai/dialogue' },
        ],
        recentEvents: [],
        weeklyStats: { total: 0, byEventType: {} },
      };
    }

    const [recentEvents, weeklyStats] = await Promise.all([
      this.dogEventsService.listRecentForUser(userId, 5),
      this.dogEventsService.weeklySummaryForUser(userId, 7),
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEventsCount = await this.prisma.dogEvent.count({
      where: {
        Pet: { ownerId: userId },
        createdAt: { gte: todayStart },
      },
    });
    
    // Calculate dominant mood from weeklyStats
    const { mood, confidence } = this.analyzeDominantMood(weeklyStats.byEventType);

    // Generate AI Insight
    const insight = this.generateAiInsight(weeklyStats, currentPet.name);

    return {
      currentPet: {
        id: currentPet.id,
        name: currentPet.name,
        avatarKey: currentPet.PetMedia_Pet_avatarMediaIdToPetMedia?.objectKey ?? null,
      },
      petStatus: {
        name: currentPet.name,
        avatarKey: currentPet.PetMedia_Pet_avatarMediaIdToPetMedia?.objectKey ?? null,
        todayEventsCount,
        dominantMood: mood,
        moodConfidence: confidence,
      },
      aiInsight: insight,
      quickActions: [
        { label: '解读狗叫', icon: 'mic', route: '/ai/dog/interpret' },
        { label: '人狗对话', icon: 'chat', route: '/ai/dialogue' },
        { label: '查看记录', icon: 'list', route: '/events' },
      ],
      recentEvents,
      weeklyStats,
    };
  }

  private analyzeDominantMood(byEventType: Record<string, number>): { mood: string; confidence: number } {
    let maxCount = 0;
    let dominantType = 'OTHER';

    for (const [type, count] of Object.entries(byEventType)) {
      if (count > maxCount) {
        maxCount = count;
        dominantType = type;
      }
    }

    if (maxCount === 0) return { mood: '平静', confidence: 0 };

    const moodMap: Record<string, { mood: string; confidence: number }> = {
      'BARK': { mood: '活跃', confidence: Math.min(0.9, 0.5 + maxCount * 0.1) },
      'HOWL': { mood: '孤独/警觉', confidence: Math.min(0.8, 0.4 + maxCount * 0.05) },
      'WHINE': { mood: '焦虑/渴望', confidence: Math.min(0.8, 0.4 + maxCount * 0.05) },
      'GROWL': { mood: '警惕/防御', confidence: Math.min(0.8, 0.4 + maxCount * 0.05) },
      'OTHER': { mood: '一般', confidence: 0.3 },
    };

    return moodMap[dominantType] || { mood: '未知', confidence: 0 };
  }

  private generateAiInsight(weeklyStats: any, petName: string): { pattern: string; recommendation: string } | null {
    if (weeklyStats.total < 3) {
      return {
        pattern: `${petName} 这周很安静，活动记录较少。`,
        recommendation: `多和 ${petName} 互动，积累一些行为数据吧！`,
      };
    }

    const byType = weeklyStats.byEventType;
    let pattern = '';
    let recommendation = '';

    if ((byType['WHINE'] || 0) > (byType['BARK'] || 0) * 0.5) {
      pattern = `${petName} 这周呜咽（WHINE）较多，可能感到无聊或有些分离焦虑。`;
      recommendation = `建议增加互动时间，或尝试使用“人狗对话”功能安慰它。`;
    } else if ((byType['GROWL'] || 0) > 3) {
      pattern = `${petName} 这周低吼（GROWL）频率较高，可能对环境比较敏感。`;
      recommendation: `请留意是否有陌生人或动物接近，观察它的警戒对象。`;
    } else if ((byType['HOWL'] || 0) > 2) {
      pattern = `${petName} 这周有嚎叫（HOWL）的行为。`;
      recommendation: `可能是听到了远方的声音感到好奇，或者想引起你的注意。`;
    } else {
      pattern = `${petName} 这周整体状态不错，以正常的吠叫（BARK）为主。`;
      recommendation = `继续保持良好的互动习惯！`;
    }

    return { pattern, recommendation };
  }
}

