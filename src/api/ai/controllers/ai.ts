import { factories } from "@strapi/strapi";

export default factories.createCoreController("api::ai.ai", ({ strapi }) => ({
  async generateArticle(ctx) {
    const { draft } = ctx.request.body;

    if (!draft) {
      return ctx.badRequest("Draft text is required.");
    }

    try {
      // Import dynamically using absolute path to bypass relative resolution issues in dist
      const path = require("path");
      const servicePath = path.join(process.cwd(), "src/api/ai/services/ai-news-generator.js");
      const aiNewsGenerator = require(servicePath);
      const generator = aiNewsGenerator({ strapi });
      const articleData = await generator.generateNewsArticle(draft);
      
      return ctx.send(articleData);
    } catch (error) {
      strapi.log.error(`AI Controller Error: ${error.message}`);
      return ctx.internalServerError("Failed to generate AI news article.");
    }
  },

  async summarize(ctx) {
    const { content } = ctx.request.body;

    if (!content) {
      return ctx.badRequest("Content is required for summarization.");
    }

    try {
      const path = require("path");
      const servicePath = path.join(process.cwd(), "src/api/ai/services/ai-news-generator.js");
      const aiNewsGenerator = require(servicePath);
      const generator = aiNewsGenerator({ strapi });
      const summary = await generator.generateSummary(content);
      
      return ctx.send(summary);
    } catch (error) {
      strapi.log.error(`AI Controller Summarize Error: ${error.message}`);
      return ctx.internalServerError("Failed to generate AI summary.");
    }
  },

  async discoverHeadline(ctx) {
    const { content } = ctx.request.body;

    if (!content) {
      return ctx.badRequest("Content is required for Google Discover headline.");
    }

    try {
      const path = require("path");
      const servicePath = path.join(process.cwd(), "src/api/ai/services/ai-news-generator.js");
      const aiNewsGenerator = require(servicePath);
      const generator = aiNewsGenerator({ strapi });
      const headline = await generator.generateDiscoverHeadline(content);
      
      return ctx.send({ headline });
    } catch (error) {
      strapi.log.error(`AI Controller Discover Error: ${error.message}`);
      return ctx.internalServerError("Failed to generate Google Discover headline.");
    }
  },
}));
