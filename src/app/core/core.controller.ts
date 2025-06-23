import { prisma } from "@/utils/prisma";
import { saveBatchedEvents } from "./ingestion.service";

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

  console.log('📌 trackingToken is ->', trackingToken)

  const finalConfig = {
    enabledTrackers: domainConfig.trackers.map((t) => t.name),
    track_keys: ['Enter', 'Tab', 'Escape'],
    enrichment_rules: {
      click: domainConfig.rules
        .filter((r) => r.type === 'click')
        .map((r) => ({
          name: r.name,
          css_selector: r.css_selector,
          regex_selector: (r.regex_attribute && r.regex_pattern)
            ? { attribute: r.regex_attribute, pattern: r.regex_pattern }
            : undefined,
        })),
      impression: domainConfig.rules
        .filter((r) => r.type === 'impression')
        .map((r) => ({
          name: r.name,
          css_selector: r.css_selector,
          regex_selector: (r.regex_attribute && r.regex_pattern)
            ? { attribute: r.regex_attribute, pattern: r.regex_pattern }
            : undefined,
        })),
    },
  };


  console.log('⭐==>  return config  <==⭐')
  return {
    config: finalConfig,
    token: trackingToken,
  };
}

export const setTrack = async ({ body, set }: any) => {
  const receivedCount = await saveBatchedEvents(body);
  set.status = 202;
  return { status: 'success', received: receivedCount };
}