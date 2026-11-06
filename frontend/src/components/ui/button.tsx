import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-[#000000] text-[#ffffff] hover:bg-[#090909] active:bg-[#090909]",
        outline: "border border-[#e5e5e5] bg-[#ffffff] text-[#000000] hover:bg-[#fafafa] hover:border-[#d4d4d4]",
        secondary: "bg-[#fafafa] text-[#000000] border border-[#e5e5e5] hover:bg-[#f0f0f0]",
        ghost: "hover:bg-[#fafafa] text-[#000000]",
        link: "text-[#000000] underline-offset-4 hover:underline",
        onDark: "bg-[#ffffff] text-[#000000] hover:bg-[#f0f0f0] active:bg-[#e5e5e5]",
        destructive: "bg-[#ff5f56] text-[#ffffff] hover:bg-[#e04f46]",
      },
      size: {
        default: "h-9 px-5 py-2",
        sm: "h-8 rounded-full px-4 text-xs",
        lg: "h-11 rounded-full px-7 text-base",
        icon: "h-10 w-10 p-0 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
