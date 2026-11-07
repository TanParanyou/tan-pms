"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Button } from "./button";
import { Input } from "./input";
import { Tooltip } from "./tooltip";
import { MonoSpinner } from "./mono-spinner";
import { Check, ChevronsUpDown, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EntityAutocompleteOption {
  value: string;
  label: string;
  sublabel?: string;
  code?: string;
  disabled?: boolean;
}

export interface EntityAutocompleteProps {
  options: EntityAutocompleteOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  isLoading?: boolean;
  disabled?: boolean;
  hasError?: boolean;
  id?: string;
  wrapperClassName?: string;
  /** Server-side search: when provided, options are not filtered locally. */
  onSearchChange?: (search: string) => void;
  adjacentAction?: {
    tooltip: string;
    ariaLabel: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
}

export function EntityAutocomplete({
  options,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder = "Search...",
  emptyMessage = "No results found",
  isLoading = false,
  disabled = false,
  hasError = false,
  id,
  wrapperClassName,
  onSearchChange,
  adjacentAction,
}: EntityAutocompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);

  // O(1) map resolution (zero .find())
  const optionsMap = React.useMemo(() => {
    const map = new Map<string, EntityAutocompleteOption>();
    for (const opt of options) {
      map.set(opt.value, opt);
    }
    return map;
  }, [options]);

  const selectedOption = optionsMap.get(value);

  const filteredOptions = React.useMemo(() => {
    if (onSearchChange || !search.trim()) return options;
    const query = search.toLowerCase();
    return options.filter((opt) => {
      const matchLabel = opt.label.toLowerCase().includes(query);
      const matchSub = opt.sublabel?.toLowerCase().includes(query) ?? false;
      const matchCode = opt.code?.toLowerCase().includes(query) ?? false;
      return matchLabel || matchSub || matchCode;
    });
  }, [options, search, onSearchChange]);

  React.useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredOptions.length]);

  const handleSelect = (val: string) => {
    onValueChange(val);
    setOpen(false);
    setSearch("");
    onSearchChange?.("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = filteredOptions[highlightedIndex];
      if (current && !current.disabled) {
        handleSelect(current.value);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  const triggerContent = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-invalid={hasError ? true : undefined}
          disabled={disabled}
          onKeyDown={handleKeyDown}
          className={cn(
            "flex h-control min-h-control w-full items-center justify-between rounded-full border bg-canvas px-4 py-2 text-sm text-ink transition-colors",
            "focus-visible:outline-none focus-visible:ring-2",
            hasError
              ? "border-destructive focus-visible:ring-destructive/40"
              : "border-hairline focus-visible:ring-focus-ring",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          <span className="truncate flex-1 text-left">
            {selectedOption ? (
              <span className="flex items-center gap-1.5 truncate">
                {selectedOption.code && (
                  <span className="font-mono text-xs text-mute uppercase">
                    [{selectedOption.code}]
                  </span>
                )}
                <span className="truncate">{selectedOption.label}</span>
                {selectedOption.sublabel && (
                  <span className="text-xs text-mute truncate">
                    ({selectedOption.sublabel})
                  </span>
                )}
              </span>
            ) : (
              <span className="text-mute">{placeholder}</span>
            )}
          </span>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            {value && !disabled && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear selection"
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleClear(e as unknown as React.MouseEvent);
                  }
                }}
                className="p-0.5 text-mute hover:text-ink rounded-full transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 text-mute shrink-0" />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-2 rounded-[12px] border border-hairline bg-canvas shadow-lg"
      >
        <div className="relative mb-2">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              onSearchChange?.(e.target.value);
            }}
            placeholder={searchPlaceholder}
            className="pl-8 h-9 text-xs rounded-full"
            autoFocus
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-mute pointer-events-none" />
        </div>

        <div
          role="listbox"
          className="max-h-60 overflow-y-auto space-y-1 py-1 pr-1"
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-mute">
              <MonoSpinner size="sm" />
              <span>Loading...</span>
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="py-6 text-center text-xs text-mute">
              {emptyMessage}
            </div>
          ) : (
            filteredOptions.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isHighlighted = idx === highlightedIndex;

              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={opt.disabled}
                  onClick={() => handleSelect(opt.value)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-xs rounded-md text-left transition-colors",
                    isHighlighted ? "bg-surface-soft text-ink" : "text-body",
                    isSelected && "font-medium text-ink bg-surface-soft",
                    opt.disabled && "cursor-not-allowed opacity-40"
                  )}
                >
                  <div className="flex flex-col truncate pr-2">
                    <span className="flex items-center gap-1.5 truncate">
                      {opt.code && (
                        <span className="font-mono text-[11px] text-mute uppercase">
                          [{opt.code}]
                        </span>
                      )}
                      <span className="truncate">{opt.label}</span>
                    </span>
                    {opt.sublabel && (
                      <span className="text-[11px] text-mute truncate mt-0.5">
                        {opt.sublabel}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-ink" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );

  if (adjacentAction) {
    return (
      <div className={cn("flex items-center gap-2 w-full", wrapperClassName)}>
        <div className="relative flex-1 min-w-0">{triggerContent}</div>
        <Tooltip content={adjacentAction.tooltip} position="top">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={adjacentAction.ariaLabel}
            onClick={adjacentAction.onClick}
            className="rounded-full h-control min-h-control w-10 shrink-0 border-hairline hover:bg-surface-soft transition-colors"
          >
            {adjacentAction.icon || <Plus className="h-4 w-4" />}
          </Button>
        </Tooltip>
      </div>
    );
  }

  if (wrapperClassName) {
    return <div className={cn("relative w-full", wrapperClassName)}>{triggerContent}</div>;
  }

  return triggerContent;
}
