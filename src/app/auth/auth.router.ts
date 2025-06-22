import { Elysia, t } from "elysia";

import {
  forgotPassword,
  resetPassword,
  refresh,
  logout,
  verify,
  authEntry,
  loginPassword,
  loginOtp,
} from "./auth.controller";
import { isAuthenticated } from "@/middleware/auth";


const auth = new Elysia()
  .post("/auth", authEntry, {
    body: t.Object({
      identifier: t.String(),
    }),
  })
  .group("/auth", (app: any) =>
    app
      .post("/verify", verify, {
        body: t.Object({
          token: t.String(), // توکن موقت
          code: t.String(),
        }),
      })
      .post("/forgot-password", forgotPassword, {
        body: t.Object({
          identifier: t.String(), // موبایل یا نام کاربری
        }),
      })
      .post("/reset-password", resetPassword, {
        body: t.Object({
          code: t.String(),
          resetToken: t.String(),
          newPassword: t.String(),
        }),
      })
      .post("/login-password", loginPassword, {
        body: t.Object({
          token: t.String(), // توکن سشن موقت
          password: t.String(),
        }),
      })
      .post("/login-otp", loginOtp, {
        body: t.Object({
          identifier: t.String(),
          token: t.String(),
        }),
      })
      .post("/refresh", refresh, {
        body: t.Object({
          refreshToken: t.String(), // توکن رفرش
        }),
      })
      .use(isAuthenticated)
      .post("/logout", logout),
  );

export default auth;
