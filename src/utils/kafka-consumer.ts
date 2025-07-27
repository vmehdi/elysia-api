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

          if (event?.t === 'tr' && event?.fp) {
            streamToPlayer(event.fp, event.p);
            logger.info(`📡 Live event sent to player for fp: ${event.fp}`);
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