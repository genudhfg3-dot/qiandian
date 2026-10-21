/** Normalize documented MiMo API IDs only; custom endpoints keep case-sensitive IDs. */
export function normalizeModelName(baseUrl: string, model: string) {
  const trimmed = model.trim()
  try {
    if (new URL(baseUrl).hostname === 'api.xiaomimimo.com' && /^mimo-v2\.(5|6)(-pro|-flash|-pro-ultraspeed)?$/i.test(trimmed)) return trimmed.toLowerCase()
  } catch { /* Let the request layer report invalid endpoint settings. */ }
  return trimmed
}
