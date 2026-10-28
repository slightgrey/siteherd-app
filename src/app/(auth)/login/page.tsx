import { connection } from "next/server";
import { Suspense } from "react";
import { isSignupOpen } from "@/lib/signup-state";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Log in · WP Siteherd" };

export default function LoginPage() {
  return (
    // Until the signup check finishes, show the form without the "Sign up" link.
    <Suspense fallback={<AuthForm mode="login" signupOpen={false} />}>
      <Login />
    </Suspense>
  );
}

async function Login() {
  await connection();
  return <AuthForm mode="login" signupOpen={await isSignupOpen()} />;
}
