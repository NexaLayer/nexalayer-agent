import { FastifyInstance } from 'fastify';

export function registerTolerantJsonParser(
  app: FastifyInstance
): void {
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_request, body, done) => {
      const source = String(body ?? '').trim();
      if (!source) {
        done(null, undefined);
        return;
      }
      try {
        done(null, JSON.parse(source));
      } catch (error) {
        const parseError = error as Error & {
          statusCode?: number;
          code?: string;
        };
        parseError.statusCode = 400;
        parseError.code = 'FST_ERR_CTP_INVALID_JSON_BODY';
        done(parseError, undefined);
      }
    }
  );
}
