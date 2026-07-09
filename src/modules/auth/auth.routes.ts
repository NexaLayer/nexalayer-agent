import { FastifyInstance } from 'fastify';
import {
  handleGetToken,
  handleRefreshToken,
} from './auth.controller';

export async function authRoutes(
  app: FastifyInstance
): Promise<void> {
  app.post('/token', handleGetToken);
  app.post('/refresh', handleRefreshToken);
}
