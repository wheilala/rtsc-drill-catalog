import fs from "node:fs/promises";
import path from "node:path";
import { retrievePage } from "./client.mjs";
import { renderPageBlocksToHtml } from "./blocks.mjs";
import { clipText, emptyDir, escapeYamlString, slugify, writeText } from "./utils.mjs";
import { getTitleProperty, richTextToPlain } from "./normalize.mjs";

const allowlistPath = path.join(process.cwd(), "content", "config", "session-plan-allowlist.json");
const sessionPlansOutputDir = path.join(process.cwd(), "content", "generated", "session-plans");

async function readAllowlist() {
  const raw = await fs.readFile(allowlistPath, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.pageIds) ? parsed.pageIds : [];
}

function titleFromPage(page) {
  const titleProperty = getTitleProperty(page);
  return richTextToPlain(titleProperty?.title || []);
}

function buildFrontmatter(data) {
  return [
    "---",
    `id: ${escapeYamlString(data.id)}`,
    `slug: ${escapeYamlString(data.slug)}`,
    `title: ${escapeYamlString(data.title)}`,
    `summary: ${escapeYamlString(data.summary)}`,
    `sourceNotionUrl: ${escapeYamlString(data.sourceNotionUrl)}`,
    `heroImage: ${escapeYamlString(data.heroImage || "")}`,
    "---",
    ""
  ].join("\n");
}

export async function syncSessionPlans() {
  const pageIds = await readAllowlist();
  await emptyDir(sessionPlansOutputDir);

  let synced = 0;
  let warnings = 0;

  for (const pageId of pageIds) {
    try {
      const page = await retrievePage(pageId);
      const title = titleFromPage(page) || "Untitled Session Plan";
      const slug = slugify(title) || pageId;
      const rendered = await renderPageBlocksToHtml(pageId, slug);
      const summary = clipText(rendered.summary, 180);

      const frontmatter = buildFrontmatter({
        id: page.id,
        slug,
        title,
        summary,
        sourceNotionUrl: page.url,
        heroImage: rendered.heroImage
      });

      await writeText(path.join(sessionPlansOutputDir, `${slug}.md`), `${frontmatter}${rendered.html}\n`);
      synced += 1;
      warnings += rendered.warnings;
    } catch (error) {
      warnings += 1;
      console.warn(`Session plan sync failed for ${pageId}: ${error.message}`);
    }
  }

  return {
    synced,
    warnings
  };
}
