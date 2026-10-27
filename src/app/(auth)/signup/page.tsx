import { AuthForm } from "../auth-form";

export const metadata = { title: "Sign up · WP Siteherd" };

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
