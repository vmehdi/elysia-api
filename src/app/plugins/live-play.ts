import { Elysia } from 'elysia';
import type { ServerWebSocket } from 'bun';
import { registerSocket, unregisterSocket, getSocketsByFingerprint } from '@/utils/socket-fingerprint-map';
import { prisma } from '@/utils/prisma';
import logger from '@/utils/logger';

export const setupLivePlyer: any = {
  async open(ws: ServerWebSocket) {
    const urlString = (ws.data as any)?.url || '';
    const url = new URL(urlString || 'http://localhost');
    const fp = url.searchParams.get('fp');

    logger.info(`🎬 [Live Player] Opening connection for fingerprint: ${fp}`);

    if (!fp) {
      logger.warn('❌ [Live Player] Missing fingerprint parameter');
      ws.send(JSON.stringify({ error: 'Missing fingerprint' }));
      ws.close();
      return;
    }

    registerSocket(fp, ws, 'player');
    logger.info(`✅ [Live Player] Socket registered for fingerprint: ${fp}`);

    ws.send(JSON.stringify({ status: 'connected', fp }));

    try {
      // Check if visitor exists
      const visitor = await prisma.visitor.findUnique({
        where: { fingerprintHash: fp },
      });

      if (!visitor) {
        logger.warn(`⚠️ [Live Player] No visitor found for fingerprint: ${fp}`);
        ws.send(JSON.stringify({
          type: 'recording',
          data: { vb: [] },
          message: 'No visitor found for this fingerprint'
        }));
        return;
      }

      logger.info(`✅ [Live Player] Visitor found for fingerprint: ${fp}`);

      // Try to get initial recording data
      const recording = await prisma.recordingStart.findFirst({
        where: {
          fingerprint: fp
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (!recording) {
        logger.warn(`⚠️ [Live Player] No recording found for fingerprint: ${fp}`);
        ws.send(JSON.stringify({
          type: 'recording',
          data: { vb: [] },
          message: 'No recording data found for this fingerprint'
        }));
        return;
      }

      logger.info(`📹 [Live Player] Recording found for fingerprint: ${fp}`, {
        hasMeta: !!recording.meta,
        hasSnapshot: !!recording.snapshot,
        hasFirstChunk: !!recording.firstChunk,
        createdAt: recording.createdAt
      });

      if (!recording.meta || !recording.snapshot || !recording.firstChunk) {
        logger.warn(`⚠️ [Live Player] Incomplete recording data for fingerprint: ${fp}`);
        ws.send(JSON.stringify({
          type: 'recording',
          data: { vb: [] },
          message: 'Incomplete recording data found'
        }));
        return;
      }

      const essentialEvents = [
        recording.meta,
        recording.snapshot,
        ...(Array.isArray(recording.firstChunk) ? recording.firstChunk : [])
      ];

      // Validate events before sending
      const validEvents = essentialEvents.filter(ev => {
        if (!ev || typeof ev !== 'object') return false;
        const event = ev as any;
        return event.t !== undefined && event.d !== undefined;
      });

      logger.info(`🎯 [Live Player] Valid events count: ${validEvents.length}/${essentialEvents.length}`);

      if (validEvents.length === 0) {
        logger.warn(`❌ [Live Player] No valid events found for fingerprint: ${fp}`);
        ws.send(JSON.stringify({
          type: 'recording',
          data: { vb: [] },
          message: 'No valid events found in recording data'
        }));
        return;
      }

      // Send initial events to player
      ws.send(JSON.stringify({
        type: 'recording',
        data: { vb: validEvents },
        message: `Loaded ${validEvents.length} initial events successfully`
      }));

      logger.info(`✅ [Live Player] Initial events sent for fingerprint: ${fp}`);

    } catch (err) {
      logger.error(`🚨 [Live Player] Failed to load initial events for fingerprint: ${fp}`, err);
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Failed to load recording data',
        details: err instanceof Error ? err.message : 'Unknown error'
      }));
    }
  },

  close(ws: ServerWebSocket) {
    const urlString = (ws.data as any)?.url || '';
    const url = new URL(urlString || 'http://localhost');
    const fp = url.searchParams.get('fp');
    logger.info(`🔌 [Live Player] Closing connection for fingerprint: ${fp}`);
    unregisterSocket(ws);
  }
}

export function streamToPlayer(fp: string, data: any) {
  logger.info(`📡 [StreamToPlayer] Attempting to stream data for fingerprint: ${fp}`, {
    dataType: typeof data,
    hasVb: !!data?.vb,
    vbLength: Array.isArray(data?.vb) ? data.vb.length : 'not array'
  });

  const sockets = getSocketsByFingerprint(fp, 'player');

  if (!sockets?.length) {
    logger.warn(`⚠️ [StreamToPlayer] No player sockets found for fingerprint: ${fp}`);
    return;
  }

  logger.info(`🎯 [StreamToPlayer] Found ${sockets.length} player socket(s) for fingerprint: ${fp}`);

  const payload = JSON.stringify({ type: 'recording', data });

  for (const ws of sockets) {
    try {
      ws.send(payload);
      logger.info(`✅ [StreamToPlayer] Data sent to player for fingerprint: ${fp}`);
    } catch (error) {
      logger.error(`❌ [StreamToPlayer] Failed to send data to player for fingerprint: ${fp}`, error);
    }
  }
}

export const livePlayerPlugin = new Elysia()
  .get('/play', () => Bun.file('./public/play.html'))
  .get('/live', () => Bun.file('./public/live.html'));