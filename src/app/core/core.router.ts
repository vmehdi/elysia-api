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
          is_bot: t.Boolean(),
          incognito: t.Boolean(),
          lang: t.String(),
          screen: t.Number(),
          cookies: t.Array(t.String()),
          site_height: t.Number()
        }),
        events: t.Array(
          t.Object({
            type: t.String(),
            value: t.Unknown(),
            timestamp: t.Number(),
            url: t.String(),
            orientation: t.Optional(t.String()),
            scroll: t.Optional(t.Number()),
            sequential_id: t.Optional(t.Number()),
          })
        ),
      }),
    }
  );

export default coreRouter 