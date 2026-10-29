export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Brand panel: the sidebar's night surface, so the login reads as the same product. */}
      <section className="dark relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-[10px] bg-sidebar-primary font-display text-base font-bold tracking-tight text-sidebar-primary-foreground">
            sh
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">SiteHerd</span>
        </div>
        <div aria-hidden="true" className="grid w-fit grid-cols-8 gap-4">
          {Array.from({ length: 40 }, (_, i) => (
            <span
              key={i}
              className={
                [3, 9, 14, 20, 27, 33].includes(i)
                  ? "size-4 rounded-[5px] bg-sidebar-primary"
                  : i === 22
                    ? "size-4 rounded-[5px] bg-brass"
                    : "size-4 rounded-[5px] bg-sidebar-accent"
              }
            />
          ))}
        </div>
        <div className="max-w-md">
          <p className="font-display text-4xl leading-[1.05] font-semibold tracking-tight text-balance">
            Every client site, one calm console.
          </p>
          <p className="mt-4 text-sm leading-6 text-sidebar-muted">
            Updates, vulnerabilities, Site Health, file integrity and login attacks across your whole WordPress fleet.
          </p>
        </div>
      </section>
      <div className="flex flex-col items-center justify-center gap-6 px-4 py-12">
        <p className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight lg:hidden">
          <span className="flex size-8 items-center justify-center rounded-[10px] bg-primary text-sm font-bold text-primary-foreground">
            sh
          </span>
          SiteHerd
        </p>
        {children}
      </div>
    </main>
  );
}
