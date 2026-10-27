"use client";

import { Button } from "@/components/ui/button";
import { deleteSite } from "../../actions";

export function DeleteSiteButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteSite}
      onSubmit={(e) => {
        if (!confirm(`Delete "${name}" and all its reports? The plugin on that site will stop connecting.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="destructive">
        Delete site
      </Button>
    </form>
  );
}
