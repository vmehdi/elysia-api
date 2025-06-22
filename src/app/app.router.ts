import { Elysia } from "elysia";

import Auth from "@/app/auth/auth.router";
import profileRouter from "@/app/profile/profile.router";
import coreRouter from "@/app/core/core.router";
import { jwtAccess, jwtRefresh, jwtTrack } from '@/utils/jwt';

const routes = new Elysia({ prefix: "/v1" })
.use(jwtAccess)
  .use(jwtRefresh)
  .use(jwtTrack)
  .use(coreRouter)
  .use(Auth)
  .use(profileRouter)

export { routes as AppRoutes };
