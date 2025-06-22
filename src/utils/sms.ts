import * as process from "node:process";
import { OtpType } from "@prisma/client";

const URL = "https://ippanel.com/api/select";
const USER_NAME = "mvaezi";
const PASSWORD = "Mehdi1362";

export const sendSMS = async (mobile: string, code: string, type: OtpType) => {
  if (process.env.NODE_ENV !== "development") {
    try {
      let patternCode;
      switch (type) {
        case OtpType.AUTH:
          patternCode = "j7fapelu8w08osr";
          break;
        case OtpType.FORGOT:
          patternCode = "fogxmosenyhm929";
          break;
        case OtpType.ADMIN:
          patternCode = "dstavnn9bb";
          break;
      }
      let args = {
        op: "pattern",
        user: USER_NAME,
        pass: PASSWORD,
        toNum: mobile,
        fromNum: "5000125475",
        patternCode,
        inputData: [{ code }],
      };
      await fetch(URL, {
        method: "POST",
        body: JSON.stringify(args),
      });
    } catch (e) {
      console.log(e);
    }
  }
  return code;
};
