import { prisma } from '@/utils/prisma';

/**
 * A shared service to save batched events to the database.
 * This can be used by both the REST API and the WebSocket handler.
 * @param payload The batched payload containing common data and an array of events.
 */
export async function saveBatchedEvents(payload: any) {
  const { common, events } = payload;
  if (!common || !Array.isArray(events) || events.length === 0) {
    console.warn("Received invalid batched payload.");
    return 0;
  }

  const visitor = await prisma.visitor.upsert({
    where: { fingerprintHash: common.fingerprint },
    update: {},
    create: { fingerprintHash: common.fingerprint },
  });

  const eventData = events.map((event: any) => ({
    type: event.type,
    value: event.value,
    timestamp: new Date(event.timestamp),
    sequentialId: event.sequential_id,
    tabId: common.tab_id,
    url: common.url, // URL now comes from the common object
    visitorId: visitor.id,
  }));

  await prisma.event.createMany({ data: eventData });

  console.log(`[Ingestion Service] Saved a batch of ${eventData.length} events.`);
  return eventData.length;
}