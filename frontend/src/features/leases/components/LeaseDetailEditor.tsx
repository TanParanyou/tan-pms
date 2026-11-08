"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, Ban, FileDown, LogOut, Pencil, Plus, RefreshCw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateTimeInput } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { PageLoading } from "@/components/ui/mono-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { CurrencyInput } from "@/components/forms/currency-input";
import { ReasonDialog } from "@/components/forms/reason-dialog";
import { FormField } from "@/components/forms/form-field";
import { PageHeader } from "@/components/layout/page-header";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { usePermission } from "@/hooks/use-permission";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useBlobDownload } from "@/hooks/use-blob-download";
import { apiClient } from "@/lib/api/api-client";
import { useToast } from "@/hooks/use-toast";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatCurrencyThb } from "@/lib/formatters";
import {
  useAdminLeaseDetail,
  useAddLeaseOccupantMutation,
  useAddLeaseVehicleMutation,
  useRenewLeaseMutation,
  useMoveOutNoticeMutation,
  useSettleMoveOutMutation,
  useCancelLeaseMutation,
} from "../api/use-leases";
import {
  leaseOccupantSchema,
  leaseVehicleSchema,
  leaseRenewSchema,
  leaseSettleSchema,
  type LeaseOccupantFormValues,
  type LeaseVehicleFormValues,
  type LeaseRenewFormValues,
  type LeaseSettleFormValues,
} from "../schemas/lease-schemas";
import { EMPTY_OCCUPANT, EMPTY_VEHICLE, LEASE_STATUS_BADGE_VARIANT } from "../constants";
import { LeaseEditDialog } from "./LeaseEditDialog";
import { LeaseOccupantRow, LeaseVehicleRow } from "./LeasePeopleRows";
import type { LeaseItemDto, LeaseStatusType } from "../types";

export interface LeaseDetailEditorProps {
  leaseId: string;
}

export function LeaseDetailEditor({ leaseId }: LeaseDetailEditorProps) {
  const t = useTranslations("admin.leases");
  const { activeProperty } = useAdminWorkspace();
  const { data: lease, isLoading, isError, refetch } = useAdminLeaseDetail(activeProperty.id, leaseId);

  if (isLoading) return <PageLoading message={t("loadingLease")} />;
  if (isError) {
    return (
      <EmptyState
        title={t("loadError")}
        actionLabel={t("btnRetry")}
        onAction={() => void refetch()}
      />
    );
  }
  if (!lease) return <EmptyState title={t("notFound")} />;
  return <LeaseDetailBody lease={lease} propertyId={activeProperty.id} />;
}

interface LeaseDetailBodyProps {
  lease: LeaseItemDto;
  propertyId: string;
}

function LeaseDetailBody({ lease, propertyId }: LeaseDetailBodyProps) {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.leases");
  const tCommon = useTranslations("common");
  const { hasPermission } = usePermission();
  const { toastSuccess, toastApiError } = useToast();

  const canManage = hasPermission("admin.leases.manage");
  const canSettle = hasPermission("admin.leases.settle_moveout");
  const status = lease.status as LeaseStatusType;

  const addOccupant = useAddLeaseOccupantMutation(propertyId);
  const addVehicle = useAddLeaseVehicleMutation(propertyId);
  const renew = useRenewLeaseMutation(propertyId);
  const moveOutNotice = useMoveOutNoticeMutation(propertyId);
  const settle = useSettleMoveOutMutation(propertyId);
  const cancelLease = useCancelLeaseMutation(propertyId);
  const { download, isDownloading } = useBlobDownload();

  const [showEdit, setShowEdit] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showRenew, setShowRenew] = useState(false);
  const [showConfirmRenew, setShowConfirmRenew] = useState(false);
  const [showConfirmNotice, setShowConfirmNotice] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [showConfirmSettle, setShowConfirmSettle] = useState(false);

  const occupantForm = useForm<LeaseOccupantFormValues>({
    resolver: zodResolver(leaseOccupantSchema),
    defaultValues: EMPTY_OCCUPANT,
  });
  const vehicleForm = useForm<LeaseVehicleFormValues>({
    resolver: zodResolver(leaseVehicleSchema),
    defaultValues: EMPTY_VEHICLE,
  });
  const renewForm = useForm<LeaseRenewFormValues>({
    resolver: zodResolver(leaseRenewSchema),
    defaultValues: { newEndDate: lease.endDate, newMonthlyRentAmount: lease.monthlyRentAmount },
  });
  const settleForm = useForm<LeaseSettleFormValues>({
    resolver: zodResolver(leaseSettleSchema),
    defaultValues: { utilityDeductionAmount: 0, damageDeductionAmount: 0, reason: "" },
  });

  const isBusy =
    addOccupant.isPending ||
    addVehicle.isPending ||
    renew.isPending ||
    moveOutNotice.isPending ||
    settle.isPending ||
    cancelLease.isPending;

  useUnsavedChanges(
    occupantForm.formState.isDirty ||
      vehicleForm.formState.isDirty ||
      renewForm.formState.isDirty ||
      settleForm.formState.isDirty
  );

  const utilityDeduction = settleForm.watch("utilityDeductionAmount");
  const damageDeduction = settleForm.watch("damageDeductionAmount");
  const totalDeduction = (utilityDeduction || 0) + (damageDeduction || 0);
  const exceedsBalance = totalDeduction > lease.securityDepositBalance;
  const computedRefund = Math.max(0, lease.securityDepositBalance - totalDeduction);

  const submitOccupant = occupantForm.handleSubmit(async (values) => {
    if (isBusy) return;
    try {
      await addOccupant.mutateAsync({ leaseId: lease.id, req: values });
      toastSuccess(t("toastOccupantAdded"));
      occupantForm.reset(EMPTY_OCCUPANT);
    } catch (err) {
      toastApiError(err);
    }
  });

  const submitVehicle = vehicleForm.handleSubmit(async (values) => {
    if (isBusy) return;
    try {
      await addVehicle.mutateAsync({ leaseId: lease.id, req: values });
      toastSuccess(t("toastVehicleAdded"));
      vehicleForm.reset(EMPTY_VEHICLE);
    } catch (err) {
      toastApiError(err);
    }
  });

  const executeRenew = async () => {
    if (isBusy) return;
    const v = renewForm.getValues();
    try {
      await renew.mutateAsync({
        leaseId: lease.id,
        req: { newEndDate: v.newEndDate, newMonthlyRentAmount: v.newMonthlyRentAmount },
      });
      toastSuccess(t("toastRenewed"));
      setShowConfirmRenew(false);
      setShowRenew(false);
    } catch (err) {
      setShowConfirmRenew(false);
      toastApiError(err);
    }
  };

  const executeNotice = async () => {
    if (isBusy) return;
    try {
      await moveOutNotice.mutateAsync(lease.id);
      toastSuccess(t("toastNoticeGiven"));
    } catch (err) {
      toastApiError(err);
    } finally {
      setShowConfirmNotice(false);
    }
  };

  const executeSettle = async () => {
    if (isBusy) return;
    const v = settleForm.getValues();
    try {
      await settle.mutateAsync({ leaseId: lease.id, req: v });
      toastSuccess(t("toastSettled"));
      setShowConfirmSettle(false);
      setShowSettle(false);
      router.push("/admin/leases");
    } catch (err) {
      setShowConfirmSettle(false);
      toastApiError(err);
    }
  };

  const executeCancel = async (reason: string): Promise<boolean> => {
    try {
      await cancelLease.mutateAsync({ leaseId: lease.id, reason });
      toastSuccess(t("toastLeaseCancelled"));
      router.push("/admin/leases");
      return true;
    } catch (err) {
      toastApiError(err);
      return false;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        prefixCode="LSE"
        title={lease.documentNumber}
        description={t("detailDescription")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/leases">
              <Button type="button" variant="outline" size="sm" className="h-9 rounded-full px-4 gap-1.5 text-xs">
                <ArrowLeft className="h-4 w-4" />
                <span>{tCommon("back")}</span>
              </Button>
            </Link>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isDownloading}
              onClick={() =>
                void download(
                  () => apiClient.downloadAdminContractPdf(propertyId, lease.id),
                  `${lease.documentNumber}.pdf`,
                  "open"
                )
              }
              className="h-9 rounded-full px-4 gap-1.5 text-xs"
            >
              <FileDown className="h-4 w-4" />
              <span>{isDownloading ? tCommon("loading") : t("btnPrintContract")}</span>
            </Button>
            {canManage && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={status !== "Active" || isBusy}
                  onClick={() => setShowEdit(true)}
                  className="h-9 rounded-full px-4 gap-1.5 text-xs"
                >
                  <Pencil className="h-4 w-4" />
                  <span>{t("btnEditLease")}</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={status !== "Active" || isBusy}
                  onClick={() => setShowRenew(true)}
                  className="h-9 rounded-full px-4 gap-1.5 text-xs"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>{t("btnRenew")}</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={status !== "Active" || isBusy}
                  onClick={() => setShowConfirmNotice(true)}
                  className="h-9 rounded-full px-4 gap-1.5 text-xs"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{t("btnMoveOutNotice")}</span>
                </Button>
              </>
            )}
            {canSettle && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={status !== "Active" || isBusy}
                onClick={() => setShowCancel(true)}
                className="h-9 rounded-full px-4 gap-1.5 text-xs"
              >
                <Ban className="h-4 w-4" />
                <span>{t("btnCancelLease")}</span>
              </Button>
            )}
            {canSettle && (
              <Button
                type="button"
                size="sm"
                disabled={status !== "MoveOutNotice" || isBusy}
                onClick={() => setShowSettle(true)}
                className="h-9 rounded-full px-4 gap-1.5 text-xs"
              >
                <Wallet className="h-4 w-4" />
                <span>{t("btnSettleMoveOut")}</span>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none sm:grid-cols-2 lg:grid-cols-4">
        <SummaryItem label={t("colStatus")}>
          <Badge variant={LEASE_STATUS_BADGE_VARIANT[status]}>{t(`status.${status}`)}</Badge>
        </SummaryItem>
        <SummaryItem label={t("colUnit")}>
          {lease.unit.unitNumber} ({resolveLocalizedText(lease.unit.buildingName, locale)})
        </SummaryItem>
        <SummaryItem label={t("colCustomer")}>{lease.customer.fullName}</SummaryItem>
        <SummaryItem label={t("colPeriod")}>
          <span className="font-mono text-xs tabular-nums">
            {lease.startDate} - {lease.endDate}
          </span>
        </SummaryItem>
        <SummaryItem label={t("colRent")}>{formatCurrencyThb(lease.monthlyRentAmount)}</SummaryItem>
        <SummaryItem label={t("fieldSecurityDeposit")}>{formatCurrencyThb(lease.securityDepositAmount)}</SummaryItem>
        <SummaryItem label={t("colDepositBalance")}>{formatCurrencyThb(lease.securityDepositBalance)}</SummaryItem>
        {lease.cancelReason != null && <SummaryItem label={t("cancelReason")}>{lease.cancelReason}</SummaryItem>}
        <SummaryItem label={t("fieldMeterStart")}>
          <span className="font-mono text-xs tabular-nums">
            {lease.initialWaterMeterReading} / {lease.initialElectricMeterReading}
          </span>
        </SummaryItem>
      </div>

      <div className="space-y-3 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none">
        <h3 className="text-sm font-semibold text-ink">{t("sectionOccupants")}</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("fieldFullName")}</TableHead>
              <TableHead>{t("fieldNationality")}</TableHead>
              <TableHead>{t("fieldIdentityNumber")}</TableHead>
              <TableHead>{t("fieldPrimary")}</TableHead>
              <TableHead className="w-24 text-right">
                <span className="sr-only">{tCommon("actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lease.occupants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-mute">
                  {t("noOccupants")}
                </TableCell>
              </TableRow>
            ) : (
              lease.occupants.map((o) => (
                <LeaseOccupantRow key={o.id} leaseId={lease.id} propertyId={propertyId} item={o} canManage={canManage} />
              ))
            )}
          </TableBody>
        </Table>
        {canManage && (
          <form onSubmit={submitOccupant} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[2fr_1fr_2fr_auto_auto]">
            <FormField id="add-occ-name" label={t("fieldFullName")} error={occupantForm.formState.errors.fullName?.message}>
              <Input
                id="add-occ-name"
                placeholder={tCommon("placeholders.guestName")}
                className="h-10 rounded-full text-sm"
                {...occupantForm.register("fullName")}
              />
            </FormField>
            <FormField id="add-occ-nat" label={t("fieldNationality")} error={occupantForm.formState.errors.nationalityCode?.message}>
              <Input
                id="add-occ-nat"
                placeholder={t("fieldNationality")}
                className="h-10 rounded-full font-mono text-sm"
                {...occupantForm.register("nationalityCode")}
              />
            </FormField>
            <FormField id="add-occ-id" label={t("fieldIdentityNumber")} error={occupantForm.formState.errors.identityNumber?.message}>
              <Input
                id="add-occ-id"
                placeholder={tCommon("placeholders.nationalId")}
                className="h-10 rounded-full font-mono text-sm"
                {...occupantForm.register("identityNumber")}
              />
            </FormField>
            <Controller
              name="isPrimaryOccupant"
              control={occupantForm.control}
              render={({ field }) => (
                <div className="flex h-10 items-center gap-2">
                  <Checkbox id="add-occ-primary" checked={field.value} onCheckedChange={field.onChange} />
                  <Label htmlFor="add-occ-primary" className="text-xs">
                    {t("fieldPrimary")}
                  </Label>
                </div>
              )}
            />
            <Button type="submit" size="sm" disabled={isBusy} className="h-10 rounded-full px-4 gap-1.5 text-xs">
              <Plus className="h-4 w-4" />
              <span>{t("btnAddOccupant")}</span>
            </Button>
          </form>
        )}
      </div>

      <div className="space-y-3 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none">
        <h3 className="text-sm font-semibold text-ink">{t("sectionVehicles")}</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("fieldLicensePlate")}</TableHead>
              <TableHead>{t("fieldProvince")}</TableHead>
              <TableHead>{t("fieldBrandModel")}</TableHead>
              <TableHead className="w-24 text-right">
                <span className="sr-only">{tCommon("actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lease.vehicles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-mute">
                  {t("noVehicles")}
                </TableCell>
              </TableRow>
            ) : (
              lease.vehicles.map((v) => (
                <LeaseVehicleRow key={v.id} leaseId={lease.id} propertyId={propertyId} item={v} canManage={canManage} />
              ))
            )}
          </TableBody>
        </Table>
        {canManage && (
          <form onSubmit={submitVehicle} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_2fr_auto]">
            <FormField id="add-veh-plate" label={t("fieldLicensePlate")} error={vehicleForm.formState.errors.licensePlate?.message}>
              <Input
                id="add-veh-plate"
                placeholder={t("fieldLicensePlate")}
                className="h-10 rounded-full font-mono text-sm"
                {...vehicleForm.register("licensePlate")}
              />
            </FormField>
            <FormField id="add-veh-prov" label={t("fieldProvince")}>
              <Input
                id="add-veh-prov"
                placeholder={t("fieldProvince")}
                className="h-10 rounded-full text-sm"
                {...vehicleForm.register("province")}
              />
            </FormField>
            <FormField id="add-veh-model" label={t("fieldBrandModel")}>
              <Input
                id="add-veh-model"
                placeholder={t("fieldBrandModel")}
                className="h-10 rounded-full text-sm"
                {...vehicleForm.register("vehicleBrandModel")}
              />
            </FormField>
            <Button type="submit" size="sm" disabled={isBusy} className="h-10 rounded-full px-4 gap-1.5 text-xs">
              <Plus className="h-4 w-4" />
              <span>{t("btnAddVehicle")}</span>
            </Button>
          </form>
        )}
      </div>

      {/* Renew dialog */}
      <Dialog open={showRenew} onOpenChange={setShowRenew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("renewTitle")}</DialogTitle>
            <DialogDescription>{t("renewDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField id="renew-end" label={t("fieldNewEndDate")} required error={renewForm.formState.errors.newEndDate?.message}>
              <Controller
                name="newEndDate"
                control={renewForm.control}
                render={({ field }) => (
                  <DateTimeInput
                    id="renew-end"
                    value={field.value}
                    min={lease.endDate}
                    onValueChange={field.onChange}
                    placeholder={t("fieldNewEndDate")}
                    hasError={Boolean(renewForm.formState.errors.newEndDate)}
                  />
                )}
              />
            </FormField>
            <FormField id="renew-rent" label={t("fieldNewMonthlyRent")} required error={renewForm.formState.errors.newMonthlyRentAmount?.message}>
              <Controller
                name="newMonthlyRentAmount"
                control={renewForm.control}
                render={({ field }) => (
                  <CurrencyInput
                    id="renew-rent"
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={t("fieldNewMonthlyRent")}
                    hasError={Boolean(renewForm.formState.errors.newMonthlyRentAmount)}
                  />
                )}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowRenew(false)} className="rounded-full">
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              disabled={isBusy}
              onClick={renewForm.handleSubmit(() => setShowConfirmRenew(true))}
              className="rounded-full"
            >
              {t("btnRenew")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settle move-out dialog (high-risk) */}
      <Dialog open={showSettle} onOpenChange={setShowSettle}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settleTitle")}</DialogTitle>
            <DialogDescription>{t("settleDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-[12px] bg-surface-soft p-3 text-xs">
              <div>
                <div className="text-mute">{t("colDepositBalance")}</div>
                <div data-testid="settle-deposit-balance" className="font-mono tabular-nums text-ink">
                  {formatCurrencyThb(lease.securityDepositBalance)}
                </div>
              </div>
              <div>
                <div className="text-mute">{t("computedRefund")}</div>
                <div data-testid="settle-computed-refund" className="font-mono tabular-nums text-ink">
                  {formatCurrencyThb(computedRefund)}
                </div>
              </div>
            </div>
            <FormField id="settle-utility" label={t("fieldUtilityDeduction")} required error={settleForm.formState.errors.utilityDeductionAmount?.message}>
              <Controller
                name="utilityDeductionAmount"
                control={settleForm.control}
                render={({ field }) => (
                  <CurrencyInput
                    id="settle-utility"
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={t("fieldUtilityDeduction")}
                    hasError={Boolean(settleForm.formState.errors.utilityDeductionAmount)}
                  />
                )}
              />
            </FormField>
            <FormField id="settle-damage" label={t("fieldDamageDeduction")} required error={settleForm.formState.errors.damageDeductionAmount?.message}>
              <Controller
                name="damageDeductionAmount"
                control={settleForm.control}
                render={({ field }) => (
                  <CurrencyInput
                    id="settle-damage"
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={t("fieldDamageDeduction")}
                    hasError={Boolean(settleForm.formState.errors.damageDeductionAmount)}
                  />
                )}
              />
            </FormField>
            <FormField id="settle-reason" label={t("fieldSettleReason")} required error={settleForm.formState.errors.reason?.message}>
              <Textarea
                id="settle-reason"
                placeholder={t("placeholderSettleReason")}
                {...settleForm.register("reason")}
              />
            </FormField>
            {exceedsBalance && (
              <p role="alert" className="text-xs text-destructive">
                {t("errorDeductionExceedsBalance")}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowSettle(false)} className="rounded-full">
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              disabled={exceedsBalance || isBusy}
              onClick={settleForm.handleSubmit(() => setShowConfirmSettle(true))}
              className="rounded-full"
            >
              {t("btnSettleMoveOut")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LeaseEditDialog open={showEdit} onOpenChange={setShowEdit} propertyId={propertyId} lease={lease} />
      <ReasonDialog
        open={showCancel}
        onOpenChange={setShowCancel}
        title={t("cancelLeaseTitle")}
        description={t("cancelLeaseDescription")}
        actionText={t("btnCancelLease")}
        confirmTitle={t("confirmCancelLeaseTitle")}
        confirmMessage={t("confirmCancelLeaseMessage", { document: lease.documentNumber })}
        isLoading={cancelLease.isPending}
        onConfirm={executeCancel}
      />
      <ConfirmationModal
        isOpen={showConfirmRenew}
        onClose={() => setShowConfirmRenew(false)}
        onConfirm={executeRenew}
        title={t("confirmRenewTitle")}
        message={t("confirmRenewMessage")}
        confirmText={t("btnRenew")}
        variant="info"
        isLoading={renew.isPending}
      />
      <ConfirmationModal
        isOpen={showConfirmNotice}
        onClose={() => setShowConfirmNotice(false)}
        onConfirm={executeNotice}
        title={t("confirmNoticeTitle")}
        message={t("confirmNoticeMessage")}
        confirmText={t("btnMoveOutNotice")}
        variant="warning"
        isLoading={moveOutNotice.isPending}
      />
      <ConfirmationModal
        isOpen={showConfirmSettle}
        onClose={() => setShowConfirmSettle(false)}
        onConfirm={executeSettle}
        title={t("confirmSettleTitle")}
        message={t("confirmSettleMessage")}
        confirmText={t("btnSettleMoveOut")}
        variant="danger"
        isLoading={settle.isPending}
      />
    </div>
  );
}

function SummaryItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] text-mute">{label}</div>
      <div className="text-sm font-medium text-ink">{children}</div>
    </div>
  );
}
