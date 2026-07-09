import {
  describe,
  it,
  expect,
} from 'vitest';
import { getContext } from './helpers/test-context';

describe('TS-2: Product & Region Queries', () => {
  describe('TC-F06a: Dynamic products', () => {
    it('lists dynamic products', async () => {
      const ctx = getContext();
      ctx.agentClient.useApiKeyAuth();

      const { status, body } =
        await ctx.agentClient.listProducts('dynamic');

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data?.items)).toBe(
        true
      );

      if (body.data.items.length > 0) {
        const item = body.data.items[0];
        expect(item.type).toBe('dynamic');
        expect(typeof item.price).toBe('number');
        if (item.product_no) {
          ctx.dynamicProductNo = item.product_no;
        }
        console.log(
          `[TS-2] Dynamic: ${body.data.items.length}` +
            ` items, first=${item.product_no}`
        );
      } else {
        console.warn(
          '[TS-2] No dynamic products available'
        );
      }
    });
  });

  describe('TC-F06b: Static products', () => {
    it('lists static products', async () => {
      const ctx = getContext();
      ctx.agentClient.useApiKeyAuth();

      const { status, body } =
        await ctx.agentClient.listProducts('static');

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data?.items)).toBe(
        true
      );

      if (body.data.items.length > 0) {
        const item = body.data.items[0];
        expect(item.type).toBe('static');
        expect(typeof item.price).toBe('number');
        if (item.product_no) {
          ctx.staticProductNo = item.product_no;
        }
        console.log(
          `[TS-2] Static: ${body.data.items.length}` +
            ` items, first=${item.product_no}` +
            ` (${item.name})`
        );
      } else {
        console.warn(
          '[TS-2] No static products available'
        );
      }
    });
  });

  describe('TC-F06c: All products', () => {
    it(
      'lists all products (dynamic + static)',
      async () => {
        const ctx = getContext();
        ctx.agentClient.useApiKeyAuth();

        const { status, body } =
          await ctx.agentClient.listProducts('all');

        expect(status).toBe(200);
        expect(
          body.data.items.length
        ).toBeGreaterThan(0);

        const types = new Set(
          body.data.items.map(
            (i: { type: string }) => i.type
          )
        );
        console.log(
          `[TS-2] All: ` +
            `${body.data.total} items, ` +
            `types: ${[...types].join(', ')}`
        );
      }
    );
  });

  describe('TC-F06d: Region hierarchy', () => {
    it('fetches region hierarchy', async () => {
      const ctx = getContext();
      ctx.agentClient.useApiKeyAuth();

      const { status, body } =
        await ctx.agentClient.listRegions();

      expect(status).toBe(200);
      expect(body.success).toBe(true);

      const items = body.data?.items;
      expect(items).toBeTruthy();
      expect(
        Array.isArray(items)
      ).toBe(true);

      if (Array.isArray(items) && items.length > 0) {
        console.log(
          `[TS-2] Regions: ` +
            `${items.length} top-level`
        );
      }
    });
  });
});
