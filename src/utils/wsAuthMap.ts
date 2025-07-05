const authMap = new Map<string, { domainId: string }>();

export const saveAuth = (token: string, data: { domainId: string }) => {
  authMap.set(token, data);
};

export const getAuth = (token: string) => {
  return authMap.get(token);
};

export const removeAuth = (token: string) => {
  authMap.delete(token);
};