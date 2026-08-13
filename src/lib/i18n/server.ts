import { cookies } from "next/headers";
import {
  t,
  ts,
  isValidLocale,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  type Locale,
} from "./dictionaries";

export { t, ts, DEFAULT_LOCALE, LOCALE_COOKIE };
export type { Locale };

/** Read the active locale from the request cookie (server components). */
export async function getLocale(): Promise<Locale> {
  const c = await cookies();
  const v = c.get(LOCALE_COOKIE)?.value;
  return isValidLocale(v) ? v : DEFAULT_LOCALE;
}

/** Bound translator for server components: const { t, ts } = await getT(); */
export async function getT(): Promise<{
  locale: Locale;
  t: (k: string) => unknown;
  ts: (k: string) => string;
}> {
  const locale = await getLocale();
  return {
    locale,
    t: (k: string) => t(locale, k),
    ts: (k: string) => ts(locale, k),
  };
}
