import sanitizeHtml from "sanitize-html";
import { retrieveBlockChildren } from "./client.mjs";
import { downloadFileToPublic, notionFileUrl } from "./media.mjs";
import { htmlToPlainText, repairRichTextArtifacts, sanitizeRichHtml } from "./normalize.mjs";
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

function richTextToPlain(richText = []) {
  return richText.map((item) => item.plain_text || "").join("");
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

async function renderChildrenIfPresent(block, context) {
  if (!block.has_children) {
    return "";
  }
  const children = await fetchAllChildren(block.id);
  return renderBlocks(children, context);
}

function pushSummaryFromHtml(html, context) {
  if (!context.summary && html.trim()) {
    context.summary = clipText(sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }), 180);
  }
}

function isSectionLabel(text) {
  return /^(setup|play|progressions?|rotation|talking points|coaching points|organization|block\s+\d+)/i.test(
    String(text || "").trim()
  );
}

function renderStructuredParagraph(blockValue, context) {
  const plainText = repairRichTextArtifacts(richTextToPlain(blockValue.rich_text)).trim();
  if (!plainText) {
    return "";
  }

  if (isSectionLabel(plainText)) {
    return `<h3>${escapeHtml(plainText)}</h3>`;
  }

  const richHtml = repairRichTextArtifacts(richTextToHtml(blockValue.rich_text));
  const structuredHtml = sanitizeRichHtml(richHtml);
  const summarySource = structuredHtml || `<p>${escapeHtml(plainText)}</p>`;
  pushSummaryFromHtml(summarySource, context);

  if (structuredHtml) {
    const normalizedPlain = htmlToPlainText(structuredHtml);
    if (normalizedPlain && normalizedPlain.toLowerCase() === plainText.toLowerCase() && !structuredHtml.includes("<ol") && !structuredHtml.includes("<ul")) {
      return `<p>${richHtml}</p>`;
    }
    return structuredHtml;
  }

  return `<p>${richHtml}</p>`;
}

async function renderListBlock(block, context, listType) {
  const blockValue = block[block.type];
  const text = richTextToHtml(blockValue.rich_text);
  const childrenHtml = await renderChildrenIfPresent(block, context);
  const childContent = childrenHtml ? `<div class="nested-list">${childrenHtml}</div>` : "";
  return text || childContent ? `<li>${text}${childContent}</li>` : "";
}

async function renderCalloutBlock(block, context) {
  const text = richTextToHtml(block.callout.rich_text);
  const childrenHtml = await renderChildrenIfPresent(block, context);
  const icon = renderCalloutIcon(block.callout.icon);
  const content = [text ? `<p>${text}</p>` : "", childrenHtml].filter(Boolean).join("\n");
  return content ? `<blockquote class="session-callout">${icon}${content}</blockquote>` : "";
}

function renderCalloutIcon(icon) {
  if (!icon) {
    return "";
  }
  if (icon.type === "emoji" && icon.emoji) {
    return `<span class="callout-icon" aria-hidden="true">${escapeHtml(icon.emoji)}</span>`;
  }
  return "";
}

async function renderColumnList(block, context) {
  const columns = await fetchAllChildren(block.id);
  const renderedColumns = [];

  for (const column of columns) {
    const columnChildren = await fetchAllChildren(column.id);
    const html = await renderBlocks(columnChildren, context);
    if (html.trim()) {
      renderedColumns.push(`<div class="session-column">${html}</div>`);
    }
  }

  if (!renderedColumns.length) {
    return "";
  }

  return `<div class="session-columns">${renderedColumns.join("")}</div>`;
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
      return renderStructuredParagraph(blockValue, context);
    }
    case "bulleted_list_item":
      return renderListBlock(block, context, "ul");
    case "numbered_list_item":
      return renderListBlock(block, context, "ol");
    case "to_do":
      return renderListBlock(block, context, "ul");
    case "callout":
      return renderCalloutBlock(block, context);
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
    case "quote": {
      const html = richTextToHtml(blockValue.rich_text);
      return html ? `<blockquote>${html}</blockquote>` : "";
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
    case "column_list":
      return renderColumnList(block, context);
    case "column": {
      const children = await fetchAllChildren(block.id);
      return renderBlocks(children, context);
    }
    case "table_of_contents":
    case "breadcrumb":
    case "unsupported":
      return "";
    default:
      context.warnings += 1;
      return "";
  }
}

export async function renderBlocks(blocks, context) {
  const rendered = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];

    if (block.type === "bulleted_list_item" || block.type === "numbered_list_item" || block.type === "to_do") {
      const listTag = block.type === "numbered_list_item" ? "ol" : "ul";
      const items = [];

      while (
        index < blocks.length &&
        (blocks[index].type === block.type || (block.type === "to_do" && blocks[index].type === "to_do"))
      ) {
        const itemHtml = await renderListBlock(blocks[index], context, listTag);
        if (itemHtml) {
          items.push(itemHtml);
        }
        index += 1;
      }

      index -= 1;

      if (items.length) {
        rendered.push(`<${listTag}>${items.join("")}</${listTag}>`);
      }
      continue;
    }

    const html = await renderBlock(block, context);
    if (!html) {
      continue;
    }

    const currentListMatch = html.match(/^<(ol|ul)><li>([\s\S]*)<\/li><\/\1>$/);
    const lastHtml = rendered[rendered.length - 1];
    const previousListMatch = lastHtml?.match(/^<(ol|ul)>([\s\S]*)<\/\1>$/);

    if (currentListMatch && previousListMatch && currentListMatch[1] === previousListMatch[1]) {
      rendered[rendered.length - 1] = `<${currentListMatch[1]}>${previousListMatch[2]}<li>${currentListMatch[2]}</li></${currentListMatch[1]}>`;
      continue;
    }

    rendered.push(html);
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
