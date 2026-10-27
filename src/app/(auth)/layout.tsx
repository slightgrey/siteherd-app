export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12">
      <p className="text-lg font-semibold">WP Siteherd</p>
      {children}
    </main>
  );
}
