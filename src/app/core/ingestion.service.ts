import { prisma } from '@/utils/prisma';

/**
 * Saves a batch of events from the standard HTTP /track endpoint.
 * @param payload The batched payload containing common data and an array of events.
 */
export async function saveBatchedEvents(payload: any) {
  const { common, events } = payload;
  if (!common || !Array.isArray(events) || events.length === 0) {
    console.warn("[Ingestion Service] Received invalid batched payload.");
    return 0;
  }
  console.log('📌 common is ->', common)

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
    url: common.url, // URL comes from the common object in a batch
    visitorId: visitor.id,
  }));

  if (eventData.length > 0) {
    await prisma.event.createMany({ data: eventData });
  }

  return eventData.length;
}


/**
 * Saves a single real-time event from the WebSocket handler.
 * @param payload The single, complete event payload.
 */
export async function saveSingleEvent(payload: any) {
  if (!payload || !payload.fingerprint || !payload.type) {
    console.warn("[Ingestion Service] Received invalid single event payload.");
    return 0;
  }

  const visitor = await prisma.visitor.upsert({
    where: { fingerprintHash: payload.fingerprint },
    update: {},
    create: { fingerprintHash: payload.fingerprint },
  });

  await prisma.event.create({
    data: {
      type: payload.type,
      value: payload.value,
      timestamp: new Date(payload.timestamp),
      sequentialId: payload.sequential_id,
      tabId: payload.tab_id,
      url: payload.url, // URL is part of the single event payload
      visitorId: visitor.id,
    }
  });
  return 1;
}