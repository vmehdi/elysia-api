import { Elysia } from "elysia";

import Auth from "@/app/auth/auth.router";
import profileRouter from "@/app/profile/profile.router";
import coreRouter from "@/app/core/core.router";
import { jwtAccess, jwtRefresh, jwtTrack } from '@/utils/jwt';
import domainRouter from "./domain/domain.router";

const routes = new Elysia({ prefix: "/v1" })
  .use(jwtAccess)
  .use(coreRouter)
  .use(Auth)
  .use(profileRouter)
  .use(domainRouter)

export { routes as AppRoutes };
