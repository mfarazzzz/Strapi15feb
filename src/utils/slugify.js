/**
 * Utility to convert string to URL-friendly slug
 * Rules: lowercase, spaces -> hyphen, remove special characters
 */
module.exports = (text) => {
  if (!text) return "";
  
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")           // Replace spaces with -
    .replace(/[^\w\-]+/g, "")       // Remove all non-word chars
    .replace(/\-\-+/g, "-")         // Replace multiple - with single -
    .replace(/^-+/, "")             // Trim - from start of text
    .replace(/-+$/, "");            // Trim - from end of text
};
