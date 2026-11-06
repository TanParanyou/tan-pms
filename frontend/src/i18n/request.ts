import { getRequestConfig } from "next-intl/server";
import thMessages from "../messages/th.json";
import enMessages from "../messages/en.json";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !["th", "en"].includes(locale)) {
    locale = "th";
  }

  return {
    locale,
    messages: locale === "en" ? enMessages : thMessages,
  };
});
