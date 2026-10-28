import { normalizeEmail } from "./password";

// Who may create an account, from the environment:
//   SIGNUP_EMAILS  comma-separated emails allowed to sign up (unset: anyone)
//   MAX_ACCOUNTS   signup closes once this many accounts exist (unset: no limit)
// Neither set (local dev): signup is open.

export type SignupPolicy = {
  /** False once MAX_ACCOUNTS accounts exist. */
  open: boolean;
  emailAllowed: (email: string) => boolean;
};

export function signupPolicy(env: Record<string, string | undefined>, existingUsers: number): SignupPolicy {
  const allowed = (env.SIGNUP_EMAILS ?? "")
    .split(",")
    .map((e) => normalizeEmail(e))
    .filter((e) => e !== "");
  const max = Number.parseInt(env.MAX_ACCOUNTS ?? "", 10);
  return {
    open: !(Number.isFinite(max) && max >= 0 && existingUsers >= max),
    emailAllowed: (email) => allowed.length === 0 || allowed.includes(normalizeEmail(email)),
  };
}
