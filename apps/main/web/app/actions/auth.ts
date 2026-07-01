"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@account-books/supabase-client";

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
