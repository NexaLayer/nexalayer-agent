import { beforeAll } from 'vitest';
import { ensureReady } from './helpers/ensure-ready';

beforeAll(async () => {
  await ensureReady();
}, 30_000);
