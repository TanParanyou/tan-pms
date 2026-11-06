"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, InvertedCard, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CommandTag } from "@/components/ui/command-tag";
import { SelectPill } from "@/components/ui/select-pill";
import { DeferredFilePicker } from "@/components/ui/deferred-file-picker";
import { useDeferredFileUpload } from "@/hooks/use-deferred-file-upload";
import { useAppLocale } from "@/components/shared/locale-provider";

export default function ClientPage() {
  const { messages, locale, toggleLocale } = useAppLocale();

  // Hold TTL Countdown timer state (starting at 14 minutes 59 seconds)
  const [remainingSeconds, setRemainingSeconds] = useState(14 * 60 + 59);
  const [slipSubmitted, setSlipSubmitted] = useState(false);

  // Work order state
  const [workCategory, setWorkCategory] = useState("Air Conditioning");
  const [workDescription, setWorkDescription] = useState("");
  const [workOrderNotice, setWorkOrderNotice] = useState<string | null>(null);

  // Hook for Hold Slip Upload (Deferred)
  const holdSlipUpload = useDeferredFileUpload({ maxFiles: 1 });

  // Hook for Maintenance WorkOrder Photos (Deferred)
  const workOrderPhotoUpload = useDeferredFileUpload({ maxFiles: 2 });

  // Hold Countdown effect
  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleConfirmSlip = async () => {
    if (holdSlipUpload.queuedFiles.length === 0) {
      alert("กรุณาเลือกไฟล์สลิปก่อนยืนยัน");
      return;
    }
    await holdSlipUpload.commitUploads(async (file) => {
      return `https://storage.tan-pms.internal/slips/${file.name}`;
    });
    setSlipSubmitted(true);
  };

  const handleSubmitWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workDescription.trim()) {
      alert("กรุณาระบุรายละเอียดอาการชำรุด");
      return;
    }
    // Commit photo uploads on submit
    await workOrderPhotoUpload.commitUploads(async (file) => {
      return `https://storage.tan-pms.internal/repairs/${file.name}`;
    });
    setWorkOrderNotice("ส่งใบแจ้งซ่อมสำเร็จ รหัสเอกสาร: BKK01-WKO-2611-0008");
    setWorkDescription("");
    workOrderPhotoUpload.clearFiles();
  };

  return (
    <div className="min-h-screen bg-[#ffffff] text-[#000000] pb-20">
      {/* Client Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-[#e5e5e5] bg-[#ffffff]/90 backdrop-blur-md px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-rounded font-semibold text-xl tracking-tight text-[#000000]">
              tan-pms
            </Link>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#fafafa] text-[#000000] border border-[#e5e5e5] font-mono">
              CLIENT
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#737373] hidden sm:inline">
              Guest: Wipaporn K. (3-xxxx-xxxxx-11-8)
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLocale}
              className="rounded-full text-xs font-mono h-8"
            >
              🌐 {locale.toUpperCase()}
            </Button>
            <Link href="/login">
              <Button variant="ghost" size="sm" className="rounded-full text-xs h-8">
                {messages.common.logout}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-8 space-y-8">
        {/* Section 1: Exactly ONE InvertedCard (#171717) for Online Reservation Hold TTL Countdown */}
        <section aria-label="Reservation Hold Countdown & Slip Upload">
          <InvertedCard className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#333333] pb-4 mb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e] inline-block animate-pulse" />
                  <span className="text-xs uppercase tracking-wider text-[#a3a3a3] font-mono">
                    STATUS: HOLD (TTL 15 MIN)
                  </span>
                  <CommandTag prefixCode="RES" className="bg-[#262626] border-[#333333] text-[#ffffff]">
                    BKK01-RES-2611-0108
                  </CommandTag>
                </div>
                <h2 className="text-xl font-rounded font-semibold text-[#ffffff]" data-inverted-heading>
                  {messages.client.holdBanner.title}
                </h2>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-[#a3a3a3] block">
                  {messages.client.holdBanner.remainingTime}
                </span>
                <span className="font-mono text-3xl font-bold text-[#ffffff] tracking-wider tabular-nums">
                  {formatCountdown(remainingSeconds)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-[#2e2e2e] py-1">
                  <span className="text-[#a3a3a3]">{messages.client.holdBanner.unitType}:</span>
                  <span className="font-medium text-[#ffffff]">Standard 1-Bed (32 sqm)</span>
                </div>
                <div className="flex justify-between border-b border-[#2e2e2e] py-1">
                  <span className="text-[#a3a3a3]">{messages.client.holdBanner.stayMode}:</span>
                  <span className="font-medium text-[#ffffff]">Daily (รายวัน • 2 คืน)</span>
                </div>
                <div className="flex justify-between border-b border-[#2e2e2e] py-1">
                  <span className="text-[#a3a3a3]">{messages.client.holdBanner.depositAmount}:</span>
                  <span className="font-mono font-semibold text-[#ffffff] text-sm tabular-nums">฿1,500.00</span>
                </div>
                <p className="text-[11px] text-[#a3a3a3] pt-1">
                  💡 ธนาคารไทยพาณิชย์ (SCB) 402-984711-2 บริษัท แทน เรสซิเดนซ์ จำกัด
                </p>
              </div>

              {/* Deferred Slip Upload */}
              <div className="bg-[#222222] border border-[#333333] rounded-[10px] p-4 space-y-3">
                {slipSubmitted ? (
                  <div className="text-center py-4 space-y-2">
                    <span className="text-2xl">✅</span>
                    <h4 className="text-sm font-semibold text-[#ffffff]">แนบสลิปเรียบร้อยแล้ว</h4>
                    <p className="text-xs text-[#a3a3a3]">
                      เจ้าหน้าที่หน้าเคาน์เตอร์กำลังตรวจสอบสลิป เมื่ออนุมัติแล้วจะได้รับรหัสเข้าห้องทันที
                    </p>
                  </div>
                ) : (
                  <>
                    <DeferredFilePicker
                      queuedFiles={holdSlipUpload.queuedFiles}
                      onFilesSelected={holdSlipUpload.stageFiles}
                      onRemoveFile={holdSlipUpload.removeFile}
                      isUploading={holdSlipUpload.isUploading}
                      label={messages.client.holdBanner.uploadSlip}
                      helperText="เลือกรูปสลิปจากเครื่อง รูปจะถูกอัปโหลดเมื่อกดส่ง"
                    />
                    <Button
                      variant="onDark"
                      size="sm"
                      onClick={handleConfirmSlip}
                      disabled={holdSlipUpload.queuedFiles.length === 0 || holdSlipUpload.isUploading}
                      className="w-full rounded-full font-medium h-9 text-xs mt-2"
                    >
                      {holdSlipUpload.isUploading ? messages.common.loading : messages.client.holdBanner.confirmPayment} →
                    </Button>
                  </>
                )}
              </div>
            </div>
          </InvertedCard>
        </section>

        {/* Section 2: Active Monthly Lease Card (PM-06) */}
        <section aria-label="Active Lease Information">
          <Card className="rounded-[12px] border border-[#e5e5e5] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CommandTag prefixCode="LSE">BKK01-LSE-2611-0015</CommandTag>
                  <Badge variant="success">Active Lease</Badge>
                </div>
                <CardTitle className="text-lg font-rounded">
                  {messages.client.leaseCard.title}
                </CardTitle>
              </div>
              <span className="text-sm font-mono font-semibold text-[#000000]">
                Unit A-301 (Fl 3)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-[#737373] block">{messages.client.leaseCard.rentAmount}</span>
                <span className="font-mono text-base font-semibold text-[#000000] tabular-nums">
                  ฿12,500.00 / เดือน
                </span>
              </div>
              <div>
                <span className="text-[#737373] block">{messages.client.leaseCard.depositBalance}</span>
                <span className="font-mono text-base font-semibold text-[#000000] tabular-nums">
                  ฿25,000.00 (DepositLedger)
                </span>
              </div>
              <div>
                <span className="text-[#737373] block">รอบสัญญาเช่า</span>
                <span className="font-mono text-sm text-[#000000]">
                  1 พ.ย. 2026 – 31 ต.ค. 2027
                </span>
              </div>
            </div>
          </Card>
        </section>

        {/* Section 3: Invoices with Line-Level Thai Tax Breakdown */}
        <section aria-label="Invoices with Line-Level Thai Tax Breakdown">
          <Card className="rounded-[12px] border border-[#e5e5e5] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <CommandTag prefixCode="INV">BKK01-INV-2611-0042</CommandTag>
                  <Badge variant="destructive">Unpaid</Badge>
                </div>
                <CardTitle className="text-lg font-rounded pt-1">
                  {messages.client.invoiceSection.title}
                </CardTitle>
              </div>
              <div className="text-right">
                <span className="text-xs text-[#737373] block">{messages.client.invoiceSection.amount}</span>
                <span className="font-mono text-xl font-bold text-[#000000] tabular-nums">
                  ฿15,350.00
                </span>
              </div>
            </div>

            {/* Line-Level Thai Tax Breakdown Table */}
            <div className="rounded-[8px] border border-[#e5e5e5] overflow-hidden text-xs">
              <div className="bg-[#fafafa] border-b border-[#e5e5e5] px-4 py-2 font-medium text-[#737373] flex justify-between">
                <span>รายการ (Description)</span>
                <span>การคิดภาษี (Tax Mode) & จำนวนเงิน</span>
              </div>
              <div className="divide-y divide-[#e5e5e5]">
                <div className="px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-[#000000] block">ค่าเช่าห้องพักประจำเดือน (Monthly Rent)</span>
                    <span className="text-[11px] text-[#737373]">ตาม พ.ร.บ. ภาษีมูลค่าเพิ่ม สำหรับที่อยู่อาศัย</span>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-[10px] mr-2">
                      {messages.client.invoiceSection.exempt}
                    </Badge>
                    <span className="font-mono font-medium tabular-nums">฿12,500.00</span>
                  </div>
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-[#000000] block">ค่าบริการส่วนกลางและอินเทอร์เน็ต</span>
                    <span className="text-[11px] text-[#737373]">ราคารวมภาษีมูลค่าเพิ่มแล้ว</span>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className="text-[10px] mr-2">
                      {messages.client.invoiceSection.vatIncluded}
                    </Badge>
                    <span className="font-mono font-medium tabular-nums">฿1,000.00</span>
                  </div>
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-[#000000] block">ค่าน้ำประปาและไฟฟ้าตามมิเตอร์</span>
                    <span className="text-[11px] text-[#737373]">น้ำ 22 m³ (฿396) + ไฟ 210 kWh (฿1,454)</span>
                  </div>
                  <div className="text-right">
                    <Badge variant="mono" className="text-[10px] mr-2">
                      {messages.client.invoiceSection.vatExcluded}
                    </Badge>
                    <span className="font-mono font-medium tabular-nums">฿1,850.00</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" className="rounded-full">
                {messages.client.invoiceSection.payNow} →
              </Button>
            </div>
          </Card>
        </section>

        {/* Section 4: WorkOrder Creation (WKO) with Deferred Photo Upload */}
        <section aria-label="Maintenance Work Orders">
          <Card className="rounded-[12px] border border-[#e5e5e5] p-6 space-y-4">
            <CardHeader className="p-0 pb-2">
              <div className="flex items-center gap-2">
                <CommandTag prefixCode="WKO">MAINTENANCE</CommandTag>
              </div>
              <CardTitle className="text-lg font-rounded">
                {messages.client.workOrders.title}
              </CardTitle>
            </CardHeader>

            {workOrderNotice && (
              <div className="rounded-[8px] bg-[#f0fdf4] border border-[#27c93f] p-3 text-xs text-[#166534] flex items-center justify-between">
                <span>{workOrderNotice}</span>
                <button
                  type="button"
                  onClick={() => setWorkOrderNotice(null)}
                  className="font-bold text-xs"
                >
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={handleSubmitWorkOrder} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="workCategory" className="text-xs">
                    {messages.client.workOrders.category}
                  </Label>
                  <SelectPill
                    id="workCategory"
                    value={workCategory}
                    onChange={(e) => setWorkCategory(e.target.value)}
                  >
                    <option value="Air Conditioning">เครื่องปรับอากาศ (Air Conditioning)</option>
                    <option value="Plumbing & Water">ระบบน้ำและประปา (Plumbing)</option>
                    <option value="Electrical">ระบบไฟฟ้าและแสงสว่าง (Electrical)</option>
                    <option value="Furniture & Door">เฟอร์นิเจอร์และประตู/กลอน (Furniture/Door)</option>
                  </SelectPill>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="unitDisplay" className="text-xs">
                    {messages.terms.Unit}
                  </Label>
                  <Input
                    id="unitDisplay"
                    value="A-301 (Building A • Floor 3)"
                    disabled
                    className="h-10 text-xs bg-[#fafafa]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="workDescription" className="text-xs">
                  {messages.client.workOrders.description}
                </Label>
                <Input
                  id="workDescription"
                  placeholder="เช่น แอร์มีน้ำหยดด้านซ้ายเวลาเปิดความเย็นสูง"
                  value={workDescription}
                  onChange={(e) => setWorkDescription(e.target.value)}
                  className="h-10 text-xs"
                />
              </div>

              {/* Deferred Photo Upload for Maintenance */}
              <DeferredFilePicker
                queuedFiles={workOrderPhotoUpload.queuedFiles}
                onFilesSelected={workOrderPhotoUpload.stageFiles}
                onRemoveFile={workOrderPhotoUpload.removeFile}
                isUploading={workOrderPhotoUpload.isUploading}
                label={messages.client.workOrders.attachPhoto}
                helperText="ถ่ายรูปจุดชำรุดไว้ รูปจะถูกอัปโหลดพร้อมคำขอเมื่อกดส่ง"
              />

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={workOrderPhotoUpload.isUploading}
                  className="rounded-full"
                >
                  {workOrderPhotoUpload.isUploading ? messages.common.loading : messages.client.workOrders.submit} →
                </Button>
              </div>
            </form>
          </Card>
        </section>

        {/* Section 5: Parcel Pickup Alert (PCL) */}
        <section aria-label="Tenant Parcel Pickup">
          <Card className="rounded-[12px] border border-[#e5e5e5] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-3">
              <div className="flex items-center gap-2">
                <CommandTag prefixCode="PCL">BKK01-PCL-2611-0042</CommandTag>
                <Badge variant="warning">{messages.client.parcels.waitingPickup}</Badge>
              </div>
              <span className="text-xs text-[#737373]">
                Kerry Express • TH029481920
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="h-12 w-12 rounded-[8px] bg-[#fafafa] border border-[#e5e5e5] flex items-center justify-center text-xl">
                📦
              </div>
              <div className="space-y-0.5">
                <h4 className="font-semibold text-[#000000]">พัสดุกล่องขนาดกลาง ถึงเคาน์เตอร์แล้ว</h4>
                <p className="text-[#737373]">
                  {messages.client.parcels.arrivedAt}: วันนี้ 11:32 น. • กรุณาแสดงหน้าจอนี้เพื่อรับพัสดุ
                </p>
              </div>
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
}
