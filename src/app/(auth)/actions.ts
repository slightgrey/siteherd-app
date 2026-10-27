"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, normalizeEmail } from "@/lib/password";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";

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

  const created = await db
    .insert(users)
    .values({ email, passwordHash: await hashPassword(password) })
    .onConflictDoNothing()
    .returning({ id: users.id });
  if (created.length === 0) return { error: "An account with this email already exists. Log in instead.", email };

  return signInOrError(email, password);
}
