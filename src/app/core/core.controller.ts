import type { Context } from 'elysia';
import { prisma } from "@/utils/prisma";
import { saveBatchedEvents } from "./ingestion.service";
import logger from '@/utils/logger';

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
    rules: {
      click: domain.rules
        .filter((r) => r.type === 'click')
        .map((r) => ({
          name: r.name,
          css_selector: r.css_selector,
          regex_selector: r.regex_attribute && r.regex_pattern
            ? { attribute: r.regex_attribute, pattern: r.regex_pattern }
            : undefined,
        })),
      impression: domain.rules
        .filter((r) => r.type === 'impression')
        .map((r) => ({
          name: r.name,
          css_selector: r.css_selector,
          regex_selector: r.regex_attribute && r.regex_pattern
            ? { attribute: r.regex_attribute, pattern: r.regex_pattern }
            : undefined,
        })),
    },
  };

  return {
    token,
    cdn_url: domain.trackerVersion
      ? `https://cdn.jsdelivr.net/npm/segmentaim-tracker@${domain.trackerVersion}/dist/segmentaim.js`
      : `https://cdn.jsdelivr.net/npm/segmentaim-tracker/dist/segmentaim.es.js`,
    config,
  };
};

export const setTrack = async ({
  body,
  set,
}: {
  body: Record<string, any>;
  set: any;
}) => {
  const receivedCount = await saveBatchedEvents(body);
  set.status = 201;
  return { status: "success", received: receivedCount };
};