import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { isSignupOpen } from "@/lib/signup-state";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Sign up · WP Siteherd" };

export default function SignupPage() {
  return (
    <Suspense>
      <Signup />
    </Suspense>
  );
}

async function Signup() {
  await connection();
  if (await isSignupOpen()) return <AuthForm mode="signup" />;
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign up is closed</CardTitle>
        <CardDescription>This dashboard already has its account.</CardDescription>
      </CardHeader>
      <CardFooter>
        <Link href="/login" className={`${buttonVariants()} w-full`}>
          Log in
        </Link>
      </CardFooter>
    </Card>
  );
}
