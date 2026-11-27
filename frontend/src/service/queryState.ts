export function periodDays(params: URLSearchParams, fallback: 7 | 30 = 30, key = "days"): 7 | 30 {
  return params.get(key) === "7" ? 7 : params.get(key) === "30" ? 30 : fallback;
}

export function periodSearch(search: string, days: 7 | 30): string {
  const params = new URLSearchParams(search);
  params.set("days", String(days));
  return "?" + params;
}

export function pageNumber(value: string | null): number {
  return value && /^(0|[1-9][0-9]{0,5})$/.test(value) ? Number(value) : 0;
}

export function calendarDate(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value ? value : "";
}

export function appIds(value: string | null): string {
  if (!value || value.length > 1100) return "";
  const ids = value.split(",");
  return ids.length <= 100 && ids.every(id => /^[1-9][0-9]{0,9}$/.test(id) && Number(id) <= 4294967295) && new Set(ids).size === ids.length ? value : "";
}

export function videoId(value: string | null): string {
  return value && /^[A-Za-z0-9_-]{11}$/.test(value) ? value : "";
}
