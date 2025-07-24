import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'segmentaim-backend',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const producer = kafka.producer();
const admin = kafka.admin();

export async function initKafkaProducer() {
  await admin.connect();
  await admin.createTopics({
    topics: [{
      topic: 'tracking-events',
      numPartitions: 3,
      replicationFactor: 1
    }],
    waitForLeaders: true
  });
  await admin.disconnect();

  await producer.connect();
  console.log("✅ Kafka Producer connected");
}

export async function sendToKafka(topic: string, message: any) {
  await producer.send({
    topic,
    messages: [{ value: JSON.stringify(message) }],
  });
}