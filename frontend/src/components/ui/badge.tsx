import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[#000000] text-[#ffffff]",
        secondary: "border-[#e5e5e5] bg-[#fafafa] text-[#000000]",
        destructive: "border-transparent bg-[#ff5f56] text-[#ffffff]",
        outline: "border-[#e5e5e5] text-[#000000] bg-[#ffffff]",
        success: "border-transparent bg-[#27c93f]/15 text-[#1b7e28]",
        warning: "border-transparent bg-[#ffbd2e]/20 text-[#966b0a]",
        mono: "border-[#e5e5e5] bg-[#fafafa] font-mono text-xs tabular-nums text-[#000000]",
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
