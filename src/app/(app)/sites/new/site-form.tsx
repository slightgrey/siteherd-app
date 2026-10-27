"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSite } from "../../actions";

export function SiteForm() {
  const [state, action, pending] = useActionState(createSite, undefined);

  return (
    <form action={action} className="mt-6 grid gap-4">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" placeholder="Acme Bakery" defaultValue={state?.name} maxLength={100} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="url">Site address</Label>
        <Input id="url" name="url" placeholder="https://acmebakery.com" defaultValue={state?.url} required />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add site"}
        </Button>
        <Link href="/sites" className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
