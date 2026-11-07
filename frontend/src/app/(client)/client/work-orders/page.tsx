"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectPill } from "@/components/ui/select-pill";
import { CommandTag } from "@/components/ui/command-tag";
import { Alert } from "@/components/ui/alert";
import { DeferredFilePicker } from "@/components/ui/deferred-file-picker";
import { useDeferredFileUpload } from "@/hooks/use-deferred-file-upload";
import { useTranslations } from "next-intl";
import { MAINTENANCE_CATEGORIES } from "@/features/client/constants";

export default function ClientWorkOrdersPage() {
  const tWork = useTranslations("client.workOrders");
  const tPlaceholders = useTranslations("common.placeholders");

  const [workCategory, setWorkCategory] = useState("Air Conditioning");
  const [workDescription, setWorkDescription] = useState("");
  const [workOrderNotice, setWorkOrderNotice] = useState<string | null>(null);

  const {
    queuedFiles,
    stageFiles,
    removeFile,
    commitUploads,
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
      <PageHeader
        prefixCode="WKO"
        title="Maintenance & Work Orders"
        description="Submit repair requests for air conditioning, plumbing, electrical, and furniture defects"
      />

      <Card className="rounded-[12px] border border-hairline p-6 space-y-4 shadow-none bg-canvas">
        <CardHeader className="p-0 pb-2">
          <div className="flex items-center gap-2">
            <CommandTag prefixCode="WKO">MAINTENANCE</CommandTag>
            <span className="text-xs text-mute font-mono">Unit A-301</span>
          </div>
        </CardHeader>

        {workOrderNotice && (
          <Alert variant="info" className="text-xs font-mono py-2 bg-surface-soft border border-hairline">
            {workOrderNotice}
          </Alert>
        )}

        <form onSubmit={handleSubmitWorkOrder} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="category-select" className="text-xs font-medium text-ink">
              {tWork("fieldCategory")}
            </Label>
            <SelectPill
              id="category-select"
              value={workCategory}
              onChange={(e) => setWorkCategory(e.target.value)}
              className="h-10 text-xs font-mono"
            >
              {MAINTENANCE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </SelectPill>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="work-desc" className="text-xs font-medium text-ink">
              {tWork("fieldDescription")}
            </Label>
            <Input
              id="work-desc"
              value={workDescription}
              onChange={(e) => setWorkDescription(e.target.value)}
              placeholder={tPlaceholders("workDescription")}
              className="h-10 rounded-full text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-ink">
              {tWork("fieldAttachment")}
            </Label>
            <DeferredFilePicker
              queuedFiles={queuedFiles}
              onFilesSelected={stageFiles}
              onRemoveFile={removeFile}
              accept="image/*"
              multiple
            />
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              className="rounded-full text-xs h-10 px-6 font-medium shadow-none"
            >
              {tWork("submitButton")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
