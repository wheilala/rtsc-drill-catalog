import sanitizeHtml from "sanitize-html";
import { retrieveBlockChildren } from "./client.mjs";
import { downloadFileToPublic, notionFileUrl } from "./media.mjs";
import { clipText, slugify } from "./utils.mjs";

function richTextToHtml(richText = []) {
  return richText
    .map((item) => {
      const text = item.plain_text || "";
      const href = item.href;
      const annotations = item.annotations || {};
      let value = escapeHtml(text);

      if (annotations.bold) value = `<strong>${value}</strong>`;
      if (annotations.italic) value = `<em>${value}</em>`;
      if (annotations.code) value = `<code>${value}</code>`;
      if (href) value = `<a href="${escapeAttribute(href)}" target="_blank" rel="noreferrer">${value}</a>`;
      return value;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value) {
  return String(value).replaceAll('"', "&quot;");
}

async function fetchAllChildren(blockId) {
  let cursor;
  const results = [];

  do {
    const response = await retrieveBlockChildren(blockId, cursor);
    results.push(...response.results);
    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);

  return results;
}

async function renderImageBlock(block, slug, imageIndex) {
  const image = block.image;
  const localPath = await downloadFileToPublic({
    file:
      image.type === "external"
        ? { type: "external", external: image.external }
        : { type: "file", file: image.file },
    folderSegments: ["media", "session-plans", slug],
    baseName: `image-${imageIndex}`
  });

  if (!localPath) {
    return "";
  }

  const caption = image.caption?.length ? richTextToHtml(image.caption) : "";
  return `<figure><img src="${localPath}" alt="" />${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
}

async function renderBlock(block, context) {
  const type = block.type;
  const blockValue = block[type];

  switch (type) {
    case "heading_1":
      return `<h2>${richTextToHtml(blockValue.rich_text)}</h2>`;
    case "heading_2":
      return `<h3>${richTextToHtml(blockValue.rich_text)}</h3>`;
    case "heading_3":
      return `<h4>${richTextToHtml(blockValue.rich_text)}</h4>`;
    case "paragraph": {
      const html = richTextToHtml(blockValue.rich_text);
      if (!context.summary && html.trim()) {
        context.summary = clipText(sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }), 180);
      }
      return html ? `<p>${html}</p>` : "";
    }
    case "bulleted_list_item": {
      const text = richTextToHtml(blockValue.rich_text);
      return text ? `<ul><li>${text}</li></ul>` : "";
    }
    case "numbered_list_item": {
      const text = richTextToHtml(blockValue.rich_text);
      return text ? `<ol><li>${text}</li></ol>` : "";
    }
    case "to_do": {
      const text = richTextToHtml(blockValue.rich_text);
      return text ? `<ul><li>${text}</li></ul>` : "";
    }
    case "callout": {
      const text = richTextToHtml(blockValue.rich_text);
      return text ? `<blockquote>${text}</blockquote>` : "";
    }
    case "divider":
      return "<hr />";
    case "image": {
      context.imageCount += 1;
      const html = await renderImageBlock(block, context.slug, context.imageCount);
      if (html && !context.heroImage) {
        const srcMatch = html.match(/src="([^"]+)"/);
        if (srcMatch) {
          context.heroImage = srcMatch[1];
        }
      }
      return html;
    }
    case "bookmark":
      return blockValue.url
        ? `<p><a href="${escapeAttribute(blockValue.url)}" target="_blank" rel="noreferrer">${escapeHtml(blockValue.url)}</a></p>`
        : "";
    case "embed": {
      const url = blockValue.url || notionFileUrl(blockValue);
      return url
        ? `<p><a href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">${escapeHtml(url)}</a></p>`
        : "";
    }
    case "toggle": {
      const title = richTextToHtml(blockValue.rich_text);
      const children = block.has_children ? await fetchAllChildren(block.id) : [];
      const renderedChildren = await renderBlocks(children, context);
      return `<h3>${title}</h3>${renderedChildren}`;
    }
    default:
      context.warnings += 1;
      return "";
  }
}

export async function renderBlocks(blocks, context) {
  const rendered = [];
  for (const block of blocks) {
    rendered.push(await renderBlock(block, context));
  }
  return rendered.filter(Boolean).join("\n\n");
}

export async function renderPageBlocksToHtml(pageId, slugSeed) {
  const blocks = await fetchAllChildren(pageId);
  const context = {
    slug: slugify(slugSeed) || pageId,
    summary: "",
    heroImage: "",
    imageCount: 0,
    warnings: 0
  };
  const html = await renderBlocks(blocks, context);
  return {
    html,
    summary: context.summary,
    heroImage: context.heroImage,
    warnings: context.warnings
  };
}
