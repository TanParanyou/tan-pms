"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectPill } from "@/components/ui/select-pill";
import { CommandTag } from "@/components/ui/command-tag";
import { Alert } from "@/components/ui/alert";
import { DeferredFilePicker } from "@/components/ui/deferred-file-picker";
import { useDeferredFileUpload } from "@/hooks/use-deferred-file-upload";
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { SAMPLE_PARCEL_DETAILS, SAMPLE_LEASE_DETAILS } from "../constants";
import { Package } from "lucide-react";

export function ClientOperationsSection() {
  const locale = useLocale() as "th" | "en";
  const tWork = useTranslations("client.workOrders");
  const tParcel = useTranslations("client.parcels");
  const tTerms = useTranslations("terms");
  const tCommon = useTranslations("common");
  const tPlaceholders = useTranslations("common.placeholders");

  const [workCategory, setWorkCategory] = useState("Air Conditioning");
  const [workDescription, setWorkDescription] = useState("");
  const [workOrderNotice, setWorkOrderNotice] = useState<string | null>(null);

  const {
    queuedFiles,
    stageFiles,
    removeFile,
    commitUploads,
    isUploading,
    clearFiles,
  } = useDeferredFileUpload({ maxFiles: 2 });

  const handleSubmitWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workDescription.trim()) return;

    await commitUploads(async (file) => {
      return `https://storage.tan-pms.internal/repairs/${file.name}`;
    });

    setWorkOrderNotice(tWork("successNotice"));
    setWorkDescription("");
    clearFiles();
  };

  return (
    <div className="space-y-6">
      {/* 1. Maintenance Work Order (WKO) */}
      <section aria-label="Submit Maintenance Work Order">
        <Card className="rounded-[12px] border border-hairline p-6 space-y-4 shadow-none">
          <CardHeader className="p-0 pb-2">
            <div className="flex items-center gap-2">
              <CommandTag prefixCode="WKO">MAINTENANCE</CommandTag>
            </div>
            <CardTitle className="text-lg font-rounded">
              {tWork("title")}
            </CardTitle>
          </CardHeader>

          {workOrderNotice && (
            <Alert
              variant="success"
              onClose={() => setWorkOrderNotice(null)}
              title={tCommon("submit")}
            >
              {workOrderNotice}
            </Alert>
          )}

          <form onSubmit={handleSubmitWorkOrder} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="workCategory" className="text-xs font-medium">
                  {tWork("category")}
                </Label>
                <SelectPill
                  id="workCategory"
                  value={workCategory}
                  onChange={(e) => setWorkCategory(e.target.value)}
                >
                  <option value="Air Conditioning">{tWork("catAir")}</option>
                  <option value="Plumbing & Water">{tWork("catPlumbing")}</option>
                  <option value="Electrical">{tWork("catElectric")}</option>
                  <option value="Furniture & Door">{tWork("catFurniture")}</option>
                </SelectPill>
              </div>

              <div className="space-y-1">
                <Label htmlFor="unitDisplay" className="text-xs font-medium">
                  {tTerms("Unit")}
                </Label>
                <Input
                  id="unitDisplay"
                  value={`${SAMPLE_LEASE_DETAILS.unit.unitNumber} (${resolveLocalizedText(SAMPLE_LEASE_DETAILS.unit.buildingName, locale)} • Fl ${SAMPLE_LEASE_DETAILS.unit.floorNumber})`}
                  disabled
                  placeholder={tTerms("Unit")}
                  className="h-10 text-xs bg-surface-soft"
                  wrapperClassName="!mb-0"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="workDescription" className="text-xs font-medium">
                {tWork("description")}
              </Label>
              <Input
                id="workDescription"
                placeholder={tPlaceholders("workDescription")}
                value={workDescription}
                onChange={(e) => setWorkDescription(e.target.value)}
                className="h-10 text-xs"
                wrapperClassName="!mb-0"
                required
              />
            </div>

            {/* Deferred Photo Upload for Maintenance */}
            <DeferredFilePicker
              queuedFiles={queuedFiles}
              onFilesSelected={stageFiles}
              onRemoveFile={removeFile}
              isUploading={isUploading}
              label={tWork("attachPhoto")}
              helperText={tWork("attachPhotoHelper")}
            />

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                size="sm"
                disabled={isUploading || !workDescription.trim()}
                className="rounded-full shadow-none text-xs"
              >
                {isUploading ? tCommon("loading") : tWork("submit")} →
              </Button>
            </div>
          </form>
        </Card>
      </section>

      {/* 2. Parcel Pickup Alert (PCL) */}
      <section aria-label="Front Desk Parcel Pickup">
        <Card className="rounded-[12px] border border-hairline p-6 space-y-4 shadow-none">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <div className="flex items-center gap-2">
              <CommandTag prefixCode="PCL">{SAMPLE_PARCEL_DETAILS.parcelNumber}</CommandTag>
              <Badge variant="warning">{tParcel("waitingPickup")}</Badge>
            </div>
            <span className="text-xs text-body">
              {tParcel("carrierSample")}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="h-12 w-12 rounded-[8px] bg-surface-soft border border-hairline flex items-center justify-center shrink-0">
              <Package className="h-6 w-6 text-body" aria-hidden="true" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <h4 className="font-semibold text-ink">{tParcel("parcelTitle")}</h4>
              <p className="text-body">
                {tParcel("arrivedAt")}: {tParcel("parcelDesc")}
              </p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
