"use client";
import { createXRStore } from "@react-three/xr";
/** Shared WebXR store: the scene mounts <XR store={xrStore}> and the toolbar button starts a session. */
export const xrStore = createXRStore({ emulate: false });
