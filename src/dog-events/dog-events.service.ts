import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDogEventDto } from './dto/create-dog-event.dto';
import { I18nService } from '../i18n/i18n.service';

@Injectable()
export class DogEventsService {
  constructor(
    private prisma: PrismaService,
    private i18nService: I18nService,
  ) {}

  private async assertPetOwnership(userId: number, petId: number, lang: string = 'en') {
    const pet = await this.prisma.pet.findFirst({
      where: { id: petId, ownerId: userId },
      select: { id: true },
    });
    if (!pet) throw new NotFoundException(this.i18nService.t('Pet not found', lang));
  }

  async create(userId: number, petId: number, dto: CreateDogEventDto, lang: string = 'en') {
    await this.assertPetOwnership(userId, petId, lang);
    return this.prisma.dogEvent.create({
      data: {
        petId,
        eventType: dto.eventType,
        stateType: dto.stateType,
        contextType: dto.contextType,
        confidence: dto.confidence,
        audioUrl: dto.audioUrl,
      },
    });
  }

  async listByPet(
    userId: number,
    petId: number,
    query: { cursor?: number; limit?: number },
    lang: string = 'en',
  ) {
    await this.assertPetOwnership(userId, petId, lang);
    const limit = query.limit ?? 20;

    const items = await this.prisma.dogEvent.findMany({
      where: { petId },
      orderBy: [{ id: 'desc' }],
      take: limit + 1,
      ...(query.cursor
        ? {
            cursor: { id: query.cursor },
            skip: 1,
          }
        : {}),
    });

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? data[data.length - 1]?.id : null;

    return { data, nextCursor };
  }

  async getById(userId: number, eventId: number, lang: string = 'en') {
    const event = await this.prisma.dogEvent.findFirst({
      where: {
        id: eventId,
        Pet: {
          ownerId: userId,
        },
      },
      include: {
        Pet: {
          select: { id: true, name: true, avatarMediaId: true },
        },
      },
    });
    if (!event) throw new NotFoundException(this.i18nService.t('Event not found', lang));
    return event;
  }

  async listRecentForUser(userId: number, limit = 10, lang: string = 'en') {
    return this.prisma.dogEvent.findMany({
      where: {
        Pet: { ownerId: userId },
      },
      orderBy: [{ id: 'desc' }],
      take: limit,
      include: {
        Pet: { select: { id: true, name: true, avatarMediaId: true } },
      },
    });
  }

  async weeklySummaryForUser(userId: number, days = 7, lang: string = 'en') {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const events = await this.prisma.dogEvent.findMany({
      where: {
        Pet: { ownerId: userId },
        createdAt: { gte: since },
      },
      select: { eventType: true },
    });

    const byEventType: Record<string, number> = {};
    for (const e of events) {
      byEventType[e.eventType] = (byEventType[e.eventType] ?? 0) + 1;
    }

    return {
      rangeDays: days,
      total: events.length,
      byEventType,
    };
  }
}

