export function enrichEvent(payload: any, meta: { ip?: string; headers?: any }) {
  const headers = meta.headers || {};
  const ua = headers?.get ? headers.get("user-agent") : headers?.["user-agent"] || null;
  const re = headers?.get ? headers.get("referer") : headers?.["referer"] || null;

  return {
    ...payload,
    eid: crypto.randomUUID(),
    ip: meta.ip || null,
    ua,
    re,
    tss: Date.now(),
  };
}