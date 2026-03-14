import { randomUUID } from 'crypto';

// NOTE: Event loop monitoring is handled centrally in src/index.ts bootstrap
// to avoid duplicate monitoring and potential memory leaks from histogram accumulation

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
      const metricsEnabled = String(process.env.OBSERVABILITY_LOG_METRICS ?? '')
        .trim()
        .toLowerCase();
      if (metricsEnabled === '1' || metricsEnabled === 'true' || metricsEnabled === 'yes') {
        const pool = strapi?.db?.connection?.client?.pool;
        const poolStats =
          pool && typeof pool === 'object'
            ? {
                used: typeof pool.numUsed === 'function' ? pool.numUsed() : undefined,
                free: typeof pool.numFree === 'function' ? pool.numFree() : undefined,
                pendingAcquires:
                  typeof pool.numPendingAcquires === 'function' ? pool.numPendingAcquires() : undefined,
                pendingCreates:
                  typeof pool.numPendingCreates === 'function' ? pool.numPendingCreates() : undefined,
              }
            : undefined;
        (log as any).pid = process.pid;
        (log as any).uptimeSec = Math.round(process.uptime());
        (log as any).memory = process.memoryUsage();
        (log as any).eventLoopDelayMs =
          typeof (eventLoopDelay as any)?.mean === 'number'
            ? Math.round(((eventLoopDelay as any).mean as number) / 1e6)
            : undefined;
        (log as any).dbPool = poolStats;
      }
      strapi.log.info(JSON.stringify(log));
    }
  };
};
