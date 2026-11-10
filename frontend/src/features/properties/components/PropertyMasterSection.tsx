"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { UnitMasterSection } from "./UnitMasterSection";
import { BuildingsPanel, UnitTypesPanel } from "./HierarchyPanels";

export function PropertyMasterSection() {
  const t = useTranslations("admin.properties");
  return (
    <div className="space-y-6">
      <PageHeader prefixCode="UNT" title={t("title")} description={t("description")} />
      <Tabs defaultValue="units">
        <TabsList>
          <TabsTrigger value="units">{t("tabUnits")}</TabsTrigger>
          <TabsTrigger value="buildings">{t("tabBuildings")}</TabsTrigger>
          <TabsTrigger value="unitTypes">{t("tabUnitTypes")}</TabsTrigger>
        </TabsList>
        <TabsContent value="units">
          <UnitMasterSection />
        </TabsContent>
        <TabsContent value="buildings">
          <BuildingsPanel />
        </TabsContent>
        <TabsContent value="unitTypes">
          <UnitTypesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
