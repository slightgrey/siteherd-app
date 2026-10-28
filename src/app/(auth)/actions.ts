"use server";

import { sql } from "drizzle-orm";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, normalizeEmail } from "@/lib/password";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";
import { signupPolicy } from "@/lib/signup-policy";

export type AuthFormState = { error?: string; email?: string } | undefined;

async function signInOrError(email: string, password: string): Promise<AuthFormState> {
  try {
    // On success this throws a redirect, which must propagate.
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (e) {
    if (e instanceof AuthError) return { error: "Wrong email or password.", email };
    throw e;
  }
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  return signInOrError(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
}

export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address.", email };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, email };
  }

  if (!signupPolicy(process.env, 0).emailAllowed(email)) return { error: "Sign up is restricted on this dashboard.", email };

  const passwordHash = await hashPassword(password);
  const outcome = await db.transaction(async (tx) => {
    // Serialize signups, so two at once can't both get under MAX_ACCOUNTS.
    await tx.execute(sql`select pg_advisory_xact_lock(${SIGNUP_LOCK})`);
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(users);
    if (!signupPolicy(process.env, n).open) return "closed" as const;
    const created = await tx.insert(users).values({ email, passwordHash }).onConflictDoNothing().returning({ id: users.id });
    return created.length > 0 ? ("created" as const) : ("exists" as const);
  });
  if (outcome === "closed") return { error: "This dashboard already has its account. Log in instead.", email };
  if (outcome === "exists") return { error: "An account with this email already exists. Log in instead.", email };

  return signInOrError(email, password);
}

// Arbitrary key for pg_advisory_xact_lock around signups.
const SIGNUP_LOCK = 72_610_402;
