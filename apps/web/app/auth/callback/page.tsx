"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, setToken } from "@/lib/api";

function Callback() {
  const sp = useSearchParams(); const router = useRouter(); const [err, setErr] = useState("");
  useEffect(() => { const t = sp.get("token"); if (!t) { setErr("Missing token"); return; } api.verify(t).then((r) => { setToken(r.token); router.replace("/"); }).catch((e) => setErr((e as Error).message)); }, [sp, router]);
  return <main className="dots flex min-h-screen items-center justify-center text-[13px] text-ink-2">{err ? `Sign-in failed: ${err}` : "Signing you in…"}</main>;
}
export default function CallbackPage() { return <Suspense fallback={null}><Callback /></Suspense>; }
