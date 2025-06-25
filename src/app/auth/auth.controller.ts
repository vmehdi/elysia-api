import { prisma } from "@/utils/prisma";
import crypto from "crypto";
import { userTransform, transformResult } from "@/utils/helper";
import DB from "@/app/app.model";

async function updateSessionById(id: string, data: any) {
  return prisma.session.update({ where: { id }, data });
}

async function issueTokensAndSession({
  user,
  jwt,
  jwtRefresh,
  headers,
  ip,
  auth,
  refresh_token,
}: any) {
  const jwtToken = await jwt.sign({ id: user.id });
  const refreshToken = await jwtRefresh.sign({ id: crypto.randomUUID() });
  const { expiresAt } = await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      user: { connect: { id: user.id } },
      expiresAt: new Date(Date.now() + 30 * 86400 * 1000),
    },
  });
  const { id: sessionId } = await DB.createSession({
    token: jwtToken,
    userId: user.id,
    userAgent: headers["user-agent"],
    ipAddress: ip || headers["x-forwarded-for"] || headers["x-real-ip"] || "none",
    expiresAt: expiresAt,
  });
  auth.set({ value: jwtToken, maxAge: 7 * 86400, secure: true });
  refresh_token.set({
    value: refreshToken,
    httpOnly: true,
    maxAge: 30 * 86400,
    secure: true,
  });
  return { sessionId, jwtToken, refreshToken, expiresAt };
}

async function validateSessionToken(token: string) {
  const session = await prisma.session.findUnique({ where: { token } });
  if (!session || session.revoked || session.expiresAt < new Date()) {
    return null;
  }
  return session;
}

// --- Main Auth Logic ---
export async function register({ body, set }: any) {
  const { email, password } = body;
  if (!email || !password) {
    set.status = 400;
    return transformResult(null, "ایمیل و پسورد الزامی است", false);
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    set.status = 409;
    return transformResult(null, "این ایمیل قبلاً ثبت شده است", false);
  }
  if (password.length < 8) {
    set.status = 422;
    return transformResult(null, "رمز عبور باید حداقل ۸ کاراکتر باشد", false);
  }
  const passwordHash = await Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 });
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      isEmailVerified: false,
    },
  });
  return transformResult({ profile: userTransform(user) }, "ثبت نام با موفقیت انجام شد");
}

export async function login({ body, set, jwt, jwtRefresh, headers, ip, cookie: { auth, refresh_token } }: any) {
  const { email, password } = body;
  if (!email || !password) {
    set.status = 400;
    return transformResult(null, "ایمیل و پسورد الزامی است", false);
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    set.status = 404;
    return transformResult(null, "کاربر یافت نشد", false);
  }
  const validPassword = await Bun.password.verify(password, user.passwordHash);
  if (!validPassword) {
    set.status = 403;
    return transformResult(null, "اطلاعات ورود اشتباه است", false);
  }
  const { sessionId, jwtToken, refreshToken, expiresAt } = await issueTokensAndSession({
    user,
    jwt,
    jwtRefresh,
    headers,
    ip,
    auth,
    refresh_token,
  });
  return transformResult({
    sessionId,
    accessToken: jwtToken,
    refreshToken,
    expiresAt,
    profile: { ...userTransform(user) },
  });
}

export const refresh = async ({ body, set, jwt }: any) => {
  try {
    const { refreshToken } = body as { refreshToken: string };
    if (!refreshToken) {
      set.status = 400;
      return { message: "Refresh token is required" };
    }
    const refreshTokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });
    if (!refreshTokenRecord) {
      set.status = 400;
      return { message: "Invalid refresh token" };
    }
    if (refreshTokenRecord.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: refreshTokenRecord.id } });
      set.status = 400;
      return { message: "Refresh token expired" };
    }
    // @ts-ignore
    const newJwtToken = await jwt.sign({ userId: refreshTokenRecord.user.id });
    await prisma.refreshToken.delete({ where: { id: refreshTokenRecord.id } });
    set.status = 200;
    return { token: newJwtToken };
  } catch (error) {
    console.error("Error in refresh:", error);
    set.status = 500;
    return { message: "An error occurred during refresh" };
  }
};

export async function logout({ user, set, session, cookie: { auth } }: any) {
  if (!user) {
    set.status = 404;
    return transformResult(null, "user not found!", false);
  }
  try {
    await DB.revokeSessionByToken(session.token);
    auth.remove();
    return { message: "Logged out Successfully" };
  } catch (e) {
    console.log("---->  E is:", e);
  }
}
