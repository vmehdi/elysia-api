export const FIELD_MAP = {
  // General
  payload: 'p',
  type: 't',
  timestamp: 'ts',
  sequentialId: 'sid',
  url: 'url',
  orientation: 'o',
  siteHeight: 'h',
  scrollDepth: 'sd',
  data: 'd',

  width: 'w',
  height: 'h',

  // Identity
  fingerprint: 'fp',
  bot: 'b',
  tabId: 'tb',
  incognito: 'i',
  lang: 'l',
  cookies: 'c',

  // Viewport + Screen (HTTP only)
  screen: 's',      // { w, h }
  viewport: 'v',    // { w, h }

  // Click & Path
  rule: 'r',
  path: 'pa',
  tag: 'tg',
  text: 'txt',
  element: 'el',     // contains x, y, w, h

  // Rage / Keypress
  rage: 'ra',
  count: 'c',
  hesitation: 'he',
  key: 'k',
  code: 'co',
  meta: 'me',

  // rrweb
  visualData: 'vd',

  props: 'pr',
  userAgent: 'ua',
  referrer: 're'
};