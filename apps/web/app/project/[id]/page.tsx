"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { loadProject } from "@/lib/storage";
import { useEditor } from "@/lib/store";
import Editor from "@/components/editor/Editor";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const load = useEditor((s) => s.load); const project = useEditor((s) => s.project);
  const [missing, setMissing] = useState(false);
  useEffect(() => { const p = loadProject(id); if (p) load(p); else setMissing(true); }, [id, load]);
  if (missing) return <main className="p-8 text-slate-300">Project not found. <Link className="text-sky-400" href="/">Back to projects</Link></main>;
  if (!project || project.id !== id) return <main className="p-8 text-slate-500">Loading…</main>;
  return <Editor />;
}
