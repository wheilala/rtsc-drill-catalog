import path from "node:path";
import { getConfig } from "./config.mjs";
import { queryDataSource } from "./client.mjs";
import { downloadFileToPublic } from "./media.mjs";
import {
  fallbackSummary,
  normalizeSlug,
  parseVideoLink,
  richTextProperty,
  sanitizeRichHtml,
  titleText
} from "./normalize.mjs";
import { emptyDir, writeJson } from "./utils.mjs";

const drillsOutputDir = path.join(process.cwd(), "content", "generated", "drills");

function checkboxProperty(page, propertyName) {
  const property = page.properties?.[propertyName];
  if (!property) {
    return null;
  }
  return property.type === "checkbox" ? Boolean(property.checkbox) : null;
}

async function queryAllPublishedDrills(dataSourceId) {
  const results = [];
  let nextCursor;

  do {
    const response = await queryDataSource(dataSourceId, {
      page_size: 100,
      start_cursor: nextCursor,
      filter: {
        property: "Publish to Coaches",
        checkbox: {
          equals: true
        }
      }
    });

    results.push(...response.results);
    nextCursor = response.has_more ? response.next_cursor : null;
  } while (nextCursor);

  return results;
}

async function queryAllDrillsFallback(dataSourceId) {
  const results = [];
  let nextCursor;

  do {
    const response = await queryDataSource(dataSourceId, {
      page_size: 100,
      start_cursor: nextCursor
    });

    results.push(...response.results);
    nextCursor = response.has_more ? response.next_cursor : null;
  } while (nextCursor);

  return results;
}

export async function syncDrills() {
  const config = getConfig();
  await emptyDir(drillsOutputDir);

  let pages;
  let missingPublishProperty = false;

  try {
    pages = await queryAllPublishedDrills(config.drillDataSourceId);
  } catch (error) {
    if (String(error.message).includes("Publish to Coaches")) {
      missingPublishProperty = true;
      pages = await queryAllDrillsFallback(config.drillDataSourceId);
    } else {
      throw error;
    }
  }

  let synced = 0;
  let skipped = 0;
  let fallbackSlugs = 0;
  let missingDiagrams = 0;
  let unsupportedVideoLinks = 0;
  const manifest = [];

  for (const page of pages) {
    const title = titleText(page);
    if (!title) {
      skipped += 1;
      continue;
    }

    const publish = checkboxProperty(page, "Publish to Coaches");
    if (!missingPublishProperty && !publish) {
      skipped += 1;
      continue;
    }

    const { slug, usedFallback } = normalizeSlug(page, richTextProperty(page, "Slug"));
    if (usedFallback) {
      fallbackSlugs += 1;
    }

    const summary = String(richTextProperty(page, "Summary Desc") || "").trim();
    const setupHtml = sanitizeRichHtml(richTextProperty(page, "Setup"));
    const instructionsHtml = sanitizeRichHtml(richTextProperty(page, "Instructions"));
    const progressionsHtml = sanitizeRichHtml(richTextProperty(page, "Progressions"));
    const emphasisHtml = sanitizeRichHtml(richTextProperty(page, "Emphasis"));
    const diagramFiles = richTextProperty(page, "Diagram");
    const diagramFile = Array.isArray(diagramFiles) ? diagramFiles[0] : null;

    let diagram = null;
    if (diagramFile) {
      try {
        const localPath = await downloadFileToPublic({
          file: diagramFile,
          folderSegments: ["media", "drills", slug],
          baseName: "diagram-1"
        });
        if (localPath) {
          diagram = {
            localPath,
            alt: `${title} diagram`
          };
        }
      } catch (error) {
        missingDiagrams += 1;
        console.warn(`Diagram download failed for "${title}": ${error.message}`);
      }
    } else {
      missingDiagrams += 1;
    }

    const videos = parseVideoLink(richTextProperty(page, "Link"));
    if (videos.some((video) => video.provider !== "youtube" && video.provider !== "facebook")) {
      unsupportedVideoLinks += 1;
    }

    const record = {
      id: page.id,
      slug,
      title,
      publish: missingPublishProperty ? true : Boolean(publish),
      featured: Boolean(checkboxProperty(page, "Featured")),
      sortOrder: Number(richTextProperty(page, "Sort Order") || 0),
      summary: summary || fallbackSummary(instructionsHtml, setupHtml),
      topics: richTextProperty(page, "Training Topics") || [],
      groupSize: {
        min: richTextProperty(page, "Min Group Size") ?? null,
        max: richTextProperty(page, "Max Group Size") ?? null
      },
      pitchSize: String(richTextProperty(page, "Pitch Size") || ""),
      setupHtml,
      instructionsHtml,
      progressionsHtml,
      emphasisHtml,
      diagram,
      videos,
      source: {
        notionPageUrl: page.url,
        lastSyncedAt: new Date().toISOString()
      }
    };

    await writeJson(path.join(drillsOutputDir, `${slug}.json`), record);

    manifest.push({
      slug: record.slug,
      title: record.title,
      topics: record.topics,
      summary: record.summary,
      sortOrder: record.sortOrder,
      featured: record.featured
    });

    synced += 1;
  }

  manifest.sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }
    return left.title.localeCompare(right.title);
  });

  await writeJson(path.join(drillsOutputDir, "index.json"), {
    items: manifest,
    generatedAt: new Date().toISOString(),
    warnings: {
      missingPublishProperty
    }
  });

  if (missingPublishProperty) {
    console.warn(
      'The "Publish to Coaches" property was not found. All drills were synced. Add that property to limit published drills.'
    );
  }

  return {
    synced,
    skipped,
    fallbackSlugs,
    missingDiagrams,
    unsupportedVideoLinks
  };
}
