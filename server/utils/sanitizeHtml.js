import sanitizeHtml from "sanitize-html";

// Strip all HTML tags, returning plain text suitable for embedding
export const stripHtml = (value = "") =>
  sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });

export const sanitizeRichText = (value = "") =>
  sanitizeHtml(value, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "h1",
      "h2",
      "u",
      "span",
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      span: ["class"],
    },
    allowedSchemesByTag: {
      a: ["http", "https", "mailto", "tel"],
      img: ["http", "https", "data"],
    },
    disallowedTagsMode: "discard",
  });
