import { prisma } from "@/utils/prisma";

async function createSession(data: any) {
  try {
    return await prisma.session.upsert({
      where: {
        userId_userAgent: {
          userId: data.userId,
          userAgent: data.userAgent,
        },
      },
      update: { token: data.token, expiresAt: data.expiresAt },
      create: data,
    });
  } catch (error) {
    console.error("Error creating Session:", error);
    throw error;
  }
}

async function revokeSessionByToken(token: string) {
  try {
    return prisma.session.update({
      where: { token },
      data: { revoked: true },
    });
  } catch (error) {
    console.error("Error updating Role:", error);
    throw error;
  }
}
export async function findSessionByToken(token: string) {
  try {
    return prisma.session.findUnique({
      where: { token },
    });
  } catch (error) {
    console.error("Error updating Role:", error);
    throw error;
  }
}

export default {
  createSession,
  revokeSessionByToken,
  findSessionByToken,
};
