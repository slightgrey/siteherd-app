"use client";

import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LabelChip } from "@/components/label-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LABEL_COLORS, LABEL_COLOR_KEYS, type LabelColor } from "@/lib/label-colors";
import { cn } from "@/lib/utils";
import { addLabel, editLabel, removeLabel } from "../actions";

type Label = { id: string; name: string; color: LabelColor; sites: number };

function ColorPicker({ value, onChange }: { value: LabelColor; onChange: (c: LabelColor) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Color">
      {LABEL_COLOR_KEYS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={LABEL_COLORS[c].name}
          title={LABEL_COLORS[c].name}
          onClick={() => onChange(c)}
          className={cn(
            "size-6 rounded-full ring-offset-2 ring-offset-background transition",
            LABEL_COLORS[c].dot,
            value === c ? "ring-2 ring-foreground" : "hover:scale-110",
          )}
        />
      ))}
    </div>
  );
}

export function LabelsManager({ labels }: { labels: Label[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState<LabelColor>("blue");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addLabel({ name, color });
      if (!result.ok) return setError(result.error);
      setName("");
      router.refresh();
    });
  };

  return (
    <div className="mt-6 grid max-w-3xl gap-6">
      <form onSubmit={create} className="grid gap-3 rounded-lg border p-4">
        <div className="text-sm font-medium">New label</div>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Vince Layte"
            maxLength={40}
            className="w-64"
            aria-label="Label name"
          />
          <ColorPicker value={color} onChange={setColor} />
          <Button type="submit" size="sm" disabled={pending || name.trim() === ""}>
            <Plus />
            Add label
          </Button>
        </div>
        {name.trim() && (
          <div className="text-xs text-muted-foreground">
            Preview: <LabelChip label={{ name: name.trim(), color }} />
          </div>
        )}
        {error && <p className="text-sm text-bad">{error}</p>}
      </form>

      {labels.length === 0 ? (
        <p className="text-sm text-muted-foreground">No labels yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {labels.map((l) => (
            <LabelRow key={l.id} label={l} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LabelRow({ label }: { label: Label }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState(label.color);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await editLabel(label.id, { name, color });
      if (!result.ok) return setError(result.error);
      setEditing(false);
      router.refresh();
    });
  };
  const remove = () => {
    const on = label.sites === 0 ? "" : ` It will be removed from ${label.sites} ${label.sites === 1 ? "site" : "sites"}; the sites stay.`;
    if (!confirm(`Delete the label "${label.name}"?${on}`)) return;
    startTransition(async () => {
      await removeLabel(label.id);
      router.refresh();
    });
  };

  if (editing) {
    return (
      <li className="px-4 py-3">
        <form onSubmit={save} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="w-64" aria-label="Label name" autoFocus />
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending || name.trim() === ""}>
              <Check />
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setName(label.name);
                setColor(label.color);
                setError(null);
              }}
            >
              <X />
              Cancel
            </Button>
          </div>
          {error && <p className="text-sm text-bad">{error}</p>}
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <LabelChip label={label} />
      <Link href={`/sites?label=${label.id}`} className="text-sm text-muted-foreground hover:underline">
        {label.sites} {label.sites === 1 ? "site" : "sites"}
      </Link>
      <div className="ml-auto flex gap-1">
        <Button variant="ghost" size="xs" onClick={() => setEditing(true)}>
          <Pencil />
          Edit
        </Button>
        <Button variant="ghost" size="xs" disabled={pending} onClick={remove} className="text-bad hover:text-bad/80">
          <Trash2 />
          Delete
        </Button>
      </div>
    </li>
  );
}
