import { t } from "elysia";

export const __DEV__ = Bun.env.NODE_ENV === "development";

export const PAGINATE_LIMIT = Number(Bun.env.PAGINATION_LIMIT) || 12;

export const theUniqueId = () => {
  return Math.random().toString(16).substring(8) + Date.now().toString(16);
};

export const transformResult = (data: any, message = "", success = true) => {
  return success
    ? { success: true, results: data, message }
    : { ...(data && { data }), success: false, message };
};

export const transformWithPagination = (data: any) => {
  const [results, pagination] = data;
  return { success: true, results, pagination };
};

export const paginationParams = t.Object({
  page: t.Optional(t.Union([t.Number(), t.String()])),
  limit: t.Optional(t.Union([t.Number(), t.String()])),
});

export const regex = {
  mobilePattern: /^((\+989|09|9|۰۹|۹)[0-9۰-۹]{6,9})$/,
  emailPattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+.[a-zA-Z]{2,}$/,
  passwordPattern: /^[a-zA-Z0-9?><;,{}[\]\-\(\)_+=!@#$%\^&*|']*$/,
};

export const errorHandler = (error: any) => {
  return {
    success: false,
    message: error.message || "It has been Error",
  };
};

export function generateOTP() {
  return Math.floor(10000 + Math.random() * 90000).toString(); // generate 4 digit number
}

export function userTransform(user: any) {
  return {
    id: user.id,
    mobile: user.mobile,
    email: user.email,
    username: user.username,
    isMobileVerified: user.isMobileVerified,
    isEmailVerified: user.isEmailVerified,
    ...user.profile,
  };
}
export function formatForLog(data: any): string {
  try {
    return JSON.stringify(data, null, 2); // pretty-print
  } catch {
    return String(data);
  }
}