"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, verifyCredentials } from "@/server/auth";
import { loginSchema, parseForm, type ActionState } from "@/server/validation";

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseForm(loginSchema, formData);
  if (!parsed.ok) return { error: parsed.error };

  const session = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (!session) return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };

  await createSession(session);
  redirect("/admin");
}

export async function logoutAction() {
  await destroySession();
  redirect("/admin/login");
}
