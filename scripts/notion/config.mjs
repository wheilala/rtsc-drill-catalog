const notionVersion = process.env.NOTION_VERSION || "2025-09-03";

export function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getConfig() {
  return {
    notionToken: getRequiredEnv("NOTION_TOKEN"),
    notionVersion,
    drillDataSourceId: getRequiredEnv("NOTION_DRILL_DATA_SOURCE_ID")
  };
}
