/**
 * Crawlers, link-preview fetchers, monitors and HTTP libraries. Korean in-app browsers
 * (KAKAOTALK, NAVER(inapp), DaumApps) are real users and intentionally do not match.
 */
const BOT_UA_PATTERN =
  /bot\b|bot\/|crawl|spider|slurp|scrap|yeti\/|daumoa|facebookexternalhit|embedly|bingpreview|headless|phantomjs|selenium|puppeteer|playwright|lighthouse|pagespeed|pingdom|uptime|statuscake|python-|curl\/|wget\/|httpclient|okhttp|go-http-client|java\/|axios\/|node-fetch|undici|postmanruntime|libwww|^mozilla\/5\.0$/i;

/** True for requests that must not count as ad impressions/clicks (missing UA counts as bot). */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  const ua = userAgent?.trim() ?? '';
  if (ua.length < 10) return true;
  return BOT_UA_PATTERN.test(ua);
}
