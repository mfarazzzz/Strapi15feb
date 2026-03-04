"use strict";

/**
 * Rate limit middleware for AI generation.
 * Limits AI requests to 30 per minute globally.
 */

const requestsMap = new Map();
const LIMIT = 30; // Max 30 requests per minute
const WINDOW_MS = 60 * 1000; // 1 minute window

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    const now = Date.now();
    const globalRequests = requestsMap.get("global_ai_requests") || [];
    
    // Filter out expired timestamps
    const recentRequests = globalRequests.filter(timestamp => (now - timestamp) < WINDOW_MS);
    
    if (recentRequests.length >= LIMIT) {
      strapi.log.warn("AI Rate limit exceeded globally.");
      return ctx.tooManyRequests("AI rate limit reached. Please wait a minute and try again.");
    }
    
    // Record this request
    recentRequests.push(now);
    requestsMap.set("global_ai_requests", recentRequests);
    
    return await next();
  };
};
