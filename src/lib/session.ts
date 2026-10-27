import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Call at the top of every page component and server action that touches a
// user's data. The proxy is only a first gate; this is the real check.
export async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/login");
  return { id, email: session.user?.email ?? "" };
}
