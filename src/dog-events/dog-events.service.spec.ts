import { DogEventsService } from './dog-events.service';

describe('DogEventsService', () => {
  it('weeklySummaryForUser groups event types', async () => {
    const prisma = {
      dogEvent: {
        findMany: jest.fn().mockResolvedValue([
          { eventType: 'BARK' },
          { eventType: 'BARK' },
          { eventType: 'HOWL' },
        ]),
      },
    } as any;

    const service = new DogEventsService(prisma);
    const summary = await service.weeklySummaryForUser(1, 7);

    expect(summary.total).toBe(3);
    expect(summary.byEventType).toEqual({ BARK: 2, HOWL: 1 });
  });

  it('listByPet returns nextCursor when more items exist', async () => {
    const prisma = {
      pet: {
        findFirst: jest.fn().mockResolvedValue({ id: 1 }),
      },
      dogEvent: {
        findMany: jest.fn().mockResolvedValue([
          { id: 10, petId: 1, eventType: 'BARK', createdAt: new Date().toISOString() },
          { id: 9, petId: 1, eventType: 'BARK', createdAt: new Date().toISOString() },
          { id: 8, petId: 1, eventType: 'HOWL', createdAt: new Date().toISOString() },
        ]),
      },
    } as any;

    const service = new DogEventsService(prisma);
    const result = await service.listByPet(1, 1, { limit: 2 });

    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe(9);
  });
});

