import {
  describe,
  it,
  expect,
} from 'vitest';
import { getContext } from './helpers/test-context';
import { BACKEND_BASE_URL } from './setup';
import {
  BackendDynamicProductSchema,
  BackendStaticProductSchema,
  BackendAreaSchema,
  BackendLoginSchema,
  BackendResponseSchema,
  CONTRACT_VERSION,
} from './helpers/backend-contracts';
import { z } from 'zod';

async function backendGet<T>(
  path: string,
  token: string
): Promise<T> {
  const res = await fetch(
    `${BACKEND_BASE_URL}${path}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return (await res.json()) as T;
}

async function backendPost<T>(
  path: string,
  body: unknown,
  token: string
): Promise<T> {
  const res = await fetch(
    `${BACKEND_BASE_URL}${path}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }
  );
  return (await res.json()) as T;
}

describe(
  `TS-9: Backend Contract (${CONTRACT_VERSION})`,
  () => {
    const contractLoginUsername =
      process.env.CONTRACT_LOGIN_USERNAME ?? 'openAgent';
    const contractLoginPassword =
      process.env.CONTRACT_LOGIN_PASSWORD;

    it(
      'login response matches contract',
      async () => {
        if (!contractLoginPassword) {
          console.warn(
            '[TS-9] CONTRACT_LOGIN_PASSWORD not set, skip'
          );
          return;
        }

        const res = await fetch(
          `${BACKEND_BASE_URL}/api/auth/login`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              username: contractLoginUsername,
              password: contractLoginPassword,
            }),
          }
        );
        const raw = await res.json();

        const schema = BackendResponseSchema(
          BackendLoginSchema
        );
        const result = schema.safeParse(raw);

        if (!result.success) {
          console.error(
            '[TS-9] Login contract BROKEN:',
            result.error.issues
              .map((i) =>
                `${i.path.join('.')}: ` +
                  `${i.message}`
              )
              .join('; ')
          );
        }
        expect(result.success).toBe(true);
        console.log(
          '[TS-9] Login response: contract OK'
        );
      }
    );

    it(
      'dynamic products match contract',
      async () => {
        const ctx = getContext();
        const token =
          ctx.backendClient.getToken();
        if (!token) {
          console.warn(
            '[TS-9] No backend token, skip'
          );
          return;
        }

        const raw = await backendGet<{
          code: number;
          data: unknown[];
        }>(
          '/api/business/dynamic-proxy/products',
          token
        );

        const items = raw.data ?? [];
        if (items.length === 0) {
          console.warn(
            '[TS-9] No dynamic products'
          );
          return;
        }

        const schema = z.array(
          BackendDynamicProductSchema
        );
        const result = schema.safeParse(items);

        if (!result.success) {
          console.error(
            '[TS-9] Dynamic product DIFF:',
            result.error.issues
              .slice(0, 5)
              .map((i) =>
                `${i.path.join('.')}: ${i.message}`
              )
              .join('; ')
          );
        }
        expect(result.success).toBe(true);
        console.log(
          `[TS-9] Dynamic products: ` +
            `${items.length} items, contract OK`
        );
      }
    );

    it(
      'static products match contract',
      async () => {
        const ctx = getContext();
        const token =
          ctx.backendClient.getToken();
        if (!token) return;

        const raw = await backendPost<{
          code: number;
          data: unknown[];
        }>(
          '/api/open/app/product/query/v2',
          { proxyType: [101, 102, 103] },
          token
        );

        const items = raw.data ?? [];
        if (items.length === 0) {
          console.warn(
            '[TS-9] No static products'
          );
          return;
        }

        const schema = z.array(
          BackendStaticProductSchema
        );
        const result = schema.safeParse(items);

        if (!result.success) {
          console.error(
            '[TS-9] Static product DIFF:',
            result.error.issues
              .slice(0, 5)
              .map((i) =>
                `${i.path.join('.')}: ${i.message}`
              )
              .join('; ')
          );
        }
        expect(result.success).toBe(true);
        console.log(
          `[TS-9] Static products: ` +
            `${items.length} items, contract OK`
        );
      }
    );

    it(
      'area hierarchy matches contract',
      async () => {
        const ctx = getContext();
        const token =
          ctx.backendClient.getToken();
        if (!token) return;

        const raw = await backendGet<{
          code: number;
          data: unknown;
        }>(
          '/api/areas/hierarchy',
          token
        );

        const result =
          BackendAreaSchema.safeParse(raw.data);

        if (!result.success) {
          console.error(
            '[TS-9] Area hierarchy DIFF:',
            result.error.issues
              .slice(0, 5)
              .map((i) =>
                `${i.path.join('.')}: ${i.message}`
              )
              .join('; ')
          );
        }
        expect(result.success).toBe(true);
        console.log(
          '[TS-9] Area hierarchy: contract OK'
        );
      }
    );
  }
);
