import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { signupPolicy } from "@/lib/signup-policy";

/** Whether to offer signup at all (the signup action checks again). */
export async function isSignupOpen(): Promise<boolean> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  return signupPolicy(process.env, n).open;
}
