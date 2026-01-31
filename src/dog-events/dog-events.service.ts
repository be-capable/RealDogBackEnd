import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDogEventDto } from './dto/create-dog-event.dto';

@Injectable()
export class DogEventsService {
  constructor(private prisma: PrismaService) {}

  private async assertPetOwnership(userId: number, petId: number) {
    const pet = await this.prisma.pet.findFirst({
      where: { id: petId, ownerId: userId },
      select: { id: true },
    });
    if (!pet) throw new NotFoundException('Pet not found');
  }

  async create(userId: number, petId: number, dto: CreateDogEventDto) {
    await this.assertPetOwnership(userId, petId);
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
  ) {
    await this.assertPetOwnership(userId, petId);
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

  async getById(userId: number, eventId: number) {
    const event = await this.prisma.dogEvent.findFirst({
      where: {
        id: eventId,
        pet: {
          ownerId: userId,
        },
      },
      include: {
        pet: {
          select: { id: true, name: true, avatarMedia: true },
        },
      },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async listRecentForUser(userId: number, limit = 10) {
    return this.prisma.dogEvent.findMany({
      where: {
        pet: { ownerId: userId },
      },
      orderBy: [{ id: 'desc' }],
      take: limit,
      include: {
        pet: { select: { id: true, name: true, avatarMedia: true } },
      },
    });
  }

  async weeklySummaryForUser(userId: number, days = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const events = await this.prisma.dogEvent.findMany({
      where: {
        pet: { ownerId: userId },
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

