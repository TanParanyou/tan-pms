"use client";

import React, { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { TableRow, TableCell } from "@/components/ui/table";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { useToast } from "@/hooks/use-toast";
import {
  useUpdateLeaseOccupantMutation,
  useDeleteLeaseOccupantMutation,
  useUpdateLeaseVehicleMutation,
  useDeleteLeaseVehicleMutation,
} from "../api/use-leases";
import {
  leaseOccupantEditSchema,
  leaseVehicleSchema,
  type LeaseOccupantEditFormValues,
  type LeaseVehicleFormValues,
} from "../schemas/lease-schemas";
import type { LeaseOccupantDto, LeaseVehicleDto } from "../types";

interface RowProps<T> {
  leaseId: string;
  propertyId: string;
  item: T;
  canManage: boolean;
}

export function LeaseOccupantRow({ leaseId, propertyId, item, canManage }: RowProps<LeaseOccupantDto>) {
  const t = useTranslations("admin.leases");
  const tCommon = useTranslations("common");
  const { toastSuccess, toastApiError } = useToast();
  const update = useUpdateLeaseOccupantMutation(propertyId);
  const remove = useDeleteLeaseOccupantMutation(propertyId);
  const inFlight = useRef(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const isBusy = update.isPending || remove.isPending;

  const form = useForm<LeaseOccupantEditFormValues>({
    resolver: zodResolver(leaseOccupantEditSchema),
    values: {
      fullName: item.fullName,
      nationalityCode: item.nationalityCode,
      identityNumber: "",
      isPrimaryOccupant: item.isPrimaryOccupant,
    },
  });

  const save = form.handleSubmit(async (v) => {
    if (isBusy || inFlight.current) return;
    inFlight.current = true;
    try {
      await update.mutateAsync({
        leaseId,
        occupantId: item.id,
        req: {
          fullName: v.fullName,
          nationalityCode: v.nationalityCode,
          identityNumber: v.identityNumber || undefined,
          isPrimaryOccupant: v.isPrimaryOccupant,
        },
      });
      toastSuccess(t("toastOccupantUpdated"));
      setIsEditing(false);
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
    }
  });

  const executeDelete = async () => {
    if (isBusy || inFlight.current) return;
    inFlight.current = true;
    try {
      await remove.mutateAsync({ leaseId, occupantId: item.id });
      toastSuccess(t("toastOccupantDeleted"));
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
      setShowDelete(false);
    }
  };

  if (isEditing) {
    const errors = form.formState.errors;
    return (
      <TableRow>
        <TableCell>
          <Input
            aria-label={t("fieldFullName")}
            placeholder={t("fieldFullName")}
            hasError={Boolean(errors.fullName)}
            wrapperClassName="!mb-0"
            className="h-9 text-xs"
            {...form.register("fullName")}
          />
        </TableCell>
        <TableCell>
          <Input
            aria-label={t("fieldNationality")}
            placeholder={t("fieldNationality")}
            hasError={Boolean(errors.nationalityCode)}
            wrapperClassName="!mb-0"
            className="h-9 font-mono text-xs"
            {...form.register("nationalityCode")}
          />
        </TableCell>
        <TableCell>
          <Input
            aria-label={t("fieldIdentityNumber")}
            placeholder={t("placeholderKeepIdentity")}
            hasError={Boolean(errors.identityNumber)}
            wrapperClassName="!mb-0"
            className="h-9 font-mono text-xs"
            {...form.register("identityNumber")}
          />
        </TableCell>
        <TableCell>
          <Controller
            name="isPrimaryOccupant"
            control={form.control}
            render={({ field }) => (
              <Checkbox aria-label={t("fieldPrimary")} checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1.5">
            <Button type="button" size="icon" disabled={isBusy} title={tCommon("save")} aria-label={tCommon("save")} onClick={() => void save()} className="h-8 w-8 rounded-full">
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" size="icon" variant="outline" disabled={isBusy} title={tCommon("cancel")} aria-label={tCommon("cancel")} onClick={() => { form.reset(); setIsEditing(false); }} className="h-8 w-8 rounded-full">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell>{item.fullName}</TableCell>
      <TableCell className="font-mono text-xs">{item.nationalityCode}</TableCell>
      <TableCell className="font-mono text-xs">{item.maskedIdentityNumber}</TableCell>
      <TableCell>{item.isPrimaryOccupant ? <Badge variant="success">{t("fieldPrimary")}</Badge> : "-"}</TableCell>
      <TableCell className="text-right">
        {canManage && (
          <div className="flex items-center justify-end gap-1.5">
            <Button type="button" size="icon" variant="outline" disabled={isBusy} title={tCommon("edit")} aria-label={`${tCommon("edit")} ${item.fullName}`} onClick={() => setIsEditing(true)} className="h-8 w-8 rounded-full">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" size="icon" variant="outline" disabled={isBusy} title={tCommon("delete")} aria-label={`${tCommon("delete")} ${item.fullName}`} onClick={() => setShowDelete(true)} className="h-8 w-8 rounded-full">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        <ConfirmationModal
          isOpen={showDelete}
          onClose={() => setShowDelete(false)}
          onConfirm={executeDelete}
          title={t("confirmDeleteOccupantTitle")}
          message={t("confirmDeleteOccupantMessage", { name: item.fullName })}
          confirmText={tCommon("delete")}
          variant="danger"
          isLoading={remove.isPending}
        />
      </TableCell>
    </TableRow>
  );
}

export function LeaseVehicleRow({ leaseId, propertyId, item, canManage }: RowProps<LeaseVehicleDto>) {
  const t = useTranslations("admin.leases");
  const tCommon = useTranslations("common");
  const { toastSuccess, toastApiError } = useToast();
  const update = useUpdateLeaseVehicleMutation(propertyId);
  const remove = useDeleteLeaseVehicleMutation(propertyId);
  const inFlight = useRef(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const isBusy = update.isPending || remove.isPending;

  const form = useForm<LeaseVehicleFormValues>({
    resolver: zodResolver(leaseVehicleSchema),
    values: { licensePlate: item.licensePlate, province: item.province, vehicleBrandModel: item.vehicleBrandModel },
  });

  const save = form.handleSubmit(async (v) => {
    if (isBusy || inFlight.current) return;
    inFlight.current = true;
    try {
      await update.mutateAsync({ leaseId, vehicleId: item.id, req: v });
      toastSuccess(t("toastVehicleUpdated"));
      setIsEditing(false);
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
    }
  });

  const executeDelete = async () => {
    if (isBusy || inFlight.current) return;
    inFlight.current = true;
    try {
      await remove.mutateAsync({ leaseId, vehicleId: item.id });
      toastSuccess(t("toastVehicleDeleted"));
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
      setShowDelete(false);
    }
  };

  if (isEditing) {
    return (
      <TableRow>
        <TableCell>
          <Input
            aria-label={t("fieldLicensePlate")}
            placeholder={t("fieldLicensePlate")}
            hasError={Boolean(form.formState.errors.licensePlate)}
            wrapperClassName="!mb-0"
            className="h-9 font-mono text-xs"
            {...form.register("licensePlate")}
          />
        </TableCell>
        <TableCell>
          <Input aria-label={t("fieldProvince")} placeholder={t("fieldProvince")} wrapperClassName="!mb-0" className="h-9 text-xs" {...form.register("province")} />
        </TableCell>
        <TableCell>
          <Input aria-label={t("fieldBrandModel")} placeholder={t("fieldBrandModel")} wrapperClassName="!mb-0" className="h-9 text-xs" {...form.register("vehicleBrandModel")} />
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1.5">
            <Button type="button" size="icon" disabled={isBusy} title={tCommon("save")} aria-label={tCommon("save")} onClick={() => void save()} className="h-8 w-8 rounded-full">
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" size="icon" variant="outline" disabled={isBusy} title={tCommon("cancel")} aria-label={tCommon("cancel")} onClick={() => { form.reset(); setIsEditing(false); }} className="h-8 w-8 rounded-full">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{item.licensePlate}</TableCell>
      <TableCell>{item.province || "-"}</TableCell>
      <TableCell>{item.vehicleBrandModel || "-"}</TableCell>
      <TableCell className="text-right">
        {canManage && (
          <div className="flex items-center justify-end gap-1.5">
            <Button type="button" size="icon" variant="outline" disabled={isBusy} title={tCommon("edit")} aria-label={`${tCommon("edit")} ${item.licensePlate}`} onClick={() => setIsEditing(true)} className="h-8 w-8 rounded-full">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" size="icon" variant="outline" disabled={isBusy} title={tCommon("delete")} aria-label={`${tCommon("delete")} ${item.licensePlate}`} onClick={() => setShowDelete(true)} className="h-8 w-8 rounded-full">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        <ConfirmationModal
          isOpen={showDelete}
          onClose={() => setShowDelete(false)}
          onConfirm={executeDelete}
          title={t("confirmDeleteVehicleTitle")}
          message={t("confirmDeleteVehicleMessage", { plate: item.licensePlate })}
          confirmText={tCommon("delete")}
          variant="danger"
          isLoading={remove.isPending}
        />
      </TableCell>
    </TableRow>
  );
}
