import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, normalizeEmail, verifyPassword } from "@/lib/password";

const PUBLIC_PATHS = new Set(["/login", "/signup"]);

// Compared against when the email is unknown, so a miss takes as long as a
// wrong password and response timing doesn't reveal which emails exist.
const dummyHash = hashPassword("dummy-password-for-timing");

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Credentials logins only work with JWT sessions (no DB session table).
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const { email, password } = credentials;
        if (typeof email !== "string" || typeof password !== "string") return null;

        const user = await db.query.users.findFirst({ where: eq(users.email, normalizeEmail(email)) });
        if (!user) {
          await verifyPassword(password, await dummyHash);
          return null;
        }
        if (!(await verifyPassword(password, user.passwordHash))) return null;
        return { id: user.id, email: user.email };
      },
    }),
  ],
  callbacks: {
    // Used by src/proxy.ts to gate pages. Pages and actions still check the
    // session themselves via requireUser().
    authorized({ auth, request }) {
      return PUBLIC_PATHS.has(request.nextUrl.pathname) || !!auth;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
