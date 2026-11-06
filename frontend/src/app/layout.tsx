import type { Metadata } from "next";
import "./globals.css";
import { LocaleProvider } from "@/components/shared/locale-provider";

export const metadata: Metadata = {
  title: "tan-pms — Enterprise Property Management System",
  description:
    "Single-Organization, Multi-Property PMS supporting Hourly, Daily, and Monthly StayModes with AdminScope and ClientScope isolation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className="min-h-screen bg-[#ffffff] text-[#000000] font-sans antialiased selection:bg-[#000000] selection:text-[#ffffff]">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
