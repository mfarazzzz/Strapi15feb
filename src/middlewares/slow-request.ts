export default (config: any, { strapi }: { strapi: any }) => {
  const threshold = typeof config?.thresholdMs === 'number' ? config.thresholdMs : 1000;
  return async (ctx: any, next: any) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;
    if (duration >= threshold) {
      strapi.log.warn(`[slow] ${ctx.method} ${ctx.request?.url} ${duration}ms`);
    }
  };
};
