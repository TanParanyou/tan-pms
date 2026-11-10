import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-ink text-canvas",
        secondary: "border-hairline bg-surface-soft text-ink",
        destructive: "border-transparent bg-destructive text-canvas",
        outline: "border-hairline text-ink bg-canvas",
        overdue: "border-destructive/30 bg-destructive/10 text-destructive",
        success: "border-transparent bg-terminal-green/15 text-emerald-800",
        warning: "border-transparent bg-terminal-yellow/20 text-amber-700",
        mono: "border-hairline bg-surface-soft font-mono text-xs tabular-nums text-ink",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
