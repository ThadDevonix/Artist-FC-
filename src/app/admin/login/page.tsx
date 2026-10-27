import { BackLink } from "@/components/ui";
import { redirect } from "next/navigation";
import { ActionForm, Field, SubmitButton, inputClass } from "@/components/admin/Form";
import { loginAction } from "@/server/actions";
import { getSession } from "@/server/auth";
import { Logo } from "@/components/Logo";

export const metadata = { title: "เข้าสู่ระบบ" };

export default async function LoginPage() {
  if (await getSession()) redirect("/admin");

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={88} />
          <h1 className="mt-3 text-2xl font-bold tracking-tight">Artist FC</h1>
          <p className="mt-1 text-sm text-muted">ระบบจัดการหลังบ้าน</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6">
          <ActionForm action={loginAction} className="space-y-4">
            <Field label="อีเมล">
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                className={inputClass}
                placeholder="admin@artistfc.local"
              />
            </Field>
            <Field label="รหัสผ่าน">
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={inputClass}
              />
            </Field>
            <SubmitButton className="w-full">เข้าสู่ระบบ</SubmitButton>
          </ActionForm>
        </div>

        <div className="mt-6 text-center">
          <BackLink href="/">กลับหน้าเว็บ</BackLink>
        </div>
      </div>
    </div>
  );
}
