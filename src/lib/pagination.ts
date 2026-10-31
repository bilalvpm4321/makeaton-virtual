export const PAGE_SIZE = 25;

type SearchParams = Record<string, string | string[] | undefined>;

/** First value of a search param, trimmed. Undefined when missing or blank. */
export function getParam(searchParams: SearchParams, key: string): string | undefined {
  const raw = searchParams[key];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return value ? value : undefined;
}

export function getPage(searchParams: SearchParams): { page: number; skip: number; take: number } {
  const parsed = parseInt(getParam(searchParams, "page") ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
  return { page, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE };
}
