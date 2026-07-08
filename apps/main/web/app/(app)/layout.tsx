import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@account-books/supabase-client";
import { isAdminEmail } from "@/lib/admin";
import { AppShell } from "./AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell email={user.email ?? ""} isAdmin={isAdminEmail(user.email)}>
      {children}
    </AppShell>
  );
}
