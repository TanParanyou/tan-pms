"use client";

import React, { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { FormField } from "@/components/forms/form-field";
import { PhotoAttachmentField } from "@/components/forms/photo-attachment-field";
import { useStagedPhoto } from "@/hooks/use-staged-photo";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import {
  useAddStayOccupantMutation,
  useUpdateStayOccupantMutation,
  useDeleteStayOccupantMutation,
} from "../api/use-stays";
import { occupantSchema, type OccupantFormValues } from "../schemas/stay-schemas";
import { OCCUPANT_FORM_DEFAULTS } from "../constants";
import type { StayDetailDto, StayOccupantDto } from "../types";

export interface StayOccupantsPanelProps {
  propertyId: string;
  stay: StayDetailDto;
}

/** Occupants: add / edit / delete while the stay is Active; ID document is a deferred upload. */
export function StayOccupantsPanel({ propertyId, stay }: StayOccupantsPanelProps) {
  const t = useTranslations("admin.stays");
  const tCommon = useTranslations("common");
  const { toastSuccess, toastApiError } = useToast();
  const isActive = stay.status === "Active";

  const addM = useAddStayOccupantMutation(propertyId);
  const updateM = useUpdateStayOccupantMutation(propertyId);
  const deleteM = useDeleteStayOccupantMutation(propertyId);
  const photo = useStagedPhoto(propertyId, "IdentityDocument");
  const inFlight = useRef(false);
  const isBusy = photo.isUploading || addM.isPending || updateM.isPending || deleteM.isPending;
  const [dialog, setDialog] = useState<{ occupant: StayOccupantDto | null } | null>(null);
  const [toDelete, setToDelete] = useState<StayOccupantDto | null>(null);

  const editing = dialog?.occupant ?? null;
  const form = useForm<OccupantFormValues>({
    resolver: zodResolver(occupantSchema),
    values: editing
      ? {
          fullName: editing.fullName,
          nationalityCode: editing.nationalityCode,
          identityNumber: "",
          isPrimaryOccupant: editing.isPrimaryOccupant,
          vehicleLicensePlate: editing.vehicleLicensePlate ?? "",
          phoneNumber: editing.phoneNumber ?? "",
        }
      : OCCUPANT_FORM_DEFAULTS,
  });
  useUnsavedChanges(dialog !== null && (form.formState.isDirty || photo.queuedFiles.length > 0));

  const close = () => {
    photo.clear();
    setDialog(null);
  };

  const submit = form.handleSubmit(async (v) => {
    if (isBusy || inFlight.current) return;
    if (!editing && !v.identityNumber) {
      form.setError("identityNumber", { message: "required" });
      return;
    }
    inFlight.current = true;
    try {
      // Deferred upload: only here, before the occupant call; failure leaves the dialog untouched.
      const identityDocumentFileKey = await photo.commit(editing?.identityDocumentFileKey);
      if (editing) {
        await updateM.mutateAsync({
          stayId: stay.id,
          occupantId: editing.id,
          req: {
            fullName: v.fullName,
            nationalityCode: v.nationalityCode,
            identityNumber: v.identityNumber || undefined,
            isPrimaryOccupant: v.isPrimaryOccupant,
            vehicleLicensePlate: v.vehicleLicensePlate || undefined,
            phoneNumber: v.phoneNumber || undefined,
            identityDocumentFileKey,
          },
        });
        toastSuccess(t("toastOccupantUpdated"));
      } else {
        await addM.mutateAsync({
          stayId: stay.id,
          req: {
            fullName: v.fullName,
            nationalityCode: v.nationalityCode,
            identityNumber: v.identityNumber ?? "",
            isPrimaryOccupant: v.isPrimaryOccupant,
            vehicleLicensePlate: v.vehicleLicensePlate || undefined,
            phoneNumber: v.phoneNumber || undefined,
            identityDocumentFileKey,
          },
        });
        toastSuccess(t("toastOccupantAdded"));
      }
      form.reset(OCCUPANT_FORM_DEFAULTS);
      close();
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
    }
  });

  const executeDelete = async () => {
    if (!toDelete || isBusy) return;
    try {
      await deleteM.mutateAsync({ stayId: stay.id, occupantId: toDelete.id });
      toastSuccess(t("toastOccupantDeleted"));
    } catch (err) {
      toastApiError(err);
    } finally {
      setToDelete(null);
    }
  };

  return (
    <div className="space-y-3 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{t("sectionOccupants")}</h3>
        {isActive && (
          <Button type="button" size="sm" disabled={isBusy} onClick={() => setDialog({ occupant: null })} className="h-9 gap-1.5 rounded-full px-4 text-xs">
            <Plus className="h-4 w-4" />
            <span>{t("addOccupant")}</span>
          </Button>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("fieldPrimaryGuestName")}</TableHead>
            <TableHead>{t("fieldNationality")}</TableHead>
            <TableHead>{t("fieldIdentityNumber")}</TableHead>
            <TableHead>{t("fieldLicensePlate")}</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">{tCommon("actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stay.occupants.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-mute">
                {t("noOccupants")}
              </TableCell>
            </TableRow>
          ) : (
            stay.occupants.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="text-xs">
                  {o.fullName}
                  {o.isPrimaryOccupant && <Badge variant="outline" className="ml-2 text-[10px]">{t("primaryLabel")}</Badge>}
                </TableCell>
                <TableCell className="text-xs">{o.nationalityCode}</TableCell>
                <TableCell className="font-mono text-xs">{o.maskedIdentityNumber}</TableCell>
                <TableCell className="font-mono text-xs">{o.vehicleLicensePlate ?? "-"}</TableCell>
                <TableCell className="text-right">
                  {isActive && (
                    <div className="flex items-center justify-end gap-1.5">
                      <Button type="button" size="icon" variant="outline" title={tCommon("edit")} aria-label={`${tCommon("edit")} ${o.fullName}`} disabled={isBusy} onClick={() => setDialog({ occupant: o })} className="h-8 w-8 rounded-full">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="icon" variant="outline" title={tCommon("delete")} aria-label={`${tCommon("delete")} ${o.fullName}`} disabled={isBusy} onClick={() => setToDelete(o)} className="h-8 w-8 rounded-full">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t("editOccupantTitle") : t("addOccupantTitle")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField id="occ-name" label={t("fieldPrimaryGuestName")} required error={form.formState.errors.fullName ? t("errorGuestRequired") : undefined}>
                <Input id="occ-name" placeholder={tCommon("placeholders.guestName")} disabled={isBusy} className="h-10 rounded-full text-xs" {...form.register("fullName")} />
              </FormField>
              <FormField id="occ-nationality" label={t("fieldNationality")} required error={form.formState.errors.nationalityCode ? t("errorGuestRequired") : undefined}>
                <Input id="occ-nationality" placeholder={t("fieldNationality")} disabled={isBusy} className="h-10 rounded-full font-mono text-xs" {...form.register("nationalityCode")} />
              </FormField>
              <FormField id="occ-identity" label={t("fieldIdentityNumber")} required={!editing} helperText={editing ? t("identityKeepHint") : undefined} error={form.formState.errors.identityNumber ? t("errorGuestRequired") : undefined}>
                <Input id="occ-identity" placeholder={tCommon("placeholders.nationalId")} disabled={isBusy} className="h-10 rounded-full font-mono text-xs" {...form.register("identityNumber")} />
              </FormField>
              <FormField id="occ-phone" label={t("fieldPhone")}>
                <Input id="occ-phone" placeholder={tCommon("placeholders.quickWalkInPhone")} disabled={isBusy} className="h-10 rounded-full font-mono text-xs" {...form.register("phoneNumber")} />
              </FormField>
              <FormField id="occ-plate" label={t("fieldLicensePlate")}>
                <Input id="occ-plate" placeholder={t("fieldLicensePlate")} disabled={isBusy} className="h-10 rounded-full font-mono text-xs" {...form.register("vehicleLicensePlate")} />
              </FormField>
            </div>
            <Controller name="isPrimaryOccupant" control={form.control} render={({ field }) => (
              <div className="flex items-center gap-2">
                <Switch id="occ-primary" checked={field.value} disabled={isBusy} onCheckedChange={field.onChange} />
                <Label htmlFor="occ-primary" className="text-xs">{t("primaryLabel")}</Label>
              </div>
            )} />
            <PhotoAttachmentField
              label={t("fieldAttachIdPhoto")}
              existingKey={editing?.identityDocumentFileKey}
              queuedFiles={photo.queuedFiles}
              stageFiles={photo.stageFiles}
              removeFile={photo.removeFile}
              isUploading={photo.isUploading}
              accept="image/*,.pdf"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} className="rounded-full">
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isBusy} className="rounded-full">
                {isBusy ? tCommon("loading") : tCommon("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmationModal
        isOpen={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={executeDelete}
        title={t("confirmDeleteOccupantTitle")}
        message={t("confirmDeleteOccupantMessage", { name: toDelete?.fullName ?? "" })}
        confirmText={tCommon("delete")}
        variant="danger"
        isLoading={deleteM.isPending}
      />
    </div>
  );
}
