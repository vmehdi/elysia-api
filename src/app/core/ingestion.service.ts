import { prisma } from '@/utils/prisma';


import { FIELD_MAP } from '@/utils/field-map';

export function expandKeys(data: Record<string, any>, group: 'common' | 'event') {
  const map = FIELD_MAP;

  const result: Record<string, any> = {};
  for (const key in data) {
    const fullKey = Object.entries(map).find(([_, short]) => short === key)?.[0] || key;
    result[fullKey] = data[key];
  }
  return result;
}

export async function saveBatchedEvents(payload: any) {
  console.log('📌 payload is ->', payload)
  const { common, events } = payload;
  if (!common || !Array.isArray(events) || events.length === 0) {
    console.warn("[Ingestion Service] Received invalid batched payload.");
    return 0;
  }

  console.log('📌 events is ->', events)
  const fullCommon = expandKeys(common, 'common');

  const visitor = await prisma.visitor.upsert({
    where: { fingerprintHash: fullCommon.fingerprint },
    update: {},
    create: { fingerprintHash: fullCommon.fingerprint },
  });

  const eventData = events.map((e: any) => {
    const expanded = expandKeys(e, 'event');
    console.log('📌 expanded is ->', expanded)
    return {
      type: expanded.type,
      timestamp: new Date(expanded.timestamp),
      sequentialId: expanded.sequentialId,
      orientation: expanded.orientation,
      scrollDepth: expanded.scrollDepth,
      url: expanded.url,
      value: expanded.payload,
      tabId: fullCommon.tabId,
      visitorId: visitor.id,
    };
  });

  if (eventData.length > 0) {
    await prisma.event.createMany({ data: eventData });
  }

  return eventData.length;
}

export async function saveSingleEvent(payload: any) {
  if (!payload?.fp || !payload?.t || !payload?.p) {
    console.warn("[Ingestion Service] Received invalid single event payload.");
    return 0;
  }

  let parsedValue = payload.p;
  if (typeof parsedValue === 'string') {
    try {
      parsedValue = JSON.parse(parsedValue);
    } catch (err) {
      console.warn("[Ingestion Service] Failed to parse event value as JSON:", err);
      return 1;
    }
  }

  const visitor = await prisma.visitor.upsert({
    where: { fingerprintHash: payload.fp },
    update: {},
    create: { fingerprintHash: payload.fp },
  });

  await prisma.event.create({
    data: {
      type: payload.t,
      timestamp: payload.ts ? new Date(payload.ts) : new Date(),
      sequentialId: payload.sid ?? 0,
      orientation: payload.o,
      scrollDepth: payload.sd,
      url: payload.url,
      value: parsedValue,
      tabId: payload.tb,
      visitorId: visitor.id,
    }
  });

  const rrEvents = Array.isArray(parsedValue?.vb) ? parsedValue.vb : [];
  const snapshot = rrEvents.find((e: any) => e?.t === 2);
  const meta = rrEvents.find((e: any) => e?.t === 4);
  const chunks = rrEvents.filter((e: any) => e?.t === 0);

  if (snapshot && meta && chunks.length > 0) {
    await prisma.recordingStart.upsert({
      where: {
        fingerprint_tabId_url: {
          fingerprint: payload.fp,
          tabId: payload.tb,
          url: payload.url
        }
      },
      update: {
        snapshot,
        meta,
        firstChunk: chunks[0]
      },
      create: {
        fingerprint: payload.fp,
        tabId: payload.tb,
        url: payload.url,
        snapshot,
        meta,
        firstChunk: chunks[0]
      }
    });
  }

  return 1;
}