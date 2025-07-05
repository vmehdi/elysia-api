import { prisma } from '@/utils/prisma';

const commonMap: Record<string, string> = {
  fp: 'fingerprint',
  tb: 'tabId',
  b: 'isBot',
  i: 'incognito',
  l: 'lang',
  s: 'screen',
  h: 'siteHeight',
  c: 'cookies',
};

const eventMap: Record<string, string> = {
  t: 'type',
  p: 'value',
  ts: 'timestamp',
  sid: 'sequentialId',
  o: 'orientation',
  sd: 'scrollDepth',
  url: 'url',
};

/**
 * Expands compact common data into full field names.
 */
function expandCommon(compact: Record<string, any>) {
  const result: Record<string, any> = {};
  for (const key in compact) {
    const fullKey = commonMap[key] || key;
    result[fullKey] = compact[key];
  }
  return result;
}

/**
 * Expands a compact event object into full field names.
 */
function expandEvent(event: Record<string, any>) {
  const result: Record<string, any> = {};
  for (const key in event) {
    const fullKey = eventMap[key] || key;
    if (fullKey === 'timestamp') {
      result[fullKey] = new Date(event[key] * 1000);
    } else {
      result[fullKey] = event[key];
    }
  }
  return result;
}

/**
 * Saves a batch of events from the standard HTTP /t endpoint.
 */
export async function saveBatchedEvents(payload: any) {
  const { common, events } = payload;
  if (!common || !Array.isArray(events) || events.length === 0) {
    console.warn("[Ingestion Service] Received invalid batched payload.");
    return 0;
  }

  const fullCommon = expandCommon(common);

  const visitor = await prisma.visitor.upsert({
    where: { fingerprintHash: fullCommon.fingerprint },
    update: {},
    create: { fingerprintHash: fullCommon.fingerprint },
  });

  const eventData = events.map((e: any) => {
    const expanded = expandEvent(e);
    return {
      type: expanded.type,
      timestamp: expanded.timestamp,
      sequentialId: expanded.sequentialId,
      orientation: expanded.orientation,
      scrollDepth: expanded.scrollDepth,
      url: expanded.url,
      value: expanded.value,
      tabId: fullCommon.tabId,
      visitorId: visitor.id,
    };
  });

  if (eventData.length > 0) {
    await prisma.event.createMany({ data: eventData });
  }

  return eventData.length;
}

/**
 * Saves a single real-time event from the WebSocket handler.
 */
export async function saveSingleEvent(payload: any) {
  if (!payload?.fp || !payload?.t) {
    console.warn("[Ingestion Service] Received invalid single event payload.");
    return 0;
  }

  const visitor = await prisma.visitor.upsert({
    where: { fingerprintHash: payload.fp },
    update: {},
    create: { fingerprintHash: payload.fp },
  });

  await prisma.event.create({
    data: {
      type: payload.t,
      timestamp: new Date(payload.ts * 1000),
      sequentialId: payload.sid ?? 0,
      orientation: payload.o,
      scrollDepth: payload.sd,
      url: payload.url,
      value: payload.p,
      tabId: payload.tb,
      visitorId: visitor.id,
    }
  });

  return 1;
}