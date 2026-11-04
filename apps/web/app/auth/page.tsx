"use client";
import { useState } from "react";
import Link from "next/link";
import { api, cloudEnabled } from "@/lib/api";
import { Btn, Field, Input, Panel } from "@/components/ui";

export default function AuthPage() {
  const [email, setEmail] = useState(""); const [sent, setSent] = useState<string | null>(null); const [devLink, setDevLink] = useState<string | null>(null); const [err, setErr] = useState("");
  const send = async () => { setErr(""); try { const r = await api.requestLink(email); setSent(email); if (r.dev_link) setDevLink(r.dev_link); } catch (e) { setErr((e as Error).message); } };
  return (
    <main className="dots-warm flex min-h-screen items-center justify-center p-6">
      <Panel className="w-full max-w-md" title="Sign in">
        {!cloudEnabled() && <div className="mb-3 rounded-[12px] border border-amber/40 bg-amber/10 p-3 text-[12px] text-amber">Cloud is not configured (NEXT_PUBLIC_API_URL). Projects stay in this browser.</div>}
        {!sent ? (
          <div className="space-y-3">
            <p className="text-[13px] text-ink-2">We email you a one-time link. No password.</p>
            <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="you@studio.com" /></Field>
            {err && <div className="text-[12px] text-danger">{err}</div>}
            <Btn variant="primary" className="w-full" disabled={!email.includes("@") || !cloudEnabled()} onClick={send}>Send magic link</Btn>
          </div>
        ) : (
          <div className="space-y-3 text-[13px]">
            <p>Check <span className="font-semibold">{sent}</span> for your sign-in link.</p>
            {devLink && <p className="text-[12px] text-ink-2">Development mode: <a className="text-accent underline" href={devLink}>open the link</a>.</p>}
          </div>
        )}
        <div className="mt-4 text-[12px]"><Link href="/" className="text-ink-2 hover:text-ink">← Back to projects</Link></div>
      </Panel>
    </main>
  );
}
