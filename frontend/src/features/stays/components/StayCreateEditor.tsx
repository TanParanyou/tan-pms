"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectPill } from "@/components/ui/select-pill";
import { FormTabs, type FormTabItem } from "@/components/ui/form-tabs";
import { PageHeader } from "@/components/layout/page-header";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { DeferredFilePicker } from "@/components/ui/deferred-file-picker";
import { useDeferredFileUpload } from "@/hooks/use-deferred-file-upload";
import { useFormTabErrors } from "@/hooks/use-form-tab-errors";
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { SAMPLE_UNITS_FOR_STAY, SAMPLE_UNITS_FOR_STAY_MAP } from "../constants";
import { stayCreateSchema, type StayCreateFormValues } from "../schemas/stay-schemas";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

export function StayCreateEditor() {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const tStays = useTranslations("admin.stays");
  const tModes = useTranslations("stayModes");
  const tCommon = useTranslations("common");

  const [activeTab, setActiveTab] = useState("tab-room-mode");
  const [showDirtyConfirm, setShowDirtyConfirm] = useState(false);
  const [showNormalConfirm, setShowNormalConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<StayCreateFormValues>({
    resolver: zodResolver(stayCreateSchema),
    defaultValues: {
      unitId: SAMPLE_UNITS_FOR_STAY[0].id,
      stayMode: "Hourly",
      durationHours: 3,
      durationDays: 1,
      dirtyOverrideReason: "",
      primaryGuestName: "Alice Smith",
      primaryNationality: "USA",
      primaryIdNumber: "US-PASS-5544332",
      primaryLicensePlate: "3EF-7890",
      keyDepositAmount: 500,
    },
  });

  const selectedUnitId = watch("unitId");
  const selectedStayMode = watch("stayMode");

  const selectedUnit =
    SAMPLE_UNITS_FOR_STAY_MAP[selectedUnitId] ??
    SAMPLE_UNITS_FOR_STAY[0];

  const isUnitDirty = selectedUnit.conditionStatus === "Dirty";

  // Tab Error Mapping
  const fieldToTabMap = {
    unitId: "tab-room-mode",
    stayMode: "tab-room-mode",
    durationHours: "tab-room-mode",
    durationDays: "tab-room-mode",
    dirtyOverrideReason: "tab-room-mode",
    primaryGuestName: "tab-guests",
    primaryNationality: "tab-guests",
    primaryIdNumber: "tab-guests",
    keyDepositAmount: "tab-deposit",
  };

  const { hasTabError, firstErrorTab } = useFormTabErrors({
    fieldToTabMap,
    errors,
  });

  const {
    queuedFiles,
    stageFiles,
    removeFile,
    commitUploads,
    isUploading,
  } = useDeferredFileUpload({ maxFiles: 1 });

  const onInvalidSubmit = () => {
    if (firstErrorTab) {
      setActiveTab(firstErrorTab);
    }
  };

  const onValidSubmit = () => {
    if (isUnitDirty) {
      setShowDirtyConfirm(true);
    } else {
      setShowNormalConfirm(true);
    }
  };

  const executeCheckIn = async () => {
    setIsSubmitting(true);
    try {
      if (queuedFiles.length > 0) {
        await commitUploads(async (file) => {
          return `https://storage.tan-pms.internal/credentials/${file.name}`;
        });
      }
      setShowDirtyConfirm(false);
      setShowNormalConfirm(false);
      router.push("/admin/stays");
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs: FormTabItem[] = [
    {
      id: "tab-room-mode",
      label: tStays("tabRoomMode"),
      hasError: hasTabError("tab-room-mode"),
      content: (
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="checkin-unit-select" className="text-xs font-medium text-ink">
              {tStays("fieldSelectUnit")}
            </Label>
            <Controller
              name="unitId"
              control={control}
              render={({ field }) => (
                <SelectPill
                  id="checkin-unit-select"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  className="h-10 text-xs font-mono"
                >
                  {SAMPLE_UNITS_FOR_STAY.map((u) => (
                    <option key={u.id} value={u.id}>
                      Unit {u.unitNumber} ({resolveLocalizedText(u.buildingName, locale)}) —{" "}
                      {u.conditionStatus === "Clean"
                        ? tStays("cleanBadge")
                        : tStays("dirtyBadge")}
                    </option>
                  ))}
                </SelectPill>
              )}
            />
          </div>

          {isUnitDirty && (
            <div
              data-testid="dirty-unit-warning-box"
              className="p-3 rounded-[12px] bg-destructive/10 border border-destructive/20 space-y-2 text-xs"
            >
              <div className="text-destructive font-semibold">
                {tStays("dirtyRoomAlert")}
              </div>
              <div className="space-y-1">
                <Label htmlFor="dirty-override-reason" className="text-[11px] font-medium text-destructive">
                  {tStays("fieldDirtyOverrideReason")}
                </Label>
                <Controller
                  name="dirtyOverrideReason"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="dirty-override-reason"
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      placeholder={tStays("dirtyOverridePlaceholder")}
                      className="h-9 rounded-full text-xs bg-canvas"
                    />
                  )}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-ink">
              {tStays("fieldStayMode")}
            </Label>
            <Controller
              name="stayMode"
              control={control}
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={field.value === "Hourly" ? "default" : "outline"}
                    size="sm"
                    onClick={() => field.onChange("Hourly")}
                    className="rounded-full text-xs font-mono h-8 px-4"
                  >
                    {tModes("Hourly")}
                  </Button>
                  <Button
                    type="button"
                    variant={field.value === "Daily" ? "default" : "outline"}
                    size="sm"
                    onClick={() => field.onChange("Daily")}
                    className="rounded-full text-xs font-mono h-8 px-4"
                  >
                    {tModes("Daily")}
                  </Button>
                </div>
              )}
            />
          </div>

          {selectedStayMode === "Hourly" ? (
            <div className="space-y-1.5">
              <Label htmlFor="duration-hours" className="text-xs font-medium text-ink">
                {tStays("fieldDurationHours")}
              </Label>
              <Controller
                name="durationHours"
                control={control}
                render={({ field }) => (
                  <Input
                    id="duration-hours"
                    type="number"
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    placeholder={tStays("fieldDurationHours")}
                    className="h-10 rounded-full font-mono text-xs"
                  />
                )}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="duration-days" className="text-xs font-medium text-ink">
                {tStays("fieldDurationDays")}
              </Label>
              <Controller
                name="durationDays"
                control={control}
                render={({ field }) => (
                  <Input
                    id="duration-days"
                    type="number"
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    placeholder={tStays("fieldDurationDays")}
                    className="h-10 rounded-full font-mono text-xs"
                  />
                )}
              />
            </div>
          )}
        </div>
      ),
    },
    {
      id: "tab-guests",
      label: tStays("tabGuests"),
      hasError: hasTabError("tab-guests"),
      content: (
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="primary-guest-name" className="text-xs font-medium text-ink">
                {tStays("fieldPrimaryGuestName")}
              </Label>
              <Controller
                name="primaryGuestName"
                control={control}
                render={({ field }) => (
                  <Input
                    id="primary-guest-name"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={tCommon("placeholders.guestName")}
                    className="h-10 rounded-full text-xs"
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="primary-nationality" className="text-xs font-medium text-ink">
                {tStays("fieldNationality")}
              </Label>
              <Controller
                name="primaryNationality"
                control={control}
                render={({ field }) => (
                  <Input
                    id="primary-nationality"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={tStays("fieldNationality")}
                    className="h-10 rounded-full font-mono text-xs"
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="primary-id-number" className="text-xs font-medium text-ink">
                {tStays("fieldIdentityNumber")}
              </Label>
              <Controller
                name="primaryIdNumber"
                control={control}
                render={({ field }) => (
                  <Input
                    id="primary-id-number"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={tCommon("placeholders.nationalId")}
                    className="h-10 rounded-full font-mono text-xs"
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="primary-license-plate" className="text-xs font-medium text-ink">
                {tStays("fieldLicensePlate")}
              </Label>
              <Controller
                name="primaryLicensePlate"
                control={control}
                render={({ field }) => (
                  <Input
                    id="primary-license-plate"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder={tStays("fieldLicensePlate")}
                    className="h-10 rounded-full font-mono text-xs"
                  />
                )}
              />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "tab-deposit",
      label: tStays("tabDeposit"),
      hasError: hasTabError("tab-deposit"),
      content: (
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="key-deposit-amount" className="text-xs font-medium text-ink">
              {tStays("fieldKeyDepositAmount")}
            </Label>
            <Controller
              name="keyDepositAmount"
              control={control}
              render={({ field }) => (
                <Input
                  id="key-deposit-amount"
                  type="number"
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  placeholder={tStays("fieldKeyDepositAmount")}
                  className="h-10 rounded-full font-mono text-xs"
                />
              )}
            />
          </div>

          <div className="space-y-2 pt-2">
            <Label className="text-xs font-medium text-ink">
              {tStays("fieldAttachIdPhoto")}
            </Label>
            <DeferredFilePicker
              queuedFiles={queuedFiles}
              onFilesSelected={stageFiles}
              onRemoveFile={removeFile}
              isUploading={isUploading}
              accept="image/*,.pdf"
              multiple={false}
            />
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        prefixCode="STY"
        title={tStays("modalTitleCheckIn")}
        description={tStays("modalDescCheckIn")}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/stays">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full text-xs font-mono h-9 px-4 gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{tCommon("back")}</span>
              </Button>
            </Link>

            <Button
              type="button"
              size="sm"
              onClick={handleSubmit(onValidSubmit, onInvalidSubmit)}
              disabled={isSubmitting}
              className="rounded-full text-xs h-9 px-5 gap-1.5"
            >
              <Save className="h-4 w-4" />
              <span>{tStays("saveCheckIn")}</span>
            </Button>
          </div>
        }
      />

      <div className="rounded-[12px] border border-hairline bg-canvas p-6 shadow-none">
        <form onSubmit={handleSubmit(onValidSubmit, onInvalidSubmit)}>
          <FormTabs
            tabs={tabs}
            value={activeTab}
            onValueChange={setActiveTab}
          />
        </form>
      </div>

      {/* Normal Confirmation */}
      <ConfirmationModal
        isOpen={showNormalConfirm}
        onClose={() => setShowNormalConfirm(false)}
        onConfirm={executeCheckIn}
        title={tStays("confirmCheckInTitle")}
        message={tStays("confirmCheckInMessage")}
        confirmText={tStays("saveCheckIn")}
        cancelText={tCommon("cancel")}
        variant="info"
        isLoading={isSubmitting}
      />

      {/* Dirty Override Confirmation */}
      <ConfirmationModal
        isOpen={showDirtyConfirm}
        onClose={() => setShowDirtyConfirm(false)}
        onConfirm={executeCheckIn}
        title={tStays("confirmDirtyOverrideTitle")}
        message={tStays("confirmDirtyOverrideMessage")}
        confirmText={tStays("saveCheckIn")}
        cancelText={tCommon("cancel")}
        variant="danger"
        isLoading={isSubmitting}
      />
    </div>
  );
}
