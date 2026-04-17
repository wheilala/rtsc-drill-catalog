import fs from "node:fs/promises";
import path from "node:path";
import { ensureDir, extensionFromUrl, slugify } from "./utils.mjs";

const workspaceRoot = process.cwd();

export function notionFileUrl(file) {
  if (!file) {
    return null;
  }
  if (file.type === "external") {
    return file.external?.url || null;
  }
  if (file.type === "file") {
    return file.file?.url || null;
  }
  return null;
}

export async function downloadFileToPublic({ file, folderSegments, baseName }) {
  const sourceUrl = notionFileUrl(file);
  if (!sourceUrl) {
    return null;
  }

  const ext = extensionFromUrl(sourceUrl, ".bin");
  const safeBaseName = slugify(baseName) || "asset";
  const relativePath = path.posix.join(...folderSegments, `${safeBaseName}${ext}`);
  const absolutePath = path.join(workspaceRoot, "public", relativePath.replaceAll("/", path.sep));

  await ensureDir(path.dirname(absolutePath));

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download media (${response.status}) from ${sourceUrl}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(absolutePath, buffer);

  return `/${relativePath}`;
}
