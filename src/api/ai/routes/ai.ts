export default {
  routes: [
    {
      method: "POST",
      path: "/ai/generate",
      handler: "ai.generateArticle",
      config: {
        auth: false,
        policies: [],
        middlewares: ["api::ai.rate-limit"], // Rate limit for AI generation
      },
    },
    {
      method: "POST",
      path: "/ai/summarize",
      handler: "ai.summarize",
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: "POST",
      path: "/ai/discover",
      handler: "ai.discoverHeadline",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
