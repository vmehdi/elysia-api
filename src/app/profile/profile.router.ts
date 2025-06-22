import { Elysia, t } from "elysia";
import { getMe, updateProfile, setPassword } from "./profile.controller";

const profileRouter = new Elysia({ prefix: "/me" })
  .get("/", getMe)
  .put("/profile", updateProfile, {
    body: t.Object({
      firstName: t.String(),
      lastName: t.String(),
    }),
  })
  .post("/set-password", setPassword, {
    body: t.Object({
      password: t.String(),
      email: t.Optional(t.String()),
    }),
  });

export default profileRouter;
