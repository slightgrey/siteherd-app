export { auth as proxy } from "@/auth";

export const config = {
  // API routes authenticate on their own (HMAC for the plugin, Auth.js for /api/auth).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
