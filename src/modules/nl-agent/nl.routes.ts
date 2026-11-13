import { FastifyInstance } from 'fastify';
import {
  handleExecute,
  handlePublicExecute,
  handleConfirm,
  handleSuggestions,
  handleHistory,
} from './nl.controller';
import { nlAuthGuard } from './nl-auth.middleware';

export async function nlRoutes(
  app: FastifyInstance
): Promise<void> {
  app.post(
    '/public/execute',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    handlePublicExecute
  );

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
