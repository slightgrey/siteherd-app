export function PageHeader({
  title,
  description,
  action,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-[14px] border border-dashed border-input bg-card p-12 text-center">
      <p className="font-display text-lg font-semibold tracking-tight">{title}</p>
      {children && <div className="mt-1 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
