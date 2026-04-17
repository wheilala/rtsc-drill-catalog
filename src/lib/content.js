import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const workspaceRoot = process.cwd();
const drillsDir = path.join(workspaceRoot, "content", "generated", "drills");
const sessionPlansDir = path.join(workspaceRoot, "content", "generated", "session-plans");

marked.setOptions({
  breaks: true
});

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
    "h1",
    "h2",
    "h3",
    "h4",
    "img",
    "figure",
    "figcaption",
    "code",
    "pre"
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt"],
    code: ["class"]
  },
  allowedSchemes: ["http", "https", "mailto"]
};

async function safeReadDir(dirPath) {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function safeReadFile(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

export async function getAllDrills() {
  const entries = await safeReadDir(drillsDir);
  const items = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json") || entry.name === "index.json") {
      continue;
    }
    const raw = await safeReadFile(path.join(drillsDir, entry.name));
    if (!raw) {
      continue;
    }
    items.push(JSON.parse(raw));
  }

  items.sort((left, right) => {
    if ((left.sortOrder || 0) !== (right.sortOrder || 0)) {
      return (left.sortOrder || 0) - (right.sortOrder || 0);
    }
    return left.title.localeCompare(right.title);
  });

  return items;
}

export async function getDrillBySlug(slug) {
  const filePath = path.join(drillsDir, `${slug}.json`);
  const raw = await safeReadFile(filePath);
  return raw ? JSON.parse(raw) : null;
}

export async function getAllSessionPlans() {
  const entries = await safeReadDir(sessionPlansDir);
  const items = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    const raw = await safeReadFile(path.join(sessionPlansDir, entry.name));
    if (!raw) {
      continue;
    }

    const parsed = matter(raw);
    const html = sanitizeHtml(await marked(parsed.content || ""), sanitizeOptions);
    items.push({
      ...parsed.data,
      slug: parsed.data.slug || entry.name.replace(/\.md$/, ""),
      html
    });
  }

  items.sort((left, right) => left.title.localeCompare(right.title));
  return items;
}

export async function getSessionPlanBySlug(slug) {
  const filePath = path.join(sessionPlansDir, `${slug}.md`);
  const raw = await safeReadFile(filePath);
  if (!raw) {
    return null;
  }
  const parsed = matter(raw);
  return {
    ...parsed.data,
    slug: parsed.data.slug || slug,
    html: sanitizeHtml(await marked(parsed.content || ""), sanitizeOptions)
  };
}

export async function getAllTopics() {
  const drills = await getAllDrills();
  return [...new Set(drills.flatMap((drill) => drill.topics || []))].sort((left, right) =>
    left.localeCompare(right)
  );
}
