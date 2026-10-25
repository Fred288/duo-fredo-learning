import { de } from './de';

export type MessageKey = keyof typeof de;

/** UI-Text per Schlüssel; `{name}` wird durch params ersetzt. */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  return de[key].replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}
