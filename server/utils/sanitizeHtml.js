import sanitizeHtml from "sanitize-html";

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
      span: ["class", "style"],
      "*": ["style"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel", "data"],
    disallowedTagsMode: "discard",
    parseStyleAttributes: true,
  });
