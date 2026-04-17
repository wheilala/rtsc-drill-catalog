export function withBase(path) {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const normalizedPath = String(path || "").startsWith("/") ? String(path) : `/${String(path || "")}`;
  return `${base}${normalizedPath}` || "/";
}
