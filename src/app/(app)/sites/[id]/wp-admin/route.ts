import { notFound } from "next/navigation";
import { ssoUserFor } from "@/lib/report";
import { loadSite } from "@/lib/site";
import { createSsoToken, ssoLoginUrl } from "@/lib/sso";

/**
 * One-click login: the WP Admin button posts here (a plain form POST so it can
 * open a new tab), and we redirect the browser to the site's signed login URL.
 * POST, not GET, so link prefetching or a stray <img> can't mint tokens.
 */
export async function POST(request: Request, ctx: RouteContext<"/sites/[id]/wp-admin">) {
  // Form posts from other sites carry their own Origin; only accept ours.
  const appOrigin = process.env.APP_URL ? new URL(process.env.APP_URL).origin : null;
  if (!appOrigin || request.headers.get("origin") !== appOrigin) {
    return new Response("Forbidden", { status: 403 });
  }

  const { id } = await ctx.params;
  const data = await loadSite(id); // redirects to /login when logged out
  if (!data) notFound();

  const form = await request.formData();
  const requested = Number(form.get("user"));
  const userId = ssoUserFor(data.report?.sso ?? null, Number.isInteger(requested) ? requested : undefined);
  if (!userId) {
    // Not available (older plugin, turned off, or no valid admin chosen): fall back to the normal login page.
    return Response.redirect(`${data.site.url}/wp-admin/`, 303);
  }

  const token = createSsoToken(data.site.secret, data.site.id, userId);
  return Response.redirect(ssoLoginUrl(data.site.url, token), 303);
}
