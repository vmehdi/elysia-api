import { Elysia } from "elysia";
import { prisma } from "@/utils/prisma";
import { jwtAccess } from "@/utils/jwt";

export const isAuthenticated = new Elysia()
  .use(jwtAccess)
  .derive(async ({ jwt, set, request, cookie: { auth } }) => {
    const authHeader = request.headers.get("Authorization");
    const token = auth?.value || authHeader?.split(' ')[1];

    if (!token) {
      set.status = 401;
      throw new Error("Unauthorized: No token provided");
    }

    const payload = await jwt.verify(token!);
    if (!payload) {
      auth?.remove();
      set.status = 401;
      throw new Error("unauthorized");
    }
    const { id } = payload;

    const session = await prisma.session.findFirst({
      where: {
        userId: payload.id,
        token,
        revoked: false,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!session) {
      auth?.remove();
      set.status = 401;
      throw new Error("unauthorized: session not found or has been revoked");
    }

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      set.status = 401;
      throw new Error("unauthorized");
    }

    // const session = await findSessionByToken(token!);

    return {
      user,
      session,
    };
  });
