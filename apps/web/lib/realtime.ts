"use client";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { create } from "zustand";
import { projectToDoc, docToProject, colorFor, type Presence } from "@saturn/realtime";
import { parseProject, type Project } from "@saturn/model";
import { useEditor } from "./store";
import { API_URL, getToken } from "./api";

interface LiveState { connected: boolean; projectId: string | null; peers: Presence[]; error: string | null; set: (p: Partial<LiveState>) => void }
export const useLive = create<LiveState>((set) => ({ connected: false, projectId: null, peers: [], error: null, set: (p) => set(p) }));

let doc: Y.Doc | null = null; let provider: WebsocketProvider | null = null; let unsub: (() => void) | null = null; let applyingRemote = false;

/** Join the project's live room: local edits stream to peers, remote edits load into the editor, presence is shared. */
export function goLive(projectId: string, me: { id: string; name: string }) {
  leaveLive();
  const token = getToken(); if (!token) { useLive.getState().set({ error: "sign in first" }); return; }
  doc = new Y.Doc();
  const base = API_URL.startsWith("/") ? window.location.origin + API_URL : API_URL;
  const wsUrl = base.replace(/^http/, "ws") + "/rt"; // y-websocket appends /<room>
  provider = new WebsocketProvider(wsUrl, projectId, doc, { params: { token } });
  const aw = provider.awareness;
  aw.setLocalState({ id: me.id, name: me.name, color: colorFor(me.id), selected: useEditor.getState().selectedId, option: useEditor.getState().project?.active_option_id } satisfies Presence);
  provider.on("status", (e: { status: string }) => useLive.getState().set({ connected: e.status === "connected", error: null }));
  provider.on("connection-error", () => useLive.getState().set({ error: "live connection failed" }));
  const pushPeers = () => { const peers: Presence[] = []; aw.getStates().forEach((s, id) => { if (id !== aw.clientID && s && s.id) peers.push(s as Presence); }); useLive.getState().set({ peers }); };
  aw.on("change", pushPeers);
  // remote → editor
  const onRemote = (_u: Uint8Array, origin: unknown) => {
    if (origin === "local" || !doc) return;
    const p = docToProject(doc); if (!p) return;
    try { const parsed = parseProject(p); applyingRemote = true; useEditor.getState().load(parsed); } catch (e) { console.warn("remote doc invalid", e); } finally { applyingRemote = false; }
  };
  doc.on("update", onRemote);
  // editor → doc (also seeds the doc with the local project once synced)
  const pushLocal = (p: Project | null) => { if (!p || !doc || applyingRemote) return; projectToDoc(doc, p as unknown as Record<string, unknown>, "local"); };
  provider.once("sync", (synced: boolean) => { if (synced && doc) { const remote = docToProject(doc); if (!remote) pushLocal(useEditor.getState().project); } });
  const unsubStore = useEditor.subscribe((s, prev) => {
    if (s.project !== prev.project) pushLocal(s.project);
    if (s.selectedId !== prev.selectedId || s.project?.active_option_id !== prev.project?.active_option_id) { aw.setLocalStateField("selected", s.selectedId); aw.setLocalStateField("option", s.project?.active_option_id); }
  });
  unsub = () => { unsubStore(); doc?.off("update", onRemote); aw.off("change", pushPeers); };
  useLive.getState().set({ projectId, error: null });
}
export function leaveLive() {
  unsub?.(); unsub = null; provider?.destroy(); provider = null; doc?.destroy(); doc = null;
  useLive.getState().set({ connected: false, projectId: null, peers: [] });
}
