import { Request } from 'express';

interface User {
  id: number;
  email: string;
  name?: string;
}

export interface RequestWithUser extends Request {
  user: User;
}
