import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
import { cn } from "@/lib/utils";

export interface FormTabItem {
  id: string;
  label: React.ReactNode;
  hasError?: boolean;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface FormTabsProps {
  tabs: FormTabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export function FormTabs({
  tabs,
  value,
  defaultValue,
  onValueChange,
  className,
}: FormTabsProps) {
  const effectiveDefault = defaultValue || (tabs.length > 0 ? tabs[0].id : undefined);

  return (
    <Tabs
      value={value}
      defaultValue={effectiveDefault}
      onValueChange={onValueChange}
      className={cn("w-full", className)}
    >
      <TabsList className="w-full justify-start overflow-x-auto h-auto py-1.5 px-2 flex-wrap gap-1">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            disabled={tab.disabled}
            className="relative flex items-center gap-2 px-4 py-2"
          >
            <span>{tab.label}</span>
            {tab.hasError && (
              <span
                data-testid={`tab-error-dot-${tab.id}`}
                className="h-2 w-2 rounded-full bg-[#ff5f56] inline-block animate-pulse ring-1 ring-white"
                title="Validation Error in this tab"
              />
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="pt-2">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
