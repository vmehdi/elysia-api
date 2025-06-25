import { prisma } from "@/utils/prisma";
import { RefreshToken, User } from "@prisma/client";

export const findUserByEmail = async (email: string): Promise<User | null> => {
  try {
    return prisma.user.findUnique({ where: { email } });
  } catch (error) {
    console.error("Error finding user by email:", error);
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
