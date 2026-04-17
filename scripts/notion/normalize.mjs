import sanitizeHtml from "sanitize-html";
import { clipText, slugify } from "./utils.mjs";

const sanitizeOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "em",
    "b",
    "i",
    "ul",
    "ol",
    "li",
    "a",
    "blockquote",
    "hr",
    "h2",
    "h3",
    "h4",
    "img"
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt"]
  },
  allowedSchemes: ["http", "https", "mailto"]
};

export function sanitizeRichHtml(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  return sanitizeHtml(raw, sanitizeOptions);
}

export function htmlToPlainText(value) {
  return sanitizeHtml(String(value || ""), {
    allowedTags: [],
    allowedAttributes: {}
  })
    .replace(/\s+/g, " ")
    .trim();
}

export function fallbackSummary(...values) {
  for (const value of values) {
    const plain = htmlToPlainText(value);
    if (plain) {
      return clipText(plain, 180);
    }
  }
  return "";
}

export function getTitleProperty(page) {
  return Object.values(page.properties || {}).find((property) => property.type === "title");
}

export function getPropertyValue(page, propertyName) {
  return page.properties?.[propertyName] || null;
}

export function titleText(page) {
  const property = getTitleProperty(page);
  return richTextToPlain(property?.title || []);
}

export function richTextProperty(page, propertyName) {
  const property = getPropertyValue(page, propertyName);
  if (!property) {
    return "";
  }

  if (property.type === "rich_text") {
    return richTextToPlain(property.rich_text);
  }

  if (property.type === "title") {
    return richTextToPlain(property.title);
  }

  if (property.type === "number") {
    return property.number;
  }

  if (property.type === "url") {
    return property.url || "";
  }

  if (property.type === "checkbox") {
    return Boolean(property.checkbox);
  }

  if (property.type === "multi_select") {
    return property.multi_select.map((option) => option.name);
  }

  if (property.type === "files") {
    return property.files || [];
  }

  return "";
}

export function richTextToPlain(richText) {
  return (richText || []).map((item) => item.plain_text || "").join("").trim();
}

export function normalizeSlug(page, explicitSlug) {
  const fallback = slugify(titleText(page));
  return {
    slug: slugify(explicitSlug) || fallback,
    usedFallback: !slugify(explicitSlug)
  };
}

export function parseVideoLink(urlValue) {
  const sourceUrl = String(urlValue || "").trim();
  if (!sourceUrl) {
    return [];
  }

  let parsed;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return [
      {
        provider: "external",
        sourceUrl
      }
    ];
  }

  const host = parsed.hostname.replace(/^www\./, "");

  if (host === "youtube.com" || host === "m.youtube.com") {
    const videoId = parsed.searchParams.get("v");
    if (videoId) {
      return [
        {
          provider: "youtube",
          sourceUrl,
          embedUrl: `https://www.youtube.com/embed/${videoId}`
        }
      ];
    }
  }

  if (host === "youtu.be") {
    const videoId = parsed.pathname.split("/").filter(Boolean)[0];
    if (videoId) {
      return [
        {
          provider: "youtube",
          sourceUrl,
          embedUrl: `https://www.youtube.com/embed/${videoId}`
        }
      ];
    }
  }

  if (host.endsWith("facebook.com") || host === "fb.watch") {
    return [
      {
        provider: "facebook",
        sourceUrl
      }
    ];
  }

  return [
    {
      provider: "external",
      sourceUrl
    }
  ];
}
