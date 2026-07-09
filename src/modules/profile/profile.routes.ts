import { FastifyInstance } from 'fastify';
import {
  handleCreate,
  handleGet,
  handleUpdate,
  handleDelete,
  handleList,
  handleDuplicate,
  handleBatchCreate,
  handleBindProxy,
  handleGenerateFingerprint,
  handleValidateFingerprint,
  handleImport,
  handleExport,
  handleAddProxy,
  handleListProxies,
  handleVerifyProxy,
  handleDeleteProxy,
} from './profile.controller';
import { authGuard } from '../../middleware/auth.middleware';

export async function profileRoutes(
  app: FastifyInstance
): Promise<void> {
  app.addHook('preHandler', authGuard);

  app.post('/', handleCreate);
  app.get('/', handleList);
  app.get('/export', handleExport);
  app.post('/import', handleImport);
  app.post('/batch-create', handleBatchCreate);
  app.get('/:profile_id', handleGet);
  app.put('/:profile_id', handleUpdate);
  app.delete('/:profile_id', handleDelete);
  app.post('/:profile_id/duplicate', handleDuplicate);
  app.post('/:profile_id/bind-proxy', handleBindProxy);
}

export async function fingerprintRoutes(
  app: FastifyInstance
): Promise<void> {
  app.addHook('preHandler', authGuard);

  app.post('/generate', handleGenerateFingerprint);
  app.post('/validate', handleValidateFingerprint);
}

export async function proxyRoutes(
  app: FastifyInstance
): Promise<void> {
  app.addHook('preHandler', authGuard);

  app.post('/', handleAddProxy);
  app.get('/', handleListProxies);
  app.post('/:proxy_id/verify', handleVerifyProxy);
  app.delete('/:proxy_id', handleDeleteProxy);
}
