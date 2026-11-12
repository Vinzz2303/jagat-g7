/** Validate structured provider output without guessing or repairing its meaning. */
export function normalizeModelResponse(value: unknown, jsonMode: boolean): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Model returned an empty or missing response.");
  }
  const text = value.trim();
  if (!jsonMode) return text;
  // Accept only an entire JSON document or a single complete Markdown JSON fence.
  const fenced = text.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
  let parsed: unknown;
  try {
    parsed = JSON.parse(fenced ? fenced[1]! : text);
  } catch {
    throw new Error("Model returned invalid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Model response must be a JSON object.");
  }
  return JSON.stringify(parsed);
}
