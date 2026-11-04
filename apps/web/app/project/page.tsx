"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { loadProject } from "@/lib/storage";
import { useEditor } from "@/lib/store";
import Editor from "@/components/editor/Editor";

function ProjectInner() {
  const sp = useSearchParams(); const id = sp.get("id") ?? "";
  const load = useEditor((s) => s.load); const project = useEditor((s) => s.project);
  const [missing, setMissing] = useState(false);
  useEffect(() => { if (!id) { setMissing(true); return; } const p = loadProject(id); if (p) { useEditor.setState({ readonly: false }); load(p); } else setMissing(true); }, [id, load]);
  if (missing) return <main className="dots p-8 text-ink-2">Project not found. <Link className="text-accent" href="/">Back to projects</Link></main>;
  if (!project || project.id !== id) return <main className="dots p-8 text-ink-3">Loading…</main>;
  return <Editor />;
}
export default function ProjectPage() { return <Suspense fallback={<main className="dots p-8 text-ink-3">Loading…</main>}><ProjectInner /></Suspense>; }
