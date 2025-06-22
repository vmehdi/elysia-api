import jwt from "@elysiajs/jwt";
import { t } from "elysia";

export const jwtAccess = jwt({
  name: "jwt",
  schema: t.Object({ id: t.String() }),
  secret: Bun.env.JWT_SECRET || 'csdcsd',
  exp: "7d",
});

export const jwtRefresh = jwt({
  name: "jwtRefresh",
  schema: t.Object({ id: t.String() }),
  secret: Bun.env.JWT_REFRESH_SECRET || 'sdfwefw',
  exp: "30d",
});

export const jwtTrack = jwt({
  name: 'jwtTrack',
  schema: t.Object({
    domainId: t.String(),
    type: t.Literal('TRACKING_TOKEN')
  }),
  secret: Bun.env.JWT_TRACK_SECRET || 'sdfsdf',
  exp: '1h'
});