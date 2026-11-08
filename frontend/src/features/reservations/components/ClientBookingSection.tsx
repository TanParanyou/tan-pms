"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SelectPill } from "@/components/ui/select-pill";
import { DateTimeInput } from "@/components/ui/date-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoading } from "@/components/ui/mono-spinner";
import { FormField } from "@/components/forms/form-field";
import { PageHeader } from "@/components/layout/page-header";
import { useToast } from "@/hooks/use-toast";
import { CENTRAL_PROPERTIES } from "@/constants/master-data";
import { formatDecimal } from "@/lib/formatters";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import {
  useClientAvailability,
  useCreateClientHoldMutation,
  type ClientAvailabilityParams,
} from "@/features/client/api/use-client-reservations";
import { CLIENT_STAY_MODES, DEFAULT_CLIENT_STAY_MODE } from "@/features/client/constants";
import type { UnitTypeAvailabilityDto } from "../types";

/** datetime-local value to ISO instant; returns "" for an invalid value. */
function toIso(local: string): string {
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export function ClientBookingSection() {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("client.booking");
  const tPortal = useTranslations("client.portal.booking");
  const tModes = useTranslations("stayModes");
  const tCommon = useTranslations("common");
  const { toastSuccess, toastApiError } = useToast();

  const [propertyId, setPropertyId] = useState<string>(CENTRAL_PROPERTIES[0].id);
  const [stayMode, setStayMode] = useState<string>(DEFAULT_CLIENT_STAY_MODE);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [searchError, setSearchError] = useState(false);
  const [params, setParams] = useState<ClientAvailabilityParams | null>(null);
  const inFlight = useRef(false);

  const availability = useClientAvailability(params);
  const holdMutation = useCreateClientHoldMutation();

  const search = () => {
    const start = toIso(checkIn);
    const end = toIso(checkOut);
    if (!start || !end || new Date(end) <= new Date(start)) {
      setSearchError(true);
      return;
    }
    setSearchError(false);
    setParams({ propertyId, stayMode, slotStartAt: start, slotEndAt: end });
  };

  const book = async (item: UnitTypeAvailabilityDto) => {
    if (!params || holdMutation.isPending || inFlight.current || item.netAvailableQuota <= 0) return;
    inFlight.current = true;
    try {
      const created = await holdMutation.mutateAsync({
        propertyId: params.propertyId,
        unitTypeId: item.unitType.id,
        stayMode: params.stayMode as "Hourly" | "Daily" | "Monthly",
        slotStartAt: params.slotStartAt,
        slotEndAt: params.slotEndAt,
      });
      toastSuccess(tPortal("toastHoldCreated"));
      router.push(`/client/reservations/${created.id}`);
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
    }
  };

  const items = availability.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader prefixCode="RES" title={t("title")} description={t("description")} />
      <div className="space-y-4 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField id="book-property" label={tPortal("fieldProperty")}>
            <SelectPill id="book-property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)} wrapperClassName="!mb-0">
              {CENTRAL_PROPERTIES.map((p) => (
                <option key={p.id} value={p.id}>
                  {resolveLocalizedText(p.name, locale)} ({p.code})
                </option>
              ))}
            </SelectPill>
          </FormField>
          <FormField label={t("searchStayMode")}>
            <div className="flex flex-wrap items-center gap-2">
              {CLIENT_STAY_MODES.map((mode) => (
                <Button
                  key={mode}
                  type="button"
                  size="sm"
                  variant={stayMode === mode ? "default" : "outline"}
                  onClick={() => setStayMode(mode)}
                  className="h-8 rounded-full px-4 text-xs"
                >
                  {tModes(mode)}
                </Button>
              ))}
            </div>
          </FormField>
          <FormField id="book-checkin" label={t("searchCheckIn")} required>
            <DateTimeInput id="book-checkin" mode="datetime" value={checkIn} onValueChange={setCheckIn} placeholder={t("searchCheckIn")} />
          </FormField>
          <FormField
            id="book-checkout"
            label={t("searchCheckOut")}
            required
            error={searchError ? tPortal("errorInvalidWindow") : undefined}
          >
            <DateTimeInput
              id="book-checkout"
              mode="datetime"
              value={checkOut}
              onValueChange={setCheckOut}
              hasError={searchError}
              placeholder={t("searchCheckOut")}
            />
          </FormField>
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={search} disabled={availability.isFetching} className="h-10 rounded-full px-5 gap-1.5 text-xs">
            <Search className="h-4 w-4" />
            <span>{t("searchButton")}</span>
          </Button>
        </div>
      </div>

      {params === null && <p className="text-xs text-mute">{tPortal("searchHint")}</p>}
      {params !== null && availability.isLoading && <PageLoading message={tCommon("loading")} />}
      {params !== null && availability.isError && (
        <EmptyState title={tPortal("availabilityError")} actionLabel={tCommon("retry")} onAction={() => void availability.refetch()} />
      )}
      {params !== null && !availability.isLoading && !availability.isError && items.length === 0 && (
        <EmptyState title={tPortal("noAvailability")} description={tPortal("noAvailabilityDescription")} />
      )}
      {items.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-rounded text-sm font-semibold text-ink">{t("availableRooms")}</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {items.map((item) => {
              const isAvailable = item.netAvailableQuota > 0;
              return (
                <div key={item.unitType.id} className="flex flex-col justify-between space-y-4 rounded-[12px] border border-hairline bg-canvas p-5">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-rounded text-sm font-semibold text-ink">{resolveLocalizedText(item.unitType.name, locale)}</h4>
                        <span className="font-mono text-xs text-mute">
                          {item.unitType.code} • {item.unitType.areaSqm} m²
                        </span>
                      </div>
                      <Badge variant={isAvailable ? "default" : "outline"} className="shrink-0 text-[10px]">
                        {isAvailable ? t("quotaRoomsLeft", { count: item.netAvailableQuota }) : t("quotaExhausted")}
                      </Badge>
                    </div>
                    <div className="space-y-1 border-t border-hairline pt-2 font-mono text-xs">
                      <div className="text-sm font-bold text-ink">{t("rateStartingFrom", { rate: formatDecimal(item.estimatedRoomRate, 0) })}</div>
                      <div className="text-[11px] text-mute">{t("depositRequired", { amount: formatDecimal(item.estimatedDepositAmount, 0) })}</div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    disabled={!isAvailable || holdMutation.isPending}
                    onClick={() => void book(item)}
                    className="h-9 w-full rounded-full text-xs"
                  >
                    {holdMutation.isPending ? tCommon("loading") : t("bookNow")}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
