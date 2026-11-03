/**
 * YU-47/48 QA: browser/share links may receive standard UTM attribution.
 * Ignore only known bounded UTM metadata when validating analysis route state.
 *
 * This helper never validates channel/topic values, never reads browser storage,
 * never authorizes analysis, and never removes arbitrary unknown parameters.
 * Both pages must continue to validate their own exact application fields.
 */
const UTM_KEYS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
]);
const MAX_UTM_VALUE_LENGTH = 128;
const CONTROL = /[\u0000-\u001f\u007f]/;

export function withoutAllowedUtmTracking(
  search: URLSearchParams,
): URLSearchParams | null {
  const filtered = new URLSearchParams();
  const seenUtm = new Set<string>();

  for (const [key, value] of search) {
    if (key.startsWith("utm_")) {
      // Unknown, duplicate, empty, oversized or control-bearing UTM fields
      // fail closed instead of silently weakening the application URL contract.
      if (!UTM_KEYS.has(key) || seenUtm.has(key) ||
          value.length === 0 || value.length > MAX_UTM_VALUE_LENGTH ||
          CONTROL.test(value)) return null;
      seenUtm.add(key);
      continue;
    }
    // Application-specific duplicates and unknown keys remain untouched.
    filtered.append(key, value);
  }
  return filtered;
}
