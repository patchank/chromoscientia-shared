type Obj = Record<string, unknown>;

function getByPath(obj: Obj, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Obj)[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function interpolate(
  template: string,
  params: Record<string, string | number> | undefined
): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = params[key];
    return value !== undefined ? String(value) : `{{${key}}}`;
  });
}

export function translate(
  messages: Obj,
  key: string,
  params?: Record<string, string | number>
): string {
  const raw = getByPath(messages, key);
  const str = raw ?? key;
  return interpolate(str, params);
}
