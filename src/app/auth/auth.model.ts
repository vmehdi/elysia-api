import { prisma } from "@/utils/prisma";
import { OTP, OtpType, RefreshToken, User } from "@prisma/client";
import crypto from "crypto";
import { __DEV__, generateOTP } from "@/utils/helper";

export const findUserByMobile = async (
  mobile: string,
): Promise<User | null> => {
  try {
    return await prisma.user.findUnique({ where: { mobile } });
  } catch (error) {
    console.error("Error finding user by mobile:", error);
    throw error;
  }
};

export const findUserByEmail = async (email: string): Promise<User | null> => {
  try {
    return prisma.user.findUnique({ where: { email } });
  } catch (error) {
    console.error("Error finding user by mobile:", error);
    throw error;
  }
};

export const createOTP = async ({
  userId,
  mobile,
  type,
}: {
  userId: string;
  mobile: string;
  type: OtpType;
}): Promise<OTP> => {
  try {
    // پاک‌سازی OTPهای منقضی‌شده قبل از ساخت جدید
    await prisma.oTP.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    const code = generateOTP();
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 2); // تنظیم زمان انقضا (۲ دقیقه)

    if (__DEV__) {
      console.log("---->  Code is:", code);
    }

    return await prisma.oTP.create({
      data: {
        mobile,
        userId,
        token,
        code,
        type,
        expiresAt,
      },
    });
  } catch (error) {
    console.error("Error creating OTP:", error);
    throw error;
  }
};

export const findOtpByToken = async (token: string): Promise<OTP | null> => {
  try {
    return prisma.oTP.findUnique({
      where: { token },
      include: {
        user: true,
      },
    });
  } catch (error) {
    console.error("Error finding user by mobile:", error);
    throw error;
  }
};

export const deleteOtpByID = async (id: string): Promise<OTP> => {
  try {
    return prisma.oTP.delete({
      where: { id },
    });
  } catch (error) {
    console.error("Error deleting OTP:", error);
    throw error;
  }
};

export const createRefreshToken = async ({
  userId,
  token,
}: {
  userId: string;
  token: string;
}): Promise<RefreshToken> => {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 روز اعتبار

    return prisma.refreshToken.create({
      data: {
        token,
        expiresAt,
        user: { connect: { id: userId } },
      },
    });
  } catch (error) {
    console.error("Error creating refresh token:", error);
    throw error;
  }
};

export const findRefreshTokenByToken = async (
  token: string,
): Promise<RefreshToken | null> => {
  try {
    return prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });
  } catch (error) {
    console.error("Error finding refresh token:", error);
    throw error;
  }
};

export const deleteRefreshToken = async (id: string): Promise<RefreshToken> => {
  try {
    return prisma.refreshToken.delete({
      where: { id },
    });
  } catch (error) {
    console.error("Error deleting refresh token:", error);
    throw error;
  }
};
