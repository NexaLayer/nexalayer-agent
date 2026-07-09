import { FastifyInstance } from 'fastify';
import {
  handleExecute,
  handleConfirm,
  handleSuggestions,
  handleHistory,
} from './nl.controller';
import { nlAuthGuard } from './nl-auth.middleware';

export async function nlRoutes(
  app: FastifyInstance
): Promise<void> {
  app.post(
    '/execute',
    { preHandler: [nlAuthGuard] },
    handleExecute
  );

  app.post(
    '/confirm',
    { preHandler: [nlAuthGuard] },
    handleConfirm
  );

  app.get('/suggestions', handleSuggestions);

  app.get(
    '/history',
    { preHandler: [nlAuthGuard] },
    handleHistory
  );
}
