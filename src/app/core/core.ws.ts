import type { ServerWebSocket } from 'bun';
import { prisma } from '@/utils/prisma';
import { sendToKafka } from '@/utils/kafka-producer';
import { isEncrypted, decryptPayload } from '@/utils/decryption-service';
import logger from '@/utils/logger';
import { saveAuth, getAuth, removeAuth } from '@/utils/wsAuthMap';
import { registerSocket, unregisterSocket } from '@/utils/socket-fingerprint-map';
import { streamToPlayer } from '@/app/plugins/live-play';

function extractToken(ws: ServerWebSocket<any>): string {
  return (ws.data as any)?.query?.token || '';
}

export const MessageType = {
  IDENTIFY: 'idn',
  CONFIG: 'cfg',
  TRACKER_TOGGLE: 'tgl',
  COMMAND: 'cmd'
} as const;

const RealTimeEventTypes = new Set(['tr', 'th']);

const simulatedMessages = [
  {
    delay: 10000,
    message: {
      t: MessageType.TRACKER_TOGGLE,
      p: { tn: 'recording', s: true },
    },
  },
  {
    delay: 20000,
    message: {
      t: MessageType.TRACKER_TOGGLE,
      p: { tn: 'heatmap', s: false },
    },
  },
  {
    delay: 30000,
    message: {
      t: MessageType.TRACKER_TOGGLE,
      p: { tn: 'dnd', s: false },
    },
  },
  {
    delay: 60000,
    message: {
      t: MessageType.TRACKER_TOGGLE,
      p: { tn: 'heatmap', s: true },
    },
  },
  {
    delay: 120000,
    message: {
      t: MessageType.TRACKER_TOGGLE,
      p: { tn: 'heatmap', s: false },
    },
  },
  {
    delay: 15000,
    message: {
      t: MessageType.COMMAND,
      p: {
        t: 'recording',
        a: 'makeSnapshot'
      }
    }
  },
  {
    delay: 60000 * 60, // 1 houre
    message: {
      t: MessageType.TRACKER_TOGGLE,
      p: {
        t: 'recording',
        a: false
      }
    }
  }
];

export const setupLiveWebSocket = {
  beforeHandle: async ({ query, jwtTrack, ws }: any) => {
    const token = query?.token;

    if (!token) {
      ws.send(JSON.stringify({ t: 'error', p: { message: 'Missing token' } }));
      ws.close();
      return;
    }

    const payload = await jwtTrack.verify(token);
    if (!payload?.domainId || payload.type !== 'TRACKING_TOKEN') {
      ws.send(JSON.stringify({ t: 'error', p: { message: 'Invalid token' } }));
      ws.close();
      return;
    }

    saveAuth(token, { domainId: payload.domainId });
  },

  open: async (ws: ServerWebSocket<any>) => {
    try {
      const token = extractToken(ws);
      if (!token) return;

      for (const { delay, message } of simulatedMessages) {
        setTimeout(() => {
          try {
            ws.send(JSON.stringify(message));
            logger.info(`🧪 [Simulated WS] after ${delay / 1000}s`, message);
          } catch (e) {
            logger.error('❌ Failed to send simulated WS message', e);
          }
        }, delay);
      }

      ws.send(JSON.stringify({ t: 'ping', p: { msg: 'connected' } }));
    } catch (err) {
      logger.error('🚨 WS open error: ', err);
      ws.close();
    }
  },

  close(ws: ServerWebSocket<any>) {
    const token = extractToken(ws);
    logger.info('❌ WebSocket connection closed');
    removeAuth(token);
    unregisterSocket(ws);
  },

  async message(ws: ServerWebSocket<any>, raw: any) {
    try {
      const token = extractToken(ws);
      const auth = getAuth(token);

      let payload = raw;
      if (isEncrypted(payload)) {
        payload = await decryptPayload(payload);
      }

      if (raw.t === MessageType.IDENTIFY) {

        if (!auth) {
          ws.send(JSON.stringify({ t: 'warn', p: { message: 'Auth not ready, retrying...' } }));
          return;
        }

        if (!auth?.domainId) {
          ws.send(JSON.stringify({ t: 'error', p: { message: 'Missing domain ID' } }));
          ws.close();
          return;
        }

        if (payload?.fp) registerSocket(payload.fp, ws, 'client');

        const domain = await prisma.domain.findUnique({
          where: { id: auth.domainId },
          include: { rules: true, trackers: true },
        });

        if (!domain) {
          ws.send(JSON.stringify({ t: 'error', p: { message: 'Domain not found' } }));
          ws.close();
          return;
        }

        const config = {
          trackers: domain.trackers.map((t) => t.name),
          keys: ['Enter', 'Escape', 'Tab'],
          rules: {
            click: domain.rules
              .filter((r) => r.type === 'tc')
              .map((r) => ({
                name: r.name,
                css_selector: r.css_selector,
                regex_selector: r.regex_attribute && r.regex_pattern
                  ? { attribute: r.regex_attribute, pattern: r.regex_pattern }
                  : undefined,
              })),
            impression: domain.rules
              .filter((r) => r.type === 'ti')
              .map((r) => ({
                name: r.name,
                css_selector: r.css_selector,
                regex_selector: r.regex_attribute && r.regex_pattern
                  ? { attribute: r.regex_attribute, pattern: r.regex_pattern }
                  : undefined,
              })),
          },
          stable: ['data-seg-id', 'data-product-id'],
        };

        ws.send(JSON.stringify({ t: MessageType.CONFIG, p: config }));
        return;
      }

      if (raw.t === 'ping') {
        ws.send(JSON.stringify({ t: 'pong' }));
        return;
      }

      if (RealTimeEventTypes.has(raw.t)) {
        if (payload?.fp) {
          streamToPlayer(payload.fp, { vb: payload.p.vb });
        }
        await sendToKafka('tracking-events', payload);
        logger.info(`✅ [WS] Real-time event '${raw.t}' sent to Kafka`);
      } else {
        logger.warn(`❓ Unknown or disallowed WebSocket message type: "${raw.t}"`);
      }
    } catch (error) {
      logger.error('🚨 WS message error: ', error);
    }
  }
};