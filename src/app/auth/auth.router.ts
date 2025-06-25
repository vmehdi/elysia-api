import { Elysia, t } from "elysia";
import { refresh, logout, login, register } from "./auth.controller";
import { isAuthenticated } from "@/middleware/auth";

const auth = new Elysia()
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
