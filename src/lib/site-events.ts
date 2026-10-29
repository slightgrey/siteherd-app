import type { Sso } from "./report";

export type Admin = Sso["admins"][number];

/**
 * Administrators added and removed between two reports, by user id. Empty when
 * either report has no admin list (schema < 3), so a site's first report or a
 * plugin upgrade doesn't flag every existing admin as new.
 */
export function adminChanges(prev: Sso | null | undefined, next: Sso | null | undefined) {
  if (!prev || !next) return { added: [], removed: [] };
  const before = new Set(prev.admins.map((a) => a.id));
  const after = new Set(next.admins.map((a) => a.id));
  return {
    added: next.admins.filter((a) => !before.has(a.id)),
    removed: prev.admins.filter((a) => !after.has(a.id)),
  };
}
