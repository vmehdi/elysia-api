import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'segmentaim-backend',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const producer = kafka.producer();

export async function initKafkaProducer() {
  await producer.connect();
  console.log("✅ Kafka Producer connected");
}

export async function sendToKafka(topic: string, message: any) {
  await producer.send({
    topic,
    messages: [{ value: JSON.stringify(message) }],
  });
}