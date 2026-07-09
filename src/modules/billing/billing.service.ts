import { prisma } from '../../app';
import { decrypt } from '../../utils/crypto';
import { AppError } from '../../utils/response';
import { ERROR_CODES } from '../../config/constants';
import * as backend from '../../gateway/backend-client';

async function getAgentBackendToken(
  agentId: number
): Promise<string> {
  const agent = await prisma.agentApp.findUnique({
    where: { id: agentId },
  });

  if (
    !agent?.backendUsername ||
    !agent.backendPasswordEnc
  ) {
    throw new AppError(
      ERROR_CODES.BACKEND_ERROR,
      'Backend credentials not configured'
    );
  }

  const password = decrypt(agent.backendPasswordEnc);
  return backend.getUserToken(
    agent.backendUsername,
    password
  );
}

export async function getBalance(agentId: number) {
  const userToken =
    await getAgentBackendToken(agentId);
  const balance = await backend.getBalance(userToken);

  await prisma.agentApp.update({
    where: { id: agentId },
    data: { balanceCache: balance },
  });

  const agent = await prisma.agentApp.findUnique({
    where: { id: agentId },
    select: { isTrial: true, trialBalance: true },
  });

  return {
    balance,
    trial: agent?.isTrial
      ? { trial_balance: Number(agent.trialBalance) }
      : undefined,
    currency: 'CNY',
    updated_at: new Date().toISOString(),
  };
}

export async function createRecharge(
  agentId: number,
  amount: number
) {
  const userToken =
    await getAgentBackendToken(agentId);
  const order = await backend.createUsdtRechargeOrder(
    userToken,
    amount
  );

  await prisma.agentUsageRecord.create({
    data: {
      agentId,
      action: 'recharge_created',
      resourceType: 'billing',
      details: {
        order_id: order.order_id,
        amount: order.amount,
      },
    },
  });

  return {
    order_id: order.order_id,
    amount: order.amount,
    status: order.status,
    pay_url: order.pay_url,
    created_at: new Date().toISOString(),
  };
}

export async function checkRechargeStatus(
  agentId: number,
  orderId: string
) {
  const userToken =
    await getAgentBackendToken(agentId);
  const order = await backend.checkUsdtOrderStatus(
    userToken,
    orderId
  );
  return {
    order_id: order.order_id,
    amount: order.amount,
    status: order.status,
  };
}

export async function getTransactions(
  agentId: number,
  page: number,
  pageSize: number
) {
  const userToken =
    await getAgentBackendToken(agentId);
  const result = await backend.getTransactions(
    userToken,
    { page, page_size: pageSize }
  );
  return {
    items: result.items,
    total: result.total,
    page,
    page_size: pageSize,
  };
}
