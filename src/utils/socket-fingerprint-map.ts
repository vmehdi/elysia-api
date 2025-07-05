import type { WebSocket } from 'bun';

// A mapping from fingerprint to set of active WebSocket connections
const fpToSockets = new Map<string, Set<WebSocket>>();

/**
 * Register a socket under a specific fingerprint
 */
export function registerSocket(fp: string, ws: WebSocket) {
  if (!fpToSockets.has(fp)) {
    fpToSockets.set(fp, new Set());
  }
  fpToSockets.get(fp)!.add(ws);
}

/**
 * Unregister a socket (called when connection closes)
 */
export function unregisterSocket(ws: WebSocket) {
  for (const [fp, sockets] of fpToSockets.entries()) {
    if (sockets.has(ws)) {
      sockets.delete(ws);
      if (sockets.size === 0) {
        fpToSockets.delete(fp);
      }
      break;
    }
  }
}

/**
 * Send a message to all sockets for a given fingerprint
 */
export function sendToFingerprint(fp: string, data: any) {
  const sockets = fpToSockets.get(fp);
  if (!sockets) return;

  const message = typeof data === 'string' ? data : JSON.stringify(data);

  for (const ws of sockets) {
    try {
      ws.send(message);
    } catch (err) {
      console.error('Failed to send to socket', err);
    }
  }
}

/**
 * Get number of active sockets (optional utility)
 */
export function getActiveSocketCount(): number {
  let count = 0;
  for (const sockets of fpToSockets.values()) {
    count += sockets.size;
  }
  return count;
}

/**
 * For debugging: get all fingerprints currently connected
 */
export function getAllFingerprints(): string[] {
  return [...fpToSockets.keys()];
}