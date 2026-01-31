import { HomeService } from './home.service';

describe('HomeService', () => {
  it('returns empty feed when user has no pets', async () => {
    const prisma = {
      pet: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as any;
    const dogEventsService = {
      listRecentForUser: jest.fn(),
      weeklySummaryForUser: jest.fn(),
    } as any;

    const service = new HomeService(prisma, dogEventsService);
    const result = await service.getHome(1);

    expect(result.currentPet).toBeNull();
    expect(result.recentEvents).toEqual([]);
    expect(result.weeklySummary.total).toBe(0);
  });

  it('returns currentPet and aggregates when pets exist', async () => {
    const prisma = {
      pet: {
        findFirst: jest.fn().mockResolvedValue({ id: 1, name: '妞妞' }),
      },
    } as any;
    const dogEventsService = {
      listRecentForUser: jest.fn().mockResolvedValue([{ id: 1 }]),
      weeklySummaryForUser: jest.fn().mockResolvedValue({ rangeDays: 7, total: 1, byEventType: { BARK: 1 } }),
    } as any;

    const service = new HomeService(prisma, dogEventsService);
    const result = await service.getHome(1);

    expect(result.currentPet).toEqual({ id: 1, name: '妞妞' });
    expect(result.recentEvents).toEqual([{ id: 1 }]);
    expect(result.weeklySummary.byEventType).toEqual({ BARK: 1 });
  });
});

