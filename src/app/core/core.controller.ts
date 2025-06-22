import { prisma } from "@/utils/prisma";

export const getConfig = async ({ params, set, jwtTrack }: any) => {
  const { domainId } = params;

  const domainConfig = await prisma.domain.findUnique({
    where: { uniqueId: domainId },
    include: { rules: true, trackers: true },
  });

  if (!domainConfig) {
    set.status = 404;
    return { error: 'Domain not found' };
  }

  const trackingToken = await jwtTrack.sign({
    domainId: domainConfig.id,
    type: 'TRACKING_TOKEN'
  });

  const finalConfig = {
    enabledTrackers: domainConfig.trackers.map((t) => t.name),
    track_keys: ['Enter', 'Tab', 'Escape'],
    enrichment_rules: {
      click: domainConfig.rules
        .filter((r) => r.type === 'click')
        .map((r) => ({
          name: r.name,
          css_selector: r.css_selector,
          // --- THIS IS THE FIX for the regex_selector object ---
          regex_selector: (r.regex_attribute && r.regex_pattern)
            ? { attribute: r.regex_attribute, pattern: r.regex_pattern }
            : undefined,
        })),
      impression: domainConfig.rules
        .filter((r) => r.type === 'impression')
        .map((r) => ({
          name: r.name,
          css_selector: r.css_selector,
          // --- THIS IS THE FIX for the regex_selector object ---
          regex_selector: (r.regex_attribute && r.regex_pattern)
            ? { attribute: r.regex_attribute, pattern: r.regex_pattern }
            : undefined,
        })),
    },
  };

  return {
    config: finalConfig,
    token: trackingToken,
  };
}

export const setTrack = async ({ body, set }: any) => {
  const { common, events } = body;

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
    url: common.url,
    visitorId: visitor.id,
  }));

  if (eventData.length > 0) {
    await prisma.event.createMany({ data: eventData });
  }

  set.status = 202;
  return { status: 'success', received: eventData.length };
}