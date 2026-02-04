export interface FeedOptions {
  page?: number;
  limit?: number;
  sort?: 'latest' | 'popular';
  type?: 'all' | 'following' | 'self';
  tag?: string;
}