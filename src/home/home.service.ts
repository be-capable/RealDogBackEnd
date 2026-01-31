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
      include: { avatarMedia: true },
    });

    if (!currentPet) {
      return {
        currentPet: null,
        recentEvents: [],
        weeklySummary: { rangeDays: 7, total: 0, byEventType: {} },
      };
    }

    const [recentEvents, weeklySummary] = await Promise.all([
      this.dogEventsService.listRecentForUser(userId, 10),
      this.dogEventsService.weeklySummaryForUser(userId, 7),
    ]);

    return { currentPet, recentEvents, weeklySummary };
  }
}

