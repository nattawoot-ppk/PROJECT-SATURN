"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Cloud, MessageSquare, Check, LogIn, UploadCloud, Radio } from "lucide-react";
import { goLive, leaveLive, useLive } from "@/lib/realtime";
import { useEditor } from "@/lib/store";
import { useCloud } from "@/lib/cloud";
import { api, cloudEnabled } from "@/lib/api";
import { Btn, Chip, Divider, Input, StatTile } from "@/components/ui";

export function CloudPanel() {
  const project = useEditor((s) => s.project)!; const load = useEditor((s) => s.load); const selectedId = useEditor((s) => s.selectedId);
  const live = useLive();
  const c = useCloud(); const [comments, setComments] = useState<Awaited<ReturnType<typeof api.comments>>>([]); const [draft, setDraft] = useState("");
  const refresh = c.refresh;
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (c.cloudId && c.me) api.comments(c.cloudId).then(setComments).catch(() => setComments([])); }, [c.cloudId, c.me]);
  if (!cloudEnabled()) return <div className="space-y-2 text-[12.5px] text-ink-2"><div className="flex items-center gap-1.5 font-semibold text-ink"><Cloud size={14} /> Cloud</div><p>Set <span className="mono">NEXT_PUBLIC_API_URL</span> to the Saturn API to enable accounts, cloud projects, comments and billing. Until then projects stay in this browser and you can share read-only links.</p></div>;
  if (!c.me) return <div className="space-y-3 text-[12.5px]"><div className="flex items-center gap-1.5 font-semibold"><Cloud size={14} /> Cloud</div><p className="text-ink-2">Sign in to save this project to the cloud, invite your organisation and comment.</p><Link href="/auth"><Btn variant="primary" size="sm"><LogIn size={12} /> Sign in</Btn></Link></div>;
  const save = async () => {
    c.set({ syncing: true, error: null });
    try {
      if (c.cloudId && c.version !== null) { const r = await api.saveProject(c.cloudId, project, c.version); c.bind(r.id, r.version); }
      else { const r = await api.createProject(project, c.me?.orgs[0]?.id); c.bind(r.id, r.version); }
      c.set({ lastSync: new Date().toLocaleTimeString() });
    } catch (e) {
      const err = e as { status?: number; body?: { version?: number; document?: unknown }; message: string };
      if (err.status === 409 && err.body?.document) { if (confirm("Someone else saved a newer version. Load theirs (OK) or keep yours and overwrite (Cancel)?")) { load(err.body.document as typeof project); c.bind(c.cloudId, err.body.version ?? null); } else { const r = await api.saveProject(c.cloudId!, project, err.body.version ?? 0); c.bind(r.id, r.version); } }
      else c.set({ error: err.message });
    } finally { c.set({ syncing: false }); }
  };
  const add = async () => { if (!c.cloudId || !draft.trim()) return; await api.addComment(c.cloudId, draft.trim(), selectedId ? { buildingId: selectedId, optionId: project.active_option_id } : { optionId: project.active_option_id }); setDraft(""); setComments(await api.comments(c.cloudId)); };
  return (
    <div className="space-y-3 text-[12.5px]">
      <div className="flex items-center justify-between"><div className="flex items-center gap-1.5 font-semibold"><Cloud size={14} className="text-teal" /> Cloud</div><Chip tone="teal">{c.me.user.email}</Chip></div>
      <div className="grid grid-cols-2 gap-2">
        <StatTile label="Plan" value={(c.me.orgs[0]?.plan ?? "free").toUpperCase()} hint={c.me.orgs[0]?.name ?? "personal"} tone="accent" />
        <StatTile label="Cloud copy" value={c.cloudId ? `v${c.version}` : "—"} hint={c.lastSync ? `saved ${c.lastSync}` : "not saved yet"} tone={c.cloudId ? "teal" : "neutral"} />
      </div>
      <div className="flex gap-1.5"><Btn variant="primary" size="sm" disabled={c.syncing} onClick={save}><UploadCloud size={12} /> {c.syncing ? "Saving…" : c.cloudId ? "Save to cloud" : "Upload to cloud"}</Btn><Btn variant="ghost" size="sm" onClick={c.signOut}>Sign out</Btn></div>
      {c.error && <div className="text-danger">{c.error}</div>}
      <Divider />
      <div className="flex items-center justify-between"><div className="flex items-center gap-1.5 font-semibold"><Radio size={14} className={live.connected ? "text-teal" : "text-ink-3"} /> Live co-editing</div>
        {c.cloudId && (live.projectId ? <Btn size="sm" variant="outline" onClick={leaveLive}>Leave</Btn> : <Btn size="sm" variant="teal" onClick={() => goLive(c.cloudId!, { id: c.me!.user.id, name: c.me!.user.name ?? c.me!.user.email })}>Go live</Btn>)}</div>
      {!c.cloudId && <div className="text-[11px] text-ink-3">Save to cloud first, then go live to edit together.</div>}
      {live.projectId && (
        <div className="space-y-1 text-[12px]">
          <div className="text-ink-2">{live.connected ? "Connected" : "Connecting…"} · {live.peers.length} other{live.peers.length === 1 ? "" : "s"} online. Edits sync instantly; the room saves to the cloud every 5 s.</div>
          {live.peers.map((p) => <div key={p.id} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} /><span>{p.name}</span>{p.selected && <Chip tone="neutral">editing {project.options.flatMap((o) => o.buildings).find((b) => b.id === p.selected)?.name ?? "a building"}</Chip>}</div>)}
          {live.error && <div className="text-danger">{live.error}</div>}
        </div>
      )}
      <Divider />
      <div className="flex items-center gap-1.5 font-semibold"><MessageSquare size={14} /> Comments {c.cloudId ? "" : "(save to cloud first)"}</div>
      {comments.map((cm) => (
        <div key={cm.id} className={`rounded-[12px] border p-2 ${cm.resolved ? "border-line opacity-60" : "border-line bg-panel"}`}>
          <div className="flex items-center justify-between text-[11px] text-ink-3"><span>{cm.author.name ?? cm.author.email} · {new Date(cm.createdAt).toLocaleString()}</span><button className="hover:text-teal" title="Resolve" onClick={async () => { await api.resolveComment(cm.id, !cm.resolved); setComments(await api.comments(c.cloudId!)); }}><Check size={12} /></button></div>
          <div className="mt-1">{cm.body}</div>
          {cm.anchor && <div className="mt-1 text-[10.5px] text-ink-3">on {JSON.parse(cm.anchor).buildingId ? `building ${JSON.parse(cm.anchor).buildingId}` : "option"}</div>}
        </div>
      ))}
      {c.cloudId && <div className="flex gap-1.5"><Input value={draft} placeholder={selectedId ? "Comment on selected building…" : "Comment on this option…"} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} /><Btn size="sm" variant="ghost" onClick={add}>Post</Btn></div>}
    </div>
  );
}
