import { FastifyRequest, FastifyReply } from 'fastify';
import {
  launchBrowserSchema,
  navigateSchema,
  executeSchema,
  evaluateSchema,
  screenshotSchema,
  closeBrowserSchema,
  batchLaunchSchema,
  batchCloseSchema,
  listInstancesSchema,
} from './browser.schema';
import * as browserService from './browser.service';
import {
  sendSuccess,
  sendPaginated,
  AppError,
} from '../../utils/response';
import { ERROR_CODES } from '../../config/constants';

function getCtx(request: FastifyRequest) {
  const ctx = request.agentContext;
  if (!ctx) {
    throw new AppError(
      ERROR_CODES.AUTH_INVALID_KEY,
      'Not authenticated'
    );
  }
  return ctx;
}

export async function handleLaunch(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const body = launchBrowserSchema.parse(request.body);
  const result = await browserService.launchBrowser(
    ctx.agentId, body
  );
  sendSuccess(reply, result, 201, request.startTime);
}

export async function handleClose(
  request: FastifyRequest<{
    Params: { instance_id: string };
  }>,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const body = closeBrowserSchema.parse(
    request.body ?? {}
  );
  const result = await browserService.closeBrowser(
    ctx.agentId,
    request.params.instance_id,
    body.save_cookies
  );
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleRestart(
  request: FastifyRequest<{
    Params: { instance_id: string };
  }>,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const result = await browserService.restartBrowser(
    ctx.agentId,
    request.params.instance_id
  );
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleList(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const query = listInstancesSchema.parse(request.query);
  const result = await browserService.listInstances(
    ctx.agentId, query
  );
  sendPaginated(
    reply,
    result.items,
    result.total,
    result.page,
    result.page_size,
    request.startTime
  );
}

export async function handleGetInstance(
  request: FastifyRequest<{
    Params: { instance_id: string };
  }>,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const result = await browserService.getInstance(
    ctx.agentId,
    request.params.instance_id
  );
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleNavigate(
  request: FastifyRequest<{
    Params: { instance_id: string };
  }>,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const body = navigateSchema.parse(request.body);
  const result = await browserService.navigate(
    ctx.agentId,
    request.params.instance_id,
    body
  );
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleExecute(
  request: FastifyRequest<{
    Params: { instance_id: string };
  }>,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const body = executeSchema.parse(request.body);
  const result = await browserService.executeActions(
    ctx.agentId,
    request.params.instance_id,
    body
  );
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleEvaluate(
  request: FastifyRequest<{
    Params: { instance_id: string };
  }>,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const body = evaluateSchema.parse(request.body);
  const result = await browserService.evaluate(
    ctx.agentId,
    request.params.instance_id,
    body.script
  );
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleScreenshot(
  request: FastifyRequest<{
    Params: { instance_id: string };
  }>,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const body = screenshotSchema.parse(
    request.body ?? {}
  );
  const result = await browserService.takeScreenshot(
    ctx.agentId,
    request.params.instance_id,
    body
  );
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleBatchLaunch(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const body = batchLaunchSchema.parse(request.body);
  const result = await browserService.batchLaunch(
    ctx.agentId,
    body.profile_ids,
    body.headless,
    body.start_url
  );
  sendSuccess(reply, result, 201, request.startTime);
}

export async function handleBatchClose(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const body = batchCloseSchema.parse(
    request.body ?? {}
  );
  const result = await browserService.batchClose(
    ctx.agentId,
    body.instance_ids,
    body.save_cookies
  );
  sendSuccess(reply, result, 200, request.startTime);
}
