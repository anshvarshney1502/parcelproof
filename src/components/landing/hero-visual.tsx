"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { useReducedMotion } from "framer-motion";

/** Static fallback drawn in SVG: shown while the 3D scene loads, without WebGL, or on very small screens. */
export function StaticParcel() {
  return (
    <svg viewBox="0 0 480 360" className="h-full w-full" aria-hidden>
      <g stroke="#242923" strokeOpacity=".5" strokeWidth="1"><path d="M240 170 L92 98" /><path d="M262 160 L392 84" stroke="#b9563c" strokeOpacity=".8" /><path d="M276 214 L380 256" /></g>
      <g><rect x="52" y="54" width="78" height="100" rx="2" fill="#fbf9f3" stroke="#dedcd2" transform="rotate(-6 91 104)" /><rect x="352" y="36" width="78" height="100" rx="2" fill="#fbf9f3" stroke="#dedcd2" transform="rotate(5 391 86)" /><rect x="352" y="214" width="78" height="100" rx="2" fill="#fbf9f3" stroke="#dedcd2" transform="rotate(-3 391 264)" /></g>
      <path d="M160 150 L240 118 L330 150 L250 186 Z" fill="#d4b98f" /><path d="M160 150 L250 186 L250 276 L160 238 Z" fill="#c7a97c" /><path d="M250 186 L330 150 L330 238 L250 276 Z" fill="#b8996c" />
      <path d="M200 134 L290 168 L290 178 L200 144 Z" fill="#b39367" />
      <line x1="60" y1="318" x2="420" y2="318" stroke="#242923" strokeOpacity=".5" />
      {[110, 190, 270, 350].map((x, i) => <circle key={x} cx={x} cy={318} r={i === 2 ? 5 : 3.5} fill={i === 2 ? "#b9563c" : "#242923"} />)}
    </svg>
  );
}

const noop = () => () => {};
let webglCache: boolean | undefined;
function detectWebgl() {
  if (webglCache === undefined) {
    try {
      const c = document.createElement("canvas");
      webglCache = Boolean(c.getContext("webgl2") || c.getContext("webgl")) && window.innerWidth >= 360;
    } catch {
      webglCache = false;
    }
  }
  return webglCache;
}

const Scene = dynamic(() => import("./parcel-scene"), { ssr: false, loading: () => <StaticParcel /> });

export function HeroVisual() {
  const reduce = useReducedMotion();
  const webgl = useSyncExternalStore(noop, detectWebgl, () => false);
  return <div className="relative aspect-[4/3] w-full">{webgl ? <Scene still={Boolean(reduce)} /> : <StaticParcel />}</div>;
}
