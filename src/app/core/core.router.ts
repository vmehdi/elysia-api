import { Elysia, t } from "elysia";
import { getConfig, setTrack } from "./core.controller";
import { isTrackerAuthenticated } from "@/middleware/track-auth";

const coreRouter = new Elysia()
  .derive(({ request }) => ({
    ip:
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "none",
  }))
  .get("/status", ({ ip }) => ({
    success: true,
    ip,
  }))
  .get(
    '/config/:domainId',
    getConfig,
    {
      params: t.Object({
        domainId: t.String(),
      }),
    }
  )
  .post(
    '/track',
    setTrack,
    {
      beforeHandle: [isTrackerAuthenticated],
      body: t.Object({
        common: t.Object({
          fingerprint: t.String(),
          tab_id: t.String(),
          userAgent: t.String(),
          url: t.String(),
          referrer: t.String(),
        }),
        events: t.Array(
          t.Object({
            type: t.String(),
            value: t.Unknown(),
            timestamp: t.Number(),
            sequential_id: t.Number(),
          })
        ),
      }),
    }
  );

export default coreRouter 