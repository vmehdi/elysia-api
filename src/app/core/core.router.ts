import { Elysia } from "elysia";
import { checkLicense, setTrack } from "./core.controller";
import { isTrackerAuthenticated } from "@/middleware/track-auth";
import { t } from "elysia";

const EventPayloadSchema = t.Object({
  t: t.String(),       // Event type (e.g., 'click', 'impression', etc.)
  p: t.Unknown(),      // Event payload (varies per type)
  ts: t.Number(),      // Timestamp (seconds)
  url: t.String(),     // Current page URL
  o: t.Optional(t.String()),  // Orientation (e.g., 'landscape')
  sd: t.Optional(t.Number()), // Scroll depth
  sid: t.Optional(t.Number()) // Sequential ID
});

const TrackRequestSchema = t.Object({
  common: t.Object({
    fp: t.String(),                   // Fingerprint
    tb: t.String(),                   // Tab ID
    b: t.Boolean(),                   // isBot
    i: t.Boolean(),                   // incognito
    l: t.String(),                    // language
    s: t.Object(t.Unknown()),         // screen data
    h: t.Number(),                    // site height
    c: t.Array(t.Unknown()),          // cookies
  }),
  events: t.Array(EventPayloadSchema),
});

const coreRouter = new Elysia()
  .derive(({ request }) => ({
    ip:
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "none",
  }))
  .get('/status', () => ({ success: true }))
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