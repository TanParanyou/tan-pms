"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, Ban, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EntityAutocomplete } from "@/components/ui/entity-autocomplete";
import { PageLoading } from "@/components/ui/mono-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { FormField } from "@/components/forms/form-field";
import { ReasonDialog } from "@/components/forms/reason-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { usePermission } from "@/hooks/use-permission";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { useUnitOptions } from "@/hooks/use-unit-options";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatDateTime } from "@/lib/formatters";
import {
  useAdminParcel,
  useReceiveParcelMutation,
  useUpdateParcelMutation,
  usePickUpParcelMutation,
  useVoidParcelMutation,
} from "../api/use-parcels";
import {
  parcelFormSchema,
  parcelPickupSchema,
  type ParcelFormValues,
  type ParcelPickupFormValues,
} from "../schemas/parcel-schemas";
import { PERMISSION_PARCELS_MANAGE, PARCEL_FORM_DEFAULTS, PARCEL_STATUS_BADGE_VARIANT } from "../constants";
import type { ParcelItemDto, ParcelStatusType } from "../types";

export interface ParcelEditorProps {
  parcelId: string;
}

/** Single dynamic route body: id="create" receives a parcel, any other id views/edits it. */
export function ParcelEditor({ parcelId }: ParcelEditorProps) {
  if (parcelId === "create") return <ParcelBody />;
  return <ParcelLoader parcelId={parcelId} />;
}

function ParcelLoader({ parcelId }: { parcelId: string }) {
  const t = useTranslations("admin.parcels");
  const { activeProperty } = useAdminWorkspace();
  const { data, isLoading, isError, refetch } = useAdminParcel(activeProperty.id, parcelId);

  if (isLoading) return <PageLoading message={t("loading")} />;
  if (isError) {
    return <EmptyState title={t("loadError")} actionLabel={t("btnRetry")} onAction={() => void refetch()} />;
  }
  if (!data) return <EmptyState title={t("notFound")} />;
  return <ParcelBody parcel={data} />;
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] text-mute">{label}</div>
      <div className="break-all text-sm font-medium text-ink">{children}</div>
    </div>
  );
}

function ParcelBody({ parcel }: { parcel?: ParcelItemDto }) {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.parcels");
  const tCommon = useTranslations("common");
  const { activeProperty } = useAdminWorkspace();
  const { hasPermission } = usePermission();
  const { toastSuccess, toastApiError } = useToast();
  const canManage = hasPermission(PERMISSION_PARCELS_MANAGE);
  const propertyId = activeProperty.id;

  const isEdit = parcel !== undefined;
  const status = parcel?.status as ParcelStatusType | undefined;
  const isArrived = !isEdit || status === "Arrived";

  const units = useUnitOptions(propertyId);
  const receiveMutation = useReceiveParcelMutation(propertyId);
  const updateMutation = useUpdateParcelMutation(propertyId);
  const pickUpMutation = usePickUpParcelMutation(propertyId);
  const voidMutation = useVoidParcelMutation(propertyId);
  const inFlight = useRef(false);
  const isBusy =
    receiveMutation.isPending || updateMutation.isPending || pickUpMutation.isPending || voidMutation.isPending;

  const [showPickup, setShowPickup] = useState(false);
  const [showVoid, setShowVoid] = useState(false);

  const form = useForm<ParcelFormValues>({
    resolver: zodResolver(parcelFormSchema),
    values: parcel
      ? {
          unitId: parcel.unit.id,
          carrierName: parcel.carrierName,
          trackingNumber: parcel.trackingNumber ?? "",
          photoFileKey: parcel.photoFileKey ?? "",
        }
      : PARCEL_FORM_DEFAULTS,
  });
  const pickupForm = useForm<ParcelPickupFormValues>({
    resolver: zodResolver(parcelPickupSchema),
    defaultValues: { recipientName: "" },
  });
  useUnsavedChanges(form.formState.isDirty || pickupForm.formState.isDirty);

  const submit = form.handleSubmit(async (v) => {
    if (isBusy || inFlight.current) return;
    inFlight.current = true;
    const req = {
      unitId: v.unitId,
      carrierName: v.carrierName,
      trackingNumber: v.trackingNumber || undefined,
      photoFileKey: v.photoFileKey || undefined,
    };
    try {
      if (parcel) {
        await updateMutation.mutateAsync({ id: parcel.id, req });
        toastSuccess(t("toastUpdated"));
      } else {
        const created = await receiveMutation.mutateAsync(req);
        toastSuccess(t("toastCreated"));
        form.reset(v);
        router.push(`/admin/parcels/${created.id}`);
      }
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
    }
  });

  const submitPickup = pickupForm.handleSubmit(async (v) => {
    if (!parcel || isBusy || inFlight.current) return;
    inFlight.current = true;
    try {
      await pickUpMutation.mutateAsync({ id: parcel.id, req: { recipientName: v.recipientName || undefined } });
      toastSuccess(t("toastPickedUp"));
      pickupForm.reset({ recipientName: "" });
      setShowPickup(false);
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
    }
  });

  const handleVoid = async (reason: string): Promise<boolean> => {
    if (!parcel) return false;
    try {
      await voidMutation.mutateAsync({ id: parcel.id, reason });
      toastSuccess(t("toastVoided"));
      router.push("/admin/parcels");
      return true;
    } catch (err) {
      toastApiError(err);
      return false;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        prefixCode="PCL"
        title={parcel ? parcel.documentNumber : t("createTitle")}
        description={parcel ? t("detailDescription") : t("createDescription")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/parcels">
              <Button type="button" variant="outline" size="sm" className="h-9 rounded-full px-4 gap-1.5 text-xs">
                <ArrowLeft className="h-4 w-4" />
                <span>{tCommon("back")}</span>
              </Button>
            </Link>
            {parcel && canManage && isArrived && (
              <>
                <Button type="button" size="sm" disabled={isBusy} onClick={() => setShowPickup(true)} className="h-9 rounded-full px-4 gap-1.5 text-xs">
                  <PackageCheck className="h-4 w-4" />
                  <span>{t("btnPickup")}</span>
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={() => setShowVoid(true)} className="h-9 rounded-full px-4 gap-1.5 text-xs">
                  <Ban className="h-4 w-4" />
                  <span>{t("btnVoid")}</span>
                </Button>
              </>
            )}
          </div>
        }
      />

      {parcel && status && (
        <div className="grid grid-cols-1 gap-4 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none sm:grid-cols-2 lg:grid-cols-4">
          <Item label={t("colStatus")}>
            <Badge variant={PARCEL_STATUS_BADGE_VARIANT[status]}>{t(`status.${status}`)}</Badge>
          </Item>
          <Item label={t("colUnit")}>
            {parcel.unit.unitNumber} ({resolveLocalizedText(parcel.unit.buildingName, locale)})
          </Item>
          <Item label={t("colCustomer")}>{parcel.customer.fullName}</Item>
          <Item label={t("colArrivedAt")}>{formatDateTime(parcel.arrivedAt, locale)}</Item>
          {status === "PickedUp" && (
            <>
              <Item label={t("pickedUpAt")}>{parcel.pickedUpAt ? formatDateTime(parcel.pickedUpAt, locale) : "-"}</Item>
              <Item label={t("fieldRecipient")}>{parcel.recipientName ?? "-"}</Item>
            </>
          )}
        </div>
      )}

      {canManage && (
        <form onSubmit={submit} className="space-y-4 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none">
          <h3 className="text-sm font-semibold text-ink">{isEdit ? t("sectionEdit") : t("sectionCreate")}</h3>
          {isEdit && !isArrived && <p className="text-xs text-mute">{t("editOnlyWhenArrived")}</p>}
          <FormField id="pcl-unit" label={t("fieldUnit")} required error={form.formState.errors.unitId ? t("errorUnitRequired") : undefined}>
            <Controller
              name="unitId"
              control={form.control}
              render={({ field }) => (
                <EntityAutocomplete
                  id="pcl-unit"
                  options={units.options}
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder={t("placeholderUnit")}
                  searchPlaceholder={t("placeholderUnit")}
                  isLoading={units.isLoading}
                  disabled={!isArrived || isBusy}
                  hasError={Boolean(form.formState.errors.unitId)}
                  wrapperClassName="!mb-0"
                />
              )}
            />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="pcl-carrier" label={t("fieldCarrier")} required error={form.formState.errors.carrierName ? t("errorCarrierRequired") : undefined}>
              <Input
                id="pcl-carrier"
                placeholder={t("placeholderCarrier")}
                disabled={!isArrived || isBusy}
                className="h-10 rounded-full text-sm"
                {...form.register("carrierName")}
              />
            </FormField>
            <FormField id="pcl-tracking" label={t("fieldTracking")}>
              <Input
                id="pcl-tracking"
                placeholder={t("placeholderTracking")}
                disabled={!isArrived || isBusy}
                className="h-10 rounded-full font-mono text-xs"
                {...form.register("trackingNumber")}
              />
            </FormField>
          </div>
          <FormField id="pcl-photo" label={t("fieldPhoto")} helperText={t("photoKeyHint")}>
            <Input
              id="pcl-photo"
              placeholder={t("placeholderPhotoKey")}
              disabled={!isArrived || isBusy}
              className="h-10 rounded-full font-mono text-xs"
              {...form.register("photoFileKey")}
            />
          </FormField>
          {isArrived && (
            <div className="flex justify-end">
              <Button type="submit" disabled={isBusy} className="h-10 rounded-full px-5 text-xs">
                {isBusy ? tCommon("loading") : isEdit ? tCommon("save") : t("btnCreate")}
              </Button>
            </div>
          )}
        </form>
      )}

      {parcel && (
        <>
          <Dialog open={showPickup} onOpenChange={setShowPickup}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("pickupTitle")}</DialogTitle>
                <DialogDescription>{t("pickupDescription")}</DialogDescription>
              </DialogHeader>
              <form onSubmit={submitPickup} className="space-y-4">
                <FormField id="pcl-recipient" label={t("fieldRecipient")}>
                  <Input
                    id="pcl-recipient"
                    placeholder={t("placeholderRecipient")}
                    className="h-10 rounded-full text-sm"
                    {...pickupForm.register("recipientName")}
                  />
                </FormField>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowPickup(false)} className="rounded-full">
                    {tCommon("cancel")}
                  </Button>
                  <Button type="submit" disabled={isBusy} className="rounded-full">
                    {pickUpMutation.isPending ? tCommon("loading") : t("btnPickup")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <ReasonDialog
            open={showVoid}
            onOpenChange={setShowVoid}
            title={t("voidTitle")}
            description={t("voidDescription")}
            actionText={t("btnVoid")}
            confirmTitle={t("confirmVoidTitle")}
            confirmMessage={t("confirmVoidMessage", { document: parcel.documentNumber })}
            isLoading={voidMutation.isPending}
            onConfirm={handleVoid}
          />
        </>
      )}
    </div>
  );
}
