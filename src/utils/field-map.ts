export const FIELD_MAP: Record<string, string> = {
  // General
  payload: 'p',
  type: 't',
  timestamp: 'ts',
  sessionId: 'sid',
  url: 'url',
  orientation: 'o',
  siteHeight: 'sd',
  data: 'd',

  // Identity
  fingerprint: 'fp',
  bot: 'b',
  tabId: 'tb',

  // Viewport + Screen (HTTP only)
  screen: 's',      // contains: w, h
  viewport: 'v',    // contains: w, h
  scrollDepth: 'dp',

  incognito: 'i',
  lang: 'l',
  cookies: 'c',

  // Click
  rule: 'r',
  path: 'pa',
  tag: 'tg',
  text: 'txt',
  element: 'el',     // contains x, y, w, h

  // Rage container (click + keypress)
  rage: 'ra',
  count: 'c',
  hesitation: 'he',

  // Keypress
  key: 'k',
  code: 'co',
  meta: 'me',

  width: 'w',
  height: 'h',

  // Visual Data Flag
  visualData: 'vd',
};