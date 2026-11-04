"use client";
import { useEffect, useState } from "react";
import { Glasses } from "lucide-react";
import { xrStore } from "@/lib/xrStore";
import { IconBtn } from "@/components/ui";

/** Enter an immersive WebXR session (VR headset browsers; AR on supported phones). Hidden when WebXR is unavailable. */
export function XRButton() {
  const [support, setSupport] = useState<"vr" | "ar" | null>(null);
  useEffect(() => {
    const xr = (navigator as Navigator & { xr?: { isSessionSupported: (m: string) => Promise<boolean> } }).xr; if (!xr) return;
    xr.isSessionSupported("immersive-vr").then((ok) => ok && setSupport("vr")).catch(() => {});
    xr.isSessionSupported("immersive-ar").then((ok) => ok && setSupport((s) => s ?? "ar")).catch(() => {});
  }, []);
  if (!support) return null;
  return <IconBtn title={support === "vr" ? "Enter VR walkthrough" : "View in AR"} onClick={() => (support === "vr" ? xrStore.enterVR() : xrStore.enterAR())}><Glasses size={15} /></IconBtn>;
}
