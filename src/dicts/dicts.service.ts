import { Injectable } from '@nestjs/common';
import { DOG_BREEDS } from './data/dog-breeds';

@Injectable()
export class DictsService {
  listDogBreeds(query: { q?: string; cursor?: number; limit?: number }) {
    const qRaw = (query.q ?? '').trim();
    const q = qRaw.length ? qRaw.toLowerCase() : null;
    const limit = query.limit ?? 20;
    const cursor = query.cursor ?? 0;

    const filtered = q
      ? DOG_BREEDS.filter((b) => {
          const haystack = [
            b.id,
            b.nameZh,
            b.nameEn,
            ...(b.aliases ?? []),
          ]
            .join(' ')
            .toLowerCase();
          return haystack.includes(q);
        })
      : DOG_BREEDS;

    const page = filtered.slice(cursor, cursor + limit + 1);
    const hasMore = page.length > limit;
    const data = hasMore ? page.slice(0, limit) : page;
    const nextCursor = hasMore ? cursor + limit : null;
    return { data, nextCursor };
  }
}

