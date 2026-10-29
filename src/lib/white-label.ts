// White label texts. Pure, so client components and tests can use it too.

export const AGENCY_NAME_MAX = 60;

export type UserSettings = { agencyName: string | null };

/** Trimmed agency name, or null when empty or not a string. Whitespace runs collapse to one space. */
export function normalizeAgencyName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const name = input.replace(/\s+/g, " ").trim().slice(0, AGENCY_NAME_MAX).trim();
  return name === "" ? null : name;
}

/** Under the logo in the sidebar. */
export function brandSubtitle(agencyName: string | null): string {
  return agencyName ?? "WordPress fleet";
}

/** Title of the dashboard (fleet overview) page. */
export function fleetTitle(agencyName: string | null): string {
  return agencyName ? `Howdy, ${agencyName}!` : "Fleet overview";
}

/** What the WP Siteherd plugin calls itself on connected sites (see Siteherd_Branding::label()). */
export function pluginLabel(agencyName: string | null): string {
  return agencyName ? `${agencyName} WordPress Manager` : "WP Siteherd";
}
