const { GoogleGenerativeAI } = require("@google/generative-ai");
const slugify = require("../utils/slugify");

/**
 * AI News Generator Service
 * Integrates with Google Gemini to generate news articles and metadata.
 */

module.exports = ({ strapi }) => ({
  async generateNewsArticle(draft, retry = true) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are an expert Hindi news editor. Based on the following draft news report, generate a complete, SEO-optimized news article in formal Hindi.
      
      DRAFT: "${draft}"
      
      REQUIREMENTS:
      1. Language: Formal Hindi (Standard News Style).
      2. Content Length: 600–900 words.
      3. Style: Professional, objective, and engaging.
      4. SEO: Optimized for Google News and Google Discover.
      5. Output Format: STRICT VALID JSON ONLY. No markdown blocks, no extra text.
      
      FIELDS TO GENERATE IN JSON:
      - title: A compelling Hindi headline.
      - slug: English lowercase hyphen-separated slug based on the title.
      - excerpt: A 2-3 sentence summary of the news in Hindi.
      - content: The full news article in HTML format (using <p>, <h2>, <ul>, <li> tags).
      - category: Primary category name (e.g., Politics, Crime, Sports, Entertainment, Local).
      - news_category: Hindi translation of the category.
      - author: A professional Hindi name or "Rampur News Desk".
      - tags: Array of 5-8 relevant Hindi keywords.
      - is_breaking: Boolean (true if the news is urgent/breaking).
      - is_featured: Boolean (true if it's a major story).
      - seo_title: Hindi SEO title (max 60 chars).
      - meta_description: Hindi meta description (max 155 chars).
      - focus_keyword: The main Hindi keyword for this news.
      - news_keywords: Comma-separated Hindi keywords for news meta tags.
      - canonical_url: Use "/" followed by the English slug.
      - discover_eligible: Boolean (true if content is high quality and engaging).
      - short_headline: Hindi headline for mobile/Discover (max 110 chars).
      - read_time: Estimated read time in minutes (integer).
      - location: Primary location of the news (e.g., रामपुर, उत्तर प्रदेश).
      - schema_json: A valid JSON object for Schema.org NewsArticle (as a string or object).
      - image_alt_text: Descriptive Hindi alt text for the main image.

      IMPORTANT: Ensure the JSON is perfectly formatted. If the draft is too short, expand it with relevant context and background information while maintaining factual accuracy.
    `;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();

      // Clean up potential markdown formatting if Gemini includes it
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();

      let articleData;
      try {
        articleData = JSON.parse(text);
      } catch (parseError) {
        strapi.log.error("Failed to parse Gemini JSON response. Retrying...");
        if (retry) {
          return this.generateNewsArticle(draft, false);
        }
        throw new Error("Invalid JSON response from AI model.");
      }

      // Final validation and processing
      articleData.slug = slugify(articleData.title);
      
      // Log successful generation
      strapi.log.info(`AI Article Generated: ${articleData.title}`);
      
      return articleData;
    } catch (error) {
      strapi.log.error(`AI Generation Error: ${error.message}`);
      throw error;
    }
  },

  async generateSummary(content) {
    const apiKey = process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Based on the following news content, generate a short summary and social media captions in Hindi.
      
      CONTENT: "${content}"
      
      RETURN JSON ONLY:
      {
        "summary": "2 line concise summary",
        "social_caption": "Engaging caption with emojis for Facebook/Instagram",
        "whatsapp_caption": "Informative caption for WhatsApp groups"
      }
    `;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(text);
    } catch (error) {
      strapi.log.error(`AI Summary Error: ${error.message}`);
      return null;
    }
  },

  async generateDiscoverHeadline(content) {
    const apiKey = process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Create one emotional and curiosity-driven Hindi headline for Google Discover from this news:
      
      CONTENT: "${content}"
      
      Return the headline as a plain string. Max 110 characters.
    `;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      strapi.log.error(`AI Discover Headline Error: ${error.message}`);
      return null;
    }
  }
});
