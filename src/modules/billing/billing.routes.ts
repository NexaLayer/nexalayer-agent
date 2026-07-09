import { FastifyInstance } from 'fastify';
import {
  handleGetBalance,
  handleRecharge,
  handleRechargeStatus,
  handleGetTransactions,
} from './billing.controller';
import { authGuard } from '../../middleware/auth.middleware';
import {
  idempotencyGuard,
} from '../../middleware/idempotency';

export async function billingRoutes(
  app: FastifyInstance
): Promise<void> {
  app.addHook('preHandler', authGuard);

  app.get('/balance', handleGetBalance);
  app.post(
    '/recharge',
    { preHandler: idempotencyGuard },
    handleRecharge
  );
  app.get(
    '/recharge/:order_id/status',
    handleRechargeStatus
  );
  app.get('/transactions', handleGetTransactions);
}
