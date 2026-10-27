import { AuthForm } from "../auth-form";

export const metadata = { title: "Log in · WP Siteherd" };

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
