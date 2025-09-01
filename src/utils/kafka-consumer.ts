import { Kafka } from 'kafkajs';
import logger from './logger';
import { streamToPlayer } from '@/app/plugins/live-play';

const kafka = new Kafka({
  clientId: 'segmentaim-backend-consumer',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const consumer = kafka.consumer({ groupId: 'live-player-group' });

export async function startKafkaConsumer() {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: 'tracking-events', fromBeginning: false });

    logger.info('✅ Kafka consumer connected for live streaming');

    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const raw = message.value?.toString();
          if (!raw) return;

          const event = JSON.parse(raw);

          logger.info(`📨 [Kafka] Processing message`, {
            eventType: event?.t,
            hasFingerprint: !!event?.fp,
            hasPayload: !!event?.p,
            payloadKeys: event?.p ? Object.keys(event.p) : 'no payload'
          });

          // Check if this is a recording event that should be streamed to player
          if (event?.fp && event?.p?.vb && Array.isArray(event.p.vb)) {
            logger.info(`📹 [Kafka] Recording event detected, streaming ${event.p.vb.length} events to player for fp: ${event.fp}`);
            streamToPlayer(event.fp, { vb: event.p.vb });
          } else if (event?.t === 'tr' && event?.fp) {
            // Legacy support for 'tr' events
            logger.info(`📡 [Kafka] Legacy tr event detected, streaming to player for fp: ${event.fp}`);
            streamToPlayer(event.fp, event.p);
          } else {
            logger.info(`ℹ️ [Kafka] Event not suitable for live streaming`, {
              eventType: event?.t,
              hasVb: !!event?.p?.vb,
              vbIsArray: Array.isArray(event?.p?.vb)
            });
          }
        } catch (err) {
          logger.error('❌ Failed to process Kafka message for live streaming', err);
        }
      },
    });
  } catch (err) {
    logger.error('🚨 Kafka consumer connection error', err);
  }
}