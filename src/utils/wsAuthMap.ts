const authMap = new Map<string, { domainId: string; fingerprint?: string; ip?: string | null; ua?: string | null; re?: string | null }>();

export const saveAuth = (token: string, data: { domainId: string; fingerprint?: string; ip?: string | null; ua?: string | null; re?: string | null }) => {
  authMap.set(token, data);
};

export const getAuth = (token: string) => {
  return authMap.get(token);
};

export const removeAuth = (token: string) => {
  authMap.delete(token);
};