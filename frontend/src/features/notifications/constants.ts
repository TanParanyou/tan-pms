import type { NotificationItemDto } from "./types";

export const INITIAL_CLIENT_NOTIFICATIONS: NotificationItemDto[] = [
  {
    id: "notif-01",
    channel: "InApp",
    templateKey: "HOLD_EXPIRING_SOON",
    title: {
      th: "แจ้งเตือนเวลา Hold การจองใกล้หมด",
      en: "Hold Reservation Expiring Soon",
    },
    body: {
      th: "ใบจอง BKK01-RES-2611-0108 เหลือเวลาชำระอีกเพียง 15 นาที",
      en: "Reservation BKK01-RES-2611-0108 has 15 minutes left for slip upload.",
    },
    isRead: false,
    createdAt: "2026-11-06T14:30:00Z",
  },
  {
    id: "notif-02",
    channel: "Line",
    templateKey: "INVOICE_ISSUED",
    title: {
      th: "ใบแจ้งหนี้ค่าเช่ารอบใหม่ออกแล้ว",
      en: "Monthly Invoice Issued",
    },
    body: {
      th: "ใบแจ้งหนี้ BKK01-INV-2611-0042 ยอดรวม 15,350.00 บาท กำหนดชำระภายใน 5 วัน",
      en: "Invoice BKK01-INV-2611-0042 for 15,350.00 THB is due in 5 days.",
    },
    isRead: false,
    createdAt: "2026-11-06T12:00:00Z",
  },
  {
    id: "notif-03",
    channel: "Email",
    templateKey: "PARCEL_ARRIVED",
    title: {
      th: "พัสดุของท่านมาถึงแล้ว",
      en: "Parcel Arrived at Front Desk",
    },
    body: {
      th: "พัสดุหมายเลข BKK01-PCL-2611-0042 (Kerry Express) สามารถรับได้ที่เคาน์เตอร์ส่วนกลาง",
      en: "Parcel BKK01-PCL-2611-0042 (Kerry Express) is ready for pickup at front desk.",
    },
    isRead: true,
    createdAt: "2026-11-05T16:20:00Z",
  },
];
