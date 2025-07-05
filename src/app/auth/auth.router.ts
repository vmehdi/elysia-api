import { Elysia, t } from "elysia";
import { refresh, logout, login, register } from "./auth.controller";
import { isAuthenticated } from "@/middleware/auth";
import { transformResult } from "@/utils/helper";
import { jwtRefresh } from "@/utils/jwt";

const auth = new Elysia()
  .use(jwtRefresh)
  .get("/auth/test", () => (transformResult({ test: 'this is test' })))
  .post("/auth/register", register, {
    body: t.Object({
      email: t.String(),
      password: t.String(),
    }),
  })
  .post("/auth/login", login, {
    body: t.Object({
      email: t.String(),
      password: t.String(),
    }),
  })
  .post("/auth/refresh", refresh, {
    body: t.Object({
      refreshToken: t.String(),
    }),
  })
  .use(isAuthenticated)
  .post("/auth/logout", logout);

export default auth;
