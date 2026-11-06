import type { Metadata } from "next";
import "./globals.css";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { LocaleProvider } from "@/components/shared/locale-provider";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: `${siteConfig.name} — ${siteConfig.title}`,
  description: siteConfig.description,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const messages = await getMessages();

  return (
    <html lang="th">
      <body className="min-h-screen bg-canvas text-ink font-sans antialiased selection:bg-ink selection:text-canvas">
        <NextIntlClientProvider messages={messages}>
          <LocaleProvider>{children}</LocaleProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
