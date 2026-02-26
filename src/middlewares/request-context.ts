import { randomUUID } from 'crypto';

export default (_config: any, { strapi }: { strapi: any }) => {
  return async (ctx: any, next: any) => {
    const start = Date.now();
    const incoming =
      ctx.request?.header?.['x-request-id'] ||
      ctx.request?.headers?.['x-request-id'] ||
      ctx.headers?.['x-request-id'];
    const requestId =
      typeof incoming === 'string' && incoming.trim() ? incoming.trim() : randomUUID();
    ctx.state.requestId = requestId;
    ctx.set('X-Request-Id', requestId);
    ctx.set('X-Upstream', 'strapi');

    try {
      await next();
    } finally {
      const responseTime = Date.now() - start;
      ctx.set('X-Response-Time', `${responseTime}ms`);
      const log = {
        method: ctx.method,
        path: ctx.request?.path || ctx.path,
        status: ctx.status,
        responseTime,
        requestId,
      };
      strapi.log.info(JSON.stringify(log));
    }
  };
};
