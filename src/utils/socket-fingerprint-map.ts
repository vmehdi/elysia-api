// file: utils/socket-fingerprint-map.ts
import type { ServerWebSocket } from 'bun';

// fp -> Set of { socket, role }
type Role = 'client' | 'player';

interface SocketInfo {
  socket: ServerWebSocket;
  role: Role;
}

const fpSocketMap = new Map<string, Set<SocketInfo>>();

/**
 * ثبت یک WebSocket جدید برای یک اثر انگشت مشخص
 */
export function registerSocket(fp: string, ws: ServerWebSocket, role: Role = 'client') {
  if (!fpSocketMap.has(fp)) fpSocketMap.set(fp, new Set());
  fpSocketMap.get(fp)!.add({ socket: ws, role });
}

/**
 * حذف یک WebSocket از تمام اثرانگشت‌ها
 */
export function unregisterSocket(ws: ServerWebSocket) {
  for (const [fp, set] of fpSocketMap.entries()) {
    for (const info of set) {
      if (info.socket === ws) {
        set.delete(info);
        if (set.size === 0) fpSocketMap.delete(fp);
        return;
      }
    }
  }
}

/**
 * دریافت WebSocketهای فعال برای یک اثرانگشت خاص (با نقش اختیاری)
 */
export function getSocketsByFingerprint(fp: string, role?: Role): ServerWebSocket[] {
  const set = fpSocketMap.get(fp);
  if (!set) return [];
  return [...set]
    .filter(info => !role || info.role === role)
    .map(info => info.socket);
}

/**
 * ارسال پیام به تمام WebSocketهای مرتبط با یک اثرانگشت خاص
 */
export function sendToFingerprint(fp: string, data: any, role?: Role) {
  const sockets = getSocketsByFingerprint(fp, role);
  const message = typeof data === 'string' ? data : JSON.stringify(data);
  for (const ws of sockets) {
    try {
      ws.send(message);
    } catch (err) {
      console.error('❌ Failed to send to socket', err);
    }
  }
}

/**
 * شمارش تمام WebSocketهای فعال
 */
export function getActiveSocketCount(): number {
  let count = 0;
  for (const set of fpSocketMap.values()) count += set.size;
  return count;
}

/**
 * دریافت تمام اثرانگشت‌هایی که WebSocket دارند
 */
export function getAllFingerprints(): string[] {
  return [...fpSocketMap.keys()];
}

export function getFingerprintBySocket(ws: ServerWebSocket): string | null {
  for (const [fp, set] of fpSocketMap.entries()) {
    for (const info of set) {
      if (info.socket === ws) return fp;
    }
  }
  return null;
}