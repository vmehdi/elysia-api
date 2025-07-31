import { prisma } from "@/utils/prisma";
import { sendToKafka } from "@/utils/kafka-producer";
import { decryptPayload } from "@/utils/decryption-service";
import { enrichEvent } from "@/utils/enrich-event";

export const checkLicense = async ({
  params,
  set,
  jwtTrack,
}: {
  params: { license: string };
  set: any;
  jwtTrack: any;
}) => {
  const { license } = params;

  if (!license) {
    set.status = 400;
    return { error: "License key is missing" };
  }

  const domain = await prisma.domain.findUnique({
    where: { uniqueId: license },
    include: {
      rules: true,
      trackers: true,
    },
  });

  if (!domain || !domain.isTracking) {
    set.status = 404;
    return;
  }

  const token = await jwtTrack.sign({
    domainId: domain.id,
    type: "TRACKING_TOKEN"
  });

  const config = {
    trackers: domain.trackers.map((t) => t.name),
    stable: ['data-seg-id', 'data-product-id'],
    keys: ['Enter', 'Tab', 'meta + l'],
    rules: {
      tc: domain.rules
        .filter((r) => r.type === 'tc')
        .map((r) => ({
          name: r.name,
          css_selector: r.css_selector,
          regex_selector: r.regex_attribute && r.regex_pattern
            ? { attribute: r.regex_attribute, pattern: r.regex_pattern }
            : undefined,
        })),
      ti: domain.rules
        .filter((r) => r.type === 'ti')
        .map((r) => ({
          name: r.name,
          css_selector: r.css_selector,
          regex_selector: r.regex_attribute && r.regex_pattern
            ? { attribute: r.regex_attribute, pattern: r.regex_pattern }
            : undefined,
        })),
    },
    ex: (domain as any).extraOptions ?? { pr: false, cl: true },
  };

  return {
    token,
    cdn_url: domain.trackerVersion
      ? `https://cdn.jsdelivr.net/npm/segmentaim-tracker@${domain.trackerVersion}/dist/segmentaim.js`
      : `https://cdn.jsdelivr.net/npm/segmentaim-tracker/dist/segmentaim.es.js`,
    config,
  };
};

export const setTrack = async ({ body, set, request, ip, }: {
  body: Record<string, any>;
  set: any;
  request: any;
  ip: string;
}) => {
  const { common, events } = body;
  if (!common || !Array.isArray(events) || events.length === 0) {
    set.status = 400;
    return { error: "Invalid payload" };
  }

  const processedEvents = await Promise.all(
    events.map(async (e) => ({
      ...e,
      p: await decryptPayload(e.p),
    }))
  );
  
  const enrichedPayload = enrichEvent({ ...common, events: processedEvents }, { ip, headers: request.headers });
  await sendToKafka("tracking-events", enrichedPayload);

  set.status = 201;
  return { status: "success", received: processedEvents.length };
};