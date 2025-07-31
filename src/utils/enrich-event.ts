
export function enrichEvent(payload: any, meta: { ip?: string; headers?: any }) {
  return {
    ...payload,
    eid: crypto.randomUUID(),
    ip: meta.ip || null,
    ua: meta.headers?.["user-agent"] || null,
    re: meta.headers?.["referer"] || null,
    tss: Date.now(),
  };
}