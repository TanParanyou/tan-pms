export const siteConfig = {
  name: "tan-pms",
  title: "Enterprise Property Management System",
  description:
    "Single-Organization, Multi-Property PMS supporting Hourly, Daily, and Monthly StayModes with AdminScope and ClientScope isolation.",
  companyName: "TAN Residence Co., Ltd.",
  companyNameTh: "\u0e1a\u0e23\u0e34\u0e29\u0e31\u0e17 \u0e41\u0e17\u0e19 \u0e40\u0e23\u0e2a\u0e0b\u0e34\u0e40\u0e14\u0e19\u0e0b\u0e4c \u0e08\u0e33\u0e01\u0e31\u0e14",
  version: "1.0.0",
  defaultLocale: "th",
} as const;

export type SiteConfig = typeof siteConfig;
