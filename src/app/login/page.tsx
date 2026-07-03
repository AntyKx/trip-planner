import { Luggage } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import GoogleSignInButton from "@/components/GoogleSignInButton";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
          <Luggage className="h-6 w-6 text-brand-600" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-ink-900">登入 Trip Planner</h1>
        <p className="mt-1 text-sm text-ink-500">
          使用 Google 帳號登入，只有你自己看得到你的行程
        </p>
        <div className="mt-6">
          <GoogleSignInButton />
        </div>
      </div>
    </main>
  );
}
