"use client";
import { create } from "zustand";
import { api, cloudEnabled, getToken, setToken, type Me } from "./api";

interface CloudState { me: Me | null; checked: boolean; cloudId: string | null; version: number | null; syncing: boolean; lastSync: string | null; error: string | null;
  refresh: () => Promise<void>; signOut: () => Promise<void>; bind: (id: string | null, version: number | null) => void; set: (p: Partial<CloudState>) => void }
export const useCloud = create<CloudState>((set) => ({
  me: null, checked: false, cloudId: null, version: null, syncing: false, lastSync: null, error: null,
  refresh: async () => { if (!cloudEnabled() || !getToken()) { set({ me: null, checked: true }); return; } try { set({ me: await api.me(), checked: true }); } catch { setToken(null); set({ me: null, checked: true }); } },
  signOut: async () => { try { await api.logout(); } catch { /* ignore */ } setToken(null); set({ me: null }); },
  bind: (cloudId, version) => set({ cloudId, version }),
  set: (p) => set(p),
}));
