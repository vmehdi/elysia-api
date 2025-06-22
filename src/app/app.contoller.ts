import { transformResult, userTransform } from "@/utils/helper";
import { prisma } from "@/utils/prisma";

export const profile = async ({ userId, set }: any) => {
  if (!userId) {
    set.status = 404;
    return transformResult(null, "user not found!", false);
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user) {
    return transformResult({
      ...userTransform(user),
    });
  }
};

export async function setPassword({ body, set, userId }: any) {
  const { password } = body;
  if (!userId) {
    set.status = 401;
    return transformResult(null, "شما وارد نشده‌اید یا توکن معتبر نیست", false);
  }
  if (!password) {
    set.status = 400;
    return transformResult(null, "password الزامی است", false);
  }
  if (password.length < 8) {
    return transformResult(null, "رمز عبور باید حداقل ۸ کاراکتر باشد", false);
  }
  const hashedPassword = await Bun.password.hash(password, {
    algorithm: "bcrypt",
    cost: 10,
  });
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hashedPassword },
  });
  return transformResult({ message: "رمز عبور با موفقیت ثبت شد" });
}
