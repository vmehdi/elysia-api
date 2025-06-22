import { prisma } from "@/utils/prisma";
import { transformResult, userTransform } from "@/utils/helper";

// دریافت اطلاعات پروفایل کاربر جاری
export const getMe = async ({ user, set }: any) => {
  try {
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      include: { ownedOrganizations: true },
    });
    if (!profile) {
      set.status = 404;
      return transformResult(null, "کاربر یافت نشد", false);
    }
    return transformResult({
      ...userTransform(profile),
    });
  } catch (error) {
    set.status = 400;
    return transformResult(null, "خطا در دریافت اطلاعات کاربر", false);
  }
};

// آپدیت اطلاعات پروفایل کاربر جاری
export const updateProfile = async ({ user, body, set }: any) => {
  try {
    // بررسی وجود پروفایل
    const existingProfile = await prisma.user.findUnique({
      where: { id: user.id },
    });

    let updatedProfile;

    if (existingProfile) {
      // بروزرسانی پروفایل موجود
      updatedProfile = await prisma.user.update({
        where: { id: user.id },
        data: body,
      });
    } else {
      // ایجاد پروفایل جدید
      updatedProfile = await prisma.user.create({
        data: {
          ...body,
          id: user.id,
        },
      });
    }

    return transformResult(updatedProfile);
  } catch (error) {
    console.error("Error updating profile:", error);
    set.status = 400;
    return transformResult(null, "خطا در بروزرسانی پروفایل", false);
  }
};


export const setPassword = async ({ user, body, set }: any) => {
  try {
    const { password, email } = body;
    if (!password || password.length < 8) {
      set.status = 400;
      return transformResult(null, "رمز عبور باید حداقل ۸ کاراکتر باشد", false);
    }
    const passwordHash = await Bun.password.hash(password, {
      algorithm: "bcrypt",
      cost: Number(Bun.env.SALT_ROUNDS) || 10,
    });
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        ...(email ? { email } : {}),
      },
    });
    return transformResult(
      {
        ...userTransform(updatedUser),
      },
      "رمز عبور و ایمیل با موفقیت ثبت شد",
    );
  } catch (error) {
    set.status = 400;
    return transformResult(null, "خطا در ثبت رمز عبور یا ایمیل", false);
  }
};
