"use client";

import React, { createContext, useContext, useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import thMessages from "@/messages/th.json";
import enMessages from "@/messages/en.json";

type Locale = "th" | "en";

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  messages: typeof thMessages;
}

const LocaleContext = createContext<LocaleContextType>({
  locale: "th",
  setLocale: () => {},
  toggleLocale: () => {},
  messages: thMessages,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("th");

  const toggleLocale = () => {
    setLocale((prev) => (prev === "th" ? "en" : "th"));
  };

  const messages = locale === "en" ? enMessages : thMessages;

  return (
    <LocaleContext.Provider value={{ locale, setLocale, toggleLocale, messages }}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}

export function useAppLocale() {
  return useContext(LocaleContext);
}
