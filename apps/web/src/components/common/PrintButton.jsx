import React from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function PrintButton({
  label = "Print",
  className,
  size = "sm",
  variant = "outline",
  disabled = false,
  title,
}) {
  const handlePrint = () => {
    window.requestAnimationFrame(() => window.print());
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handlePrint}
      disabled={disabled}
      title={title || label}
      className={cn("gap-2", className)}
      data-print-hidden
    >
      <Printer className="w-4 h-4" />
      {label}
    </Button>
  );
}
