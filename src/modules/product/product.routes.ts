import { FastifyInstance } from 'fastify';
import {
  handleListProducts,
  handleListRegions,
} from './product.controller';
import { authGuard } from '../../middleware/auth.middleware';

export async function productRoutes(
  app: FastifyInstance
): Promise<void> {
  app.addHook('preHandler', authGuard);

  app.get('/', handleListProducts);
  app.get('/regions', handleListRegions);
}
