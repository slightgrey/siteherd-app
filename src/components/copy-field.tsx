"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex gap-2">
      <Input readOnly value={value} aria-label={label} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
      <Button type="button" variant="outline" onClick={copy} className="w-20">
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
