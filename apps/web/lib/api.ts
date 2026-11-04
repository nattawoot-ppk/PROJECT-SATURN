"use client";
import type { Project } from "@saturn/model";

/** Thin client for the SATRN API. Disabled (returns null) when NEXT_PUBLIC_API_URL is not configured. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
export const cloudEnabled = () => API_URL.length > 0;
const TOKEN_KEY = "saturn.session";
export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const setToken = (t: string | null) => { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } };

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((json as { error?: string }).error ?? `HTTP ${res.status}`), { status: res.status, body: json });
  return json as T;
}

export interface Me { user: { id: string; email: string; name: string | null }; orgs: Array<{ id: string; name: string; plan: string; role: string; seats: number }> }
export const api = {
  me: () => call<Me>("/auth/me"),
  requestLink: (email: string) => call<{ ok: boolean; dev_link?: string }>("/auth/magic-link", { method: "POST", body: JSON.stringify({ email }) }),
  verify: (token: string) => call<{ ok: boolean; token: string; user: Me["user"] }>("/auth/verify", { method: "POST", body: JSON.stringify({ token }) }),
  logout: () => call<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  listProjects: () => call<Array<{ id: string; name: string; updatedAt: string; version: number; orgId: string | null }>>("/projects"),
  getProject: (id: string) => call<{ id: string; version: number; document: Project }>(`/projects/${id}`),
  createProject: (document: Project, orgId?: string) => call<{ id: string; version: number }>("/projects", { method: "POST", body: JSON.stringify({ document, orgId }) }),
  saveProject: (id: string, document: Project, version: number) => call<{ id: string; version: number }>(`/projects/${id}`, { method: "PUT", body: JSON.stringify({ document, version }) }),
  share: (id: string) => call<{ token: string; url: string }>(`/projects/${id}/share`, { method: "POST" }),
  shared: (token: string) => call<{ id: string; document: Project; version: number }>(`/shared/${token}`),
  comments: (id: string) => call<Array<{ id: string; body: string; resolved: boolean; createdAt: string; anchor: string | null; author: { email: string; name: string | null } }>>(`/projects/${id}/comments`),
  addComment: (id: string, body: string, anchor?: unknown) => call<{ id: string }>(`/projects/${id}/comments`, { method: "POST", body: JSON.stringify({ body, anchor }) }),
  resolveComment: (cid: string, resolved: boolean) => call<{ id: string }>(`/comments/${cid}`, { method: "PATCH", body: JSON.stringify({ resolved }) }),
  createOrg: (name: string) => call<{ id: string }>("/orgs", { method: "POST", body: JSON.stringify({ name }) }),
  plans: () => call<Array<{ id: string; name: string; monthly: number | null; yearly: number; features: string[] }>>("/billing/plans"),
  entitlements: (orgId: string) => call<{ plan: string; exports: boolean; day_pass_until: string | null; simulations: "basic" | "all"; imports: boolean; projects: number | null }>(`/billing/entitlements/${orgId}`),
  daypass: (orgId: string) => call<{ url: string }>("/billing/daypass", { method: "POST", body: JSON.stringify({ orgId }) }),
  checkout: (orgId: string, plan: string, interval: "month" | "year") => call<{ url: string }>("/billing/checkout", { method: "POST", body: JSON.stringify({ orgId, plan, interval }) }),
};
