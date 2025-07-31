export interface WSContext {
  domainId: string;
  fingerprint?: string;
  ip?: string | null;
  ua?: string | null;
  re?: string | null;
  tb?: string | null;
  url?: string | null;
  l?: string | null;
  s?: { width: number; height: number } | null;
}

const sessionMap = new Map<string, WSContext>();

export const saveSessionContext = (token: string, data: WSContext) => {
  sessionMap.set(token, data);
};

export const getSessionContext = (token: string): WSContext | undefined => {
  return sessionMap.get(token);
};

export const removeSessionContext = (token: string) => {
  sessionMap.delete(token);
};