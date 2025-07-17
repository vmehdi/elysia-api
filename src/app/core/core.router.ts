import { Elysia } from "elysia";
import { checkLicense, setTrack } from "./core.controller";
import { isTrackerAuthenticated } from "@/middleware/track-auth";
import { t } from "elysia";

// Event schema
export const EventPayloadSchema = t.Object({
  t: t.String(),               // event type (e.g. 'click', 'keypress')
  p: t.Unknown(),              // event payload (type-specific)
  ts: t.Number(),              // timestamp (ms)
  url: t.String(),             // current URL
  o: t.Optional(t.String()),   // orientation
  dp: t.Optional(t.Number()),  // document/page height
  sd: t.Optional(t.Number()),  // scroll depth
  sid: t.Optional(t.Number()), // sequential ID
});

// Common schema
export const CommonSchema = t.Object({
  fp: t.String(),               // fingerprint
  tb: t.String(),               // tab ID
  b: t.Boolean(),               // is bot
  i: t.Boolean(),               // is incognito
  l: t.String(),                // language
  o: t.Optional(t.String()),    // orientation
  dp: t.Optional(t.Number()),   // document height
  t: t.Optional(t.String()),    // page title
  s: t.Object({                 // screen size
    w: t.Number(),
    h: t.Number(),
  }),
  v: t.Object({                 // viewport size
    w: t.Number(),
    h: t.Number(),
  }),
  h: t.Number(),                // site height
  sd: t.Optional(t.Number()),   // scroll depth
  c: t.Array(t.Unknown()),      // cookies
});

// Final schema
export const TrackRequestSchema = t.Object({
  common: CommonSchema,
  events: t.Array(EventPayloadSchema),
});

const coreRouter = new Elysia()
  .derive(({ request }) => ({
    ip:
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "none",
  }))
  .get("/status", ({ ip }) => ({ success: true, ip }))
  .get(
    '/v/:license',
    checkLicense,
    {
      params: t.Object({
        license: t.String(),
      }),
    }
  )
  .post(
    '/t',
    setTrack,
    {
      beforeHandle: [isTrackerAuthenticated],
      body: TrackRequestSchema
    }
  );

export default coreRouter;