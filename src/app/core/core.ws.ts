import { randomUUID } from 'crypto';
import type { ServerWebSocket } from 'bun';
import { prisma } from '@/utils/prisma';
import { sendToKafka } from '@/utils/kafka-producer';
import { isEncrypted, decryptPayload } from '@/utils/decryption-service';
import logger from '@/utils/logger';
import { saveSessionContext, getSessionContext, removeSessionContext } from '@/utils/wsSessionStore';
import { registerSocket, unregisterSocket } from '@/utils/socket-fingerprint-map';
import { streamToPlayer } from '@/app/plugins/live-play';
import { enrichEvent } from '@/utils/enrich-event';
import { formatForLog } from '@/utils/helper';

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
  // {
  //   delay: 10000,
  //   message: {
  //     t: MessageType.TRACKER_TOGGLE,
  //     p: { tn: 'tr', s: true },
  //   },
  // },
  {
    delay: 20000,
    message: {
      t: MessageType.TRACKER_TOGGLE,
      p: { tn: 'th', s: false },
    },
  },
  {
    delay: 30000,
    message: {
      t: MessageType.TRACKER_TOGGLE,
      p: { tn: 'td', s: false },
    },
  },
  {
    delay: 60000,
    message: {
      t: MessageType.TRACKER_TOGGLE,
      p: { tn: 'th', s: true },
    },
  },
  {
    delay: 120000,
    message: {
      t: MessageType.TRACKER_TOGGLE,
      p: { tn: 'th', s: false },
    },
  },
  // {
  //   delay: 15000,
  //   message: {
  //     t: MessageType.COMMAND,
  //     p: {
  //       t: 'tr',
  //       a: 'makeSnapshot'
  //     }
  //   }
  // },
  // {
  //   delay: 60000 * 60, // 1 houre
  //   message: {
  //     t: MessageType.TRACKER_TOGGLE,
  //     p: {
  //       t: 'tr',
  //       a: false
  //     }
  //   }
  // }
];

export const setupLiveWebSocket = {
  beforeHandle: async ({ query, jwtTrack, request }: any) => {
    const token = query?.token;

    if (!token) {
      throw new Error('Missing token');
    }

    const payload = await jwtTrack.verify(token);
    if (!payload?.domainId || payload.type !== 'TRACKING_TOKEN') {
      throw new Error('Invalid token');
    }

    // Extract headers after verifying token
    const ua = request.headers.get("user-agent") || null;
    const re = request.headers.get("referer") || null;
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      request.ip ||
      null;

    saveSessionContext(token, {
      domainId: payload.domainId,
      ip,
      ua,
      re
    });
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
    removeSessionContext(token);
    unregisterSocket(ws);
  },

  async message(ws: ServerWebSocket<any>, raw: any) {
    const token = extractToken(ws);
    const sessionContext = getSessionContext(token);
    try {

      if (raw.t === MessageType.IDENTIFY) {

        if (sessionContext?.domainId) {
          saveSessionContext(token, {
            ...sessionContext,
            domainId: sessionContext.domainId,
            fingerprint: raw.fp || sessionContext.fingerprint,
            tb: raw.tb || sessionContext.tb || null,
            url: raw.url || sessionContext.url || null,
            re: raw.rf || sessionContext.re || null,
            s: raw.s || sessionContext.s || null,
            l: raw.l || sessionContext.l || null
          });
        }

        if (!sessionContext) {
          ws.send(JSON.stringify({ t: 'warn', p: { message: 'Auth not ready, retrying...' } }));
          return;
        }

        if (!sessionContext?.domainId) {
          ws.send(JSON.stringify({ t: 'error', p: { message: 'Missing domain ID' } }));
          ws.close();
          return;
        }

        if (raw?.fp) registerSocket(raw.fp, ws, 'client');

        const domain = await prisma.domain.findUnique({
          where: { id: sessionContext.domainId },
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
        let livePayload = raw;
        // If sessionContext is missing important fields, warn in logs
        if (!sessionContext?.url || !sessionContext?.tb || !sessionContext?.s || !sessionContext?.l) {
          logger.warn(`⚠️ Session context incomplete for token ${token}: ${formatForLog(sessionContext)}`);
        }
        if (raw?.p && isEncrypted(raw.p)) {
          try {
            livePayload = { ...raw, p: await decryptPayload(raw.p) };
          } catch (err) {
            logger.error('❌ Failed to decrypt payload for live streaming', err);
          }
        }
        if (livePayload?.fp) {
          streamToPlayer(livePayload.fp, { vb: livePayload.p.vb });
        }
        const enrichedPayload = {
          ...enrichEvent(raw, {
            ip: sessionContext?.ip || undefined,
            headers: { "user-agent": sessionContext?.ua, "referer": sessionContext?.re }
          }),
          tb: sessionContext?.tb || null,
          url: sessionContext?.url || null,
          s: sessionContext?.s || null,
          l: sessionContext?.l || null
        };
        await sendToKafka('tracking-events', enrichedPayload);
        logger.info(`✅ [WS] Real-time event '${raw.t}' sent to Kafka`);
      } else {
        logger.warn(`❓ Unknown or disallowed WebSocket message type: "${raw.t}"`);
      }
    } catch (error) {
      logger.error(`🚨 WS message error: ${error}`);
      // logger.error(`RAW: ${raw}`);
      logger.error(`AUTH: ${sessionContext}`);
    }
  }
};