module.exports = {
  routes: [
    {
      method: "POST",
      path: "/ai/generate",
      handler: "ai.generateArticle",
      config: {
        policies: [],
        middlewares: ["api::ai.rate-limit"], // Rate limit for AI generation
      },
    },
    {
      method: "POST",
      path: "/ai/summarize",
      handler: "ai.summarize",
      config: {
        policies: [],
      },
    },
    {
      method: "POST",
      path: "/ai/discover",
      handler: "ai.discoverHeadline",
      config: {
        policies: [],
      },
    },
  ],
};
