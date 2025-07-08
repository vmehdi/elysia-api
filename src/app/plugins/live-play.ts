import { Elysia } from 'elysia';
import type { ServerWebSocket } from 'bun';
import { registerSocket, unregisterSocket, getSocketsByFingerprint } from '@/utils/socket-fingerprint-map';
import { prisma } from '@/utils/prisma';

export const setupLivePlyer: any = {
  async open(ws: ServerWebSocket) {
    const urlString = (ws.data as any)?.url || '';
    const url = new URL(urlString || 'http://localhost');
    const fp = url.searchParams.get('fp');
    if (!fp) {
      ws.send(JSON.stringify({ error: 'Missing fingerprint' }));
      ws.close();
      return;
    }

    registerSocket(fp, ws, 'player');

    ws.send(JSON.stringify({ status: 'connected', fp }));

    try {
      const visitor = await prisma.visitor.findUnique({
        where: { fingerprintHash: fp },
      });

      if (!visitor) {
        console.warn('[ws] No visitor found for', fp);
        ws.send(JSON.stringify({ type: 'recording', data: { rr_events: [] } }));
        return;
      }

      const recording = await prisma.recordingStart.findFirst({
        where: {
          fingerprint: fp
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (!recording || !recording.meta || !recording.snapshot || !recording.firstChunk) {
        console.warn('[ws] No matching rrweb events found for', fp);
        return;
      }

      const essentialEvents = [
        recording.meta,
        recording.snapshot,
        ...(Array.isArray(recording.firstChunk) ? recording.firstChunk : [])
      ];

      ws.send(JSON.stringify({
        type: 'recording',
        data: { rr_events: essentialEvents }
      }));
    } catch (err) {
      console.error("Failed to load initial events:", err);
    }
  },

  close(ws: ServerWebSocket) {
    unregisterSocket(ws);
  }
}

export function streamToPlayer(fp: string, data: any) {
  const sockets = getSocketsByFingerprint(fp, 'player');
  if (!sockets?.length) return;

  const payload = JSON.stringify({ type: 'recording', data });
  for (const ws of sockets) {
    try {
      ws.send(payload);
    } catch { }
  }
}

export const livePlayerPlugin = new Elysia()
  .get('/play', () => Bun.file('./public/play.html'))
  .get('/live', () => Bun.file('./public/live.html'));