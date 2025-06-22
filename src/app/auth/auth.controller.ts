import { prisma } from "@/utils/prisma";
import { OtpType } from "@prisma/client";
import { sendSMS } from "@/utils/sms";
import {
  userTransform,
  transformResult,
  generateOTP,
  __DEV__,
  regex,
} from "@/utils/helper";
import DB, { findSessionByToken } from "@/app/app.model";
import crypto from "crypto";
import {
  createOTP,
  createRefreshToken,
  deleteOtpByID,
  deleteRefreshToken,
  findOtpByToken,
  findRefreshTokenByToken,
  findUserByEmail,
  findUserByMobile,
} from "@/app/auth/auth.model";

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
  const { expiresAt } = await createRefreshToken({
    token: refreshToken,
    userId: user.id,
  });
  const { id: sessionId } = await DB.createSession({
    token: jwtToken,
    userId: user.id,
    userAgent: headers["user-agent"],
    ipAddress:
      ip || headers["x-forwarded-for"] || headers["x-real-ip"] || "none",
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

async function validateOtpToken(token: string, code: string) {
  const otpRecord = await findOtpByToken(token);
  if (!otpRecord) return { error: "توکن وجود ندارد" };
  if (otpRecord.expiresAt < new Date()) {
    await deleteOtpByID(otpRecord.id);
    return { error: "کد یا توکن وجود ندارد" };
  }
  if (otpRecord.code !== code) return { error: "کد نامعتبر است" };
  return { otpRecord };
}

// --- Main Auth Logic ---
export const handleOtp = async ({
  user,
  type,
}: {
  user: any;
  type: OtpType;
}) => {
  const { code, token } = await createOTP({
    userId: user.id,
    mobile: user.mobile,
    type,
  });
  await sendSMS(user.mobile, code, type);
  return { token, ...(__DEV__ && { code }) };
};

// Function to generate a random username
function generateRandomUsername() {
  const characters = "abcdefghijklmnopqrstuvwxyz";
  const length = Math.floor(Math.random() * 6) + 5; // Random length between 5 and 10
  let username = "";
  for (let i = 0; i < length; i++) {
    username += characters.charAt(
      Math.floor(Math.random() * characters.length),
    );
  }
  return username;
}

export async function authEntry({ body, set }: any) {
  const { identifier } = body;
  const { isMobile, isValid } = checkIdentifier(identifier);

  if (!isValid) {
    set.status = 422;
    return transformResult(null, "موبایل یا ایمیل صحیح نیست", false);
  }

  try {
    let user = isMobile
      ? await prisma.user.findUnique({ where: { mobile: identifier } })
      : await prisma.user.findUnique({ where: { email: identifier } });

    // اگر کاربر وجود ندارد: ساخت کاربر جدید و ارسال OTP
    if (!user) {
      user = await prisma.user.create({
        data: {
          mobile: isMobile ? identifier : undefined,
          email: !isMobile ? identifier : undefined,
          isMobileVerified: false,
          isEmailVerified: false,
          password: "",
          username: generateRandomUsername(), // Generate random username
        },
      });
      const res = await handleOtp({ user, type: OtpType.AUTH });
      return transformResult({ ...res, next: "otp" });
    }

    // اگر کاربر تایید نشده: ارسال OTP
    const isVerified =
      (isMobile && user.isMobileVerified) ||
      (!isMobile && user.isEmailVerified);
    if (!isVerified) {
      const res = await handleOtp({ user, type: OtpType.AUTH });
      return transformResult({ ...res, next: "otp" });
    }

    // اگر کاربر تایید شده و پسورد دارد: مرحله پسورد
    if (user.password) {
      const sessionToken = crypto.randomUUID();
      await prisma.session.create({
        data: {
          userId: user.id,
          token: sessionToken,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });
      return transformResult({ token: sessionToken, next: "password" });
    }

    // اگر کاربر تایید شده و پسورد ندارد: ارسال OTP
    const res = await handleOtp({ user, type: OtpType.AUTH });
    return transformResult({ ...res, next: "otp" });
  } catch (e) {
    console.log("---->  E is:", e);
  }
}

export async function loginPassword({
  body,
  set,
  jwt,
  jwtRefresh,
  headers,
  ip,
  cookie: { auth, refresh_token },
}: any) {
  const { token, password } = body;
  if (!token || !password) {
    set.status = 400;
    return transformResult(null, "token و password الزامی است", false);
  }
  const session = await validateSessionToken(token);
  if (!session) {
    set.status = 401;
    return transformResult(null, "توکن نامعتبر یا منقضی است", false);
  }
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    set.status = 404;
    return transformResult(null, "کاربر یافت نشد", false);
  }
  const validPassword = await Bun.password.verify(password, user.password);
  if (!validPassword) {
    set.status = 403;
    return transformResult(null, "اطلاعات ورود اشتباه است", false);
  }
  await updateSessionById(session.id, { revoked: true });
  const { sessionId, jwtToken, refreshToken, expiresAt } =
    await issueTokensAndSession({
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

export async function verify({
  body,
  headers,
  set,
  jwt,
  jwtRefresh,
  ip,
  cookie: { auth, refresh_token },
}: any) {
  const { error, otpRecord } = await validateOtpToken(body.token, body.code);
  if (error || !otpRecord) {
    set.status = error && error.includes("کد") ? 409 : 404;
    return transformResult(null, error || "OTP یافت نشد", false);
  }
  const user = await prisma.user.findUnique({
    where: { id: otpRecord.userId },
  });
  if (!user) {
    set.status = 404;
    return transformResult(null, "کاربر یافت نشد", false);
  }
  // بعد از وریفای موفق، isMobileVerified را true کن
  await prisma.user.update({
    where: { id: user.id },
    data: { isMobileVerified: true },
  });
  const { sessionId, jwtToken, refreshToken, expiresAt } =
    await issueTokensAndSession({
      user,
      jwt,
      jwtRefresh,
      headers,
      ip,
      auth,
      refresh_token,
    });
  await deleteOtpByID(otpRecord.id);
  return transformResult({
    ...(__DEV__ && { sessionId }),
    accessToken: jwtToken,
    refreshToken,
    expiresAt,
    profile: { ...userTransform(user) },
  });
}

export async function forgotPassword({ body, set }: any) {
  const { identifier } = body;
  const { isMobile, isValid } = checkIdentifier(identifier);

  if (!isValid) {
    set.status = 422;
    return transformResult(null, "موبایل یا ایمیل صحیح نیست", false);
  }

  const user = isMobile
    ? await findUserByMobile(identifier)
    : await findUserByEmail(identifier);
  if (!user) {
    set.status = 404;
    return transformResult(null, "کاربر یافت نشد", false);
  }
  const resetToken = await handleOtp({ user, type: OtpType.FORGOT });
  return transformResult({
    ...resetToken,
    message: "کد بازیابی رمز عبور ارسال شد",
  });
}

export async function resetPassword({ body, set }: any) {
  const { error, otpRecord } = await validateOtpToken(
    body.resetToken,
    body.code,
  );
  if (error || !otpRecord) {
    set.status = error && error.includes("کد") ? 409 : 404;
    return transformResult(null, error || "OTP یافت نشد", false);
  }
  if (body.newPassword.length < 8) {
    return transformResult(null, "رمز عبور باید حداقل ۸ کاراکتر باشد", false);
  }
  const hashedPassword = await Bun.password.hash(body.newPassword, {
    algorithm: "bcrypt",
    cost: 10,
  });
  await prisma.user.update({
    where: { id: otpRecord.userId },
    data: { password: hashedPassword },
  });
  await prisma.oTP.delete({ where: { id: otpRecord.id } });
  return transformResult({ message: "رمز عبور با موفقیت تغییر کرد" });
}

export const refresh = async ({ body, set, jwt }: any) => {
  try {
    const { refreshToken } = body as { refreshToken: string };
    if (!refreshToken) {
      set.status = 400;
      return { message: "Refresh token is required" };
    }
    const refreshTokenRecord = await findRefreshTokenByToken(refreshToken);
    if (!refreshTokenRecord) {
      set.status = 400;
      return { message: "Invalid refresh token" };
    }
    if (refreshTokenRecord.expiresAt < new Date()) {
      await deleteRefreshToken(refreshTokenRecord.id);
      set.status = 400;
      return { message: "Refresh token expired" };
    }
    // @ts-ignore
    const newJwtToken = await jwt.sign({ userId: refreshTokenRecord.user.id });
    await deleteRefreshToken(refreshTokenRecord.id);
    set.status = 200;
    return { token: newJwtToken };
  } catch (error) {
    console.error("Error in refresh:", error);
    set.status = 500;
    return { message: "An error occurred during refresh" };
  }
};

export async function loginOtp({ body, set }: any) {
  const { identifier, token } = body;
  if (!identifier || !token) {
    set.status = 400;
    return transformResult(null, "identifier و token الزامی است", false);
  }
  const { isMobile, isValid } = checkIdentifier(identifier);

  if (!isValid) {
    set.status = 422;
    return transformResult(null, "موبایل یا ایمیل صحیح نیست", false);
  }

  const user = isMobile
    ? await prisma.user.findUnique({ where: { mobile: identifier } })
    : await prisma.user.findUnique({ where: { email: identifier } });
  if (!user) {
    set.status = 404;
    return transformResult(null, "کاربر یافت نشد", false);
  }
  const isVerified =
    (isMobile && user.isMobileVerified) || (!isMobile && user.isEmailVerified);
  if (!isVerified) {
    set.status = 403;
    return transformResult(null, "کاربر تایید نشده است", false);
  }
  // اعتبارسنجی توکن سشن موقت
  const session = await validateSessionToken(token);
  if (!session || session.userId !== user.id) {
    set.status = 401;
    return transformResult(
      null,
      "توکن سشن نامعتبر یا متعلق به کاربر دیگر است",
      false,
    );
  }
  const res = await handleOtp({ user, type: OtpType.AUTH });
  return transformResult({ ...res, next: "otp" });
}

const checkIdentifier = (identifier: string) => {
  const isMobile = /^\d+$/.test(identifier);
  const isValid = isMobile
    ? regex.mobilePattern.test(identifier)
    : regex.emailPattern.test(identifier);

  return { isValid, isMobile };
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
