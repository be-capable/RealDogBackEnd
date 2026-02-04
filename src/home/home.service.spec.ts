import { Test, TestingModule } from '@nestjs/testing';
import { HomeService } from './home.service';
import { PrismaService } from '../prisma/prisma.service';
import { DogEventsService } from '../dog-events/dog-events.service';

describe('HomeService', () => {
  let service: HomeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomeService,
        {
          provide: PrismaService,
          useValue: {
            pet: {
              findFirst: jest.fn(),
            },
            dogEvent: {
              count: jest.fn(),
            },
          },
        },
        {
          provide: DogEventsService,
          useValue: {
            listRecentForUser: jest.fn(),
            weeklySummaryForUser: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<HomeService>(HomeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});