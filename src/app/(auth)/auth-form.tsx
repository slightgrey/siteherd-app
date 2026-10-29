"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";
import { login, signup } from "./actions";

const copy = {
  login: {
    title: "Log in",
    description: "Monitor your WordPress sites.",
    submit: "Log in",
    switchText: "No account yet?",
    switchLink: { href: "/signup", label: "Sign up" },
  },
  signup: {
    title: "Create an account",
    description: "Start monitoring your WordPress sites.",
    submit: "Create account",
    switchText: "Already have an account?",
    switchLink: { href: "/login", label: "Log in" },
  },
};

/** `signupOpen`: on the login page, whether to link to signup (false once the dashboard has its account). */
export function AuthForm({ mode, signupOpen = true }: { mode: "login" | "signup"; signupOpen?: boolean }) {
  const [state, action, pending] = useActionState(mode === "login" ? login : signup, undefined);
  const text = copy[mode];

  return (
    <Card className="w-full max-w-sm py-6 [--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle className="text-2xl">{text.title}</CardTitle>
        <CardDescription>{text.description}</CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="grid gap-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" defaultValue={state?.email} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "signup" ? MIN_PASSWORD_LENGTH : undefined}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="mt-6 flex-col items-stretch gap-3">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Please wait…" : text.submit}
          </Button>
          {(mode === "signup" || signupOpen) && (
            <p className="text-center text-sm text-muted-foreground">
              {text.switchText}{" "}
              <Link href={text.switchLink.href} className="text-foreground underline underline-offset-4">
                {text.switchLink.label}
              </Link>
            </p>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
