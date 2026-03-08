const { GoogleGenerativeAI } = require("@google/generative-ai");

/*
Utility: Convert text into URL friendly slug
*/
const slugify = (text) => {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
};

module.exports = ({ strapi }) => ({

/*
MAIN AI NEWS GENERATOR
Creates full newsroom package from a draft
*/
async generateNewsPackage(draft) {

try {

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
throw new Error("GEMINI_API_KEY missing in environment variables");
}

const genAI = new GoogleGenerativeAI(apiKey);

/*
Latest fast production model
*/
const model = genAI.getGenerativeModel({
model: "gemini-2.5-flash",
generationConfig: {
temperature: 0.7,
topP: 0.9,
maxOutputTokens: 4096
}
});

/*
AI Prompt
*/
const prompt = `
You are a senior Hindi news editor working for a digital news organization.

Using the draft below, generate a COMPLETE newsroom publishing package.

DRAFT:
"${draft}"

Rules:
- Write in professional Hindi news style
- Article length: 600–900 words
- Optimized for Google News & Google Discover
- Use HTML formatting (<p>, <h2>, <ul>, <li>)
- Avoid speculation
- Maintain journalistic tone

Return STRICT JSON ONLY.

JSON STRUCTURE:

{
"title":"",
"slug":"",
"short_headline":"",
"excerpt":"",
"content_html":"",
"category":"",
"news_category":"",
"author":"",
"location":"",
"tags":[],
"is_breaking":false,
"is_featured":false,

"seo":{
"seo_title":"",
"meta_description":"",
"focus_keyword":"",
"news_keywords":""
},

"discover":{
"discover_headline":"",
"discover_eligible":true
},

"social":{
"facebook_caption":"",
"twitter_caption":"",
"whatsapp_caption":""
},

"schema_json":"",
"image_alt_text":"",
"read_time":0
}
`;

const result = await model.generateContent(prompt);

const response = await result.response;

let text = response.text();

/*
Remove markdown formatting
*/
text = text.replace(/```json/g, "").replace(/```/g, "").trim();

/*
Extract JSON safely
*/
const jsonMatch = text.match(/\{[\s\S]*\}/);

if (!jsonMatch) {
throw new Error("AI response did not return valid JSON");
}

let articleData;

try {
articleData = JSON.parse(jsonMatch[0]);
} catch (err) {
strapi.log.error("JSON parse error:", jsonMatch[0]);
throw new Error("Invalid JSON from AI");
}

/*
Ensure slug exists
*/
articleData.slug = slugify(articleData.title || "news-article");

/*
Ensure read time
*/
if (!articleData.read_time) {

const wordCount = articleData.content_html
.replace(/<[^>]*>/g, "")
.split(/\s+/).length;

articleData.read_time = Math.max(1, Math.round(wordCount / 200));

}

/*
Log success
*/
strapi.log.info(`AI Article Generated: ${articleData.title}`);

return articleData;

} catch (error) {

strapi.log.error("AI Generation Error:", error);

/*
Fail-safe return so CMS never crashes
*/
return {

title: "AI Generation Failed",
slug: "ai-generation-failed",
short_headline: "",
excerpt: "",
content_html: "<p>AI content generation failed. Please retry.</p>",
category: "",
news_category: "",
author: "Rampur News Desk",
location: "",
tags: [],
is_breaking: false,
is_featured: false,

seo: {
seo_title: "",
meta_description: "",
focus_keyword: "",
news_keywords: ""
},

discover: {
discover_headline: "",
discover_eligible: false
},

social: {
facebook_caption: "",
twitter_caption: "",
whatsapp_caption: ""
},

schema_json: "",
image_alt_text: "",
read_time: 1

};

}

},

/*
SUMMARY GENERATOR
Creates social captions
*/
async generateSummary(content) {

try {

const apiKey = process.env.GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
model: "gemini-2.5-flash"
});

const prompt = `
Based on the following news article create summary and captions.

CONTENT:
"${content}"

Return JSON only:

{
"summary":"",
"facebook_caption":"",
"twitter_caption":"",
"whatsapp_caption":""
}
`;

const result = await model.generateContent(prompt);

const response = await result.response;

let text = response.text();

text = text.replace(/```json/g, "").replace(/```/g, "").trim();

const jsonMatch = text.match(/\{[\s\S]*\}/);

if (!jsonMatch) return null;

return JSON.parse(jsonMatch[0]);

} catch (error) {

strapi.log.error("Summary generation failed:", error);

return null;

}

},

/*
DISCOVER HEADLINE GENERATOR
*/
async generateDiscoverHeadline(content) {

try {

const apiKey = process.env.GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
model: "gemini-2.5-flash"
});

const prompt = `
Create a curiosity driven Hindi headline for Google Discover.

Max length: 110 characters.

CONTENT:
"${content}"
`;

const result = await model.generateContent(prompt);

const response = await result.response;

return response.text().trim();

} catch (error) {

strapi.log.error("Discover headline error:", error);

return null;

}

}

});