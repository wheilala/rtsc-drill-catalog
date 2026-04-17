import { getConfig } from "./config.mjs";

const apiBaseUrl = "https://api.notion.com/v1";

function getHeaders() {
  const config = getConfig();
  return {
    Authorization: `Bearer ${config.notionToken}`,
    "Notion-Version": config.notionVersion,
    "Content-Type": "application/json"
  };
}

async function notionFetch(path, init = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...getHeaders(),
      ...(init.headers || {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Notion API request failed (${response.status}): ${text}`);
  }

  return response.json();
}

export async function queryDataSource(dataSourceId, body = {}) {
  return notionFetch(`/data_sources/${dataSourceId}/query`, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export async function retrievePage(pageId) {
  return notionFetch(`/pages/${pageId}`, {
    method: "GET"
  });
}

export async function retrieveBlockChildren(blockId, startCursor) {
  const search = new URLSearchParams();
  if (startCursor) {
    search.set("start_cursor", startCursor);
  }
  search.set("page_size", "100");
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return notionFetch(`/blocks/${blockId}/children${suffix}`, {
    method: "GET"
  });
}
