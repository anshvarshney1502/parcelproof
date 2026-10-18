"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const KRAFT = "#c7a97c";
const TAPE = "#b39367";
const PAPER = "#fbf9f3";
const INK = "#242923";
const RUST = "#b9563c";
const ARCHIVE = "#526f83";

function Line({ points, color, opacity = 1 }: { points: [number, number, number][]; color: string; opacity?: number }) {
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(...p)));
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }));
  }, [points, color, opacity]);
  return <primitive object={line} />;
}

function Parcel() {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.5, 1, 1.15]} />
        <meshStandardMaterial color={KRAFT} roughness={0.92} />
      </mesh>
      {/* Tape across the lid and down the front */}
      <mesh position={[0, 0.502, 0]}><boxGeometry args={[0.26, 0.004, 1.152]} /><meshStandardMaterial color={TAPE} roughness={0.55} /></mesh>
      <mesh position={[0, 0.3, 0.577]}><boxGeometry args={[0.26, 0.4, 0.004]} /><meshStandardMaterial color={TAPE} roughness={0.55} /></mesh>
      {/* Shipping label with barcode strokes */}
      <group position={[0.42, 0.506, 0.18]} rotation={[-Math.PI / 2, 0, 0.05]}>
        <mesh><planeGeometry args={[0.46, 0.32]} /><meshStandardMaterial color={PAPER} roughness={0.85} /></mesh>
        {Array.from({ length: 11 }, (_, i) => (
          <mesh key={i} position={[-0.17 + i * 0.03, -0.07, 0.001]}><planeGeometry args={[i % 3 ? 0.01 : 0.018, 0.1]} /><meshBasicMaterial color={INK} /></mesh>
        ))}
        <mesh position={[-0.05, 0.08, 0.001]}><planeGeometry args={[0.3, 0.018]} /><meshBasicMaterial color={INK} /></mesh>
        <mesh position={[-0.09, 0.04, 0.001]}><planeGeometry args={[0.22, 0.012]} /><meshBasicMaterial color="#8a8d86" /></mesh>
      </group>
    </group>
  );
}

function Sheet({ position, rotation, accent, lines }: { position: [number, number, number]; rotation: [number, number, number]; accent: string; lines: number[] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[0.62, 0.82, 0.008]} />
        <meshStandardMaterial color={PAPER} roughness={0.9} />
      </mesh>
      <mesh position={[-0.21, 0.32, 0.005]}><planeGeometry args={[0.1, 0.03]} /><meshBasicMaterial color={accent} /></mesh>
      {lines.map((w, i) => (
        <mesh key={i} position={[-0.25 + w / 2, 0.22 - i * 0.075, 0.005]}><planeGeometry args={[w, 0.012]} /><meshBasicMaterial color={i === 2 ? accent : "#a9aca3"} /></mesh>
      ))}
    </group>
  );
}

function Scene({ still }: { still: boolean }) {
  const root = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (still || !root.current) return;
    const t = clock.getElapsedTime();
    root.current.rotation.y = -0.45 + Math.sin(t * 0.18) * 0.12;
    root.current.position.y = Math.sin(t * 0.5) * 0.03;
  });

  const docs: { pos: [number, number, number]; rot: [number, number, number]; accent: string; lines: number[] }[] = [
    { pos: [-2.05, 0.75, -0.3], rot: [0, 0.5, 0.06], accent: ARCHIVE, lines: [0.48, 0.36, 0.42, 0.3, 0.44, 0.22] },
    { pos: [1.95, 1.05, -0.6], rot: [0, -0.45, -0.05], accent: RUST, lines: [0.4, 0.46, 0.28, 0.42, 0.34] },
    { pos: [1.7, -0.35, 1.2], rot: [-0.1, -0.7, 0.04], accent: "#747b61", lines: [0.44, 0.3, 0.46, 0.38, 0.26, 0.4] },
  ];
  const anchor = (p: [number, number, number]): [number, number, number] => [p[0] * 0.38, Math.min(0.48, p[1] * 0.4), p[2] * 0.4];

  return (
    <group ref={root} rotation={[0, -0.45, 0]}>
      <Parcel />
      {docs.map((d, i) => (
        <group key={i}>
          <Sheet position={d.pos} rotation={d.rot} accent={d.accent} lines={d.lines} />
          <Line points={[anchor(d.pos), d.pos]} color={i === 1 ? RUST : INK} opacity={0.55} />
        </group>
      ))}
      {/* Timeline rail with event ticks under the parcel */}
      <group position={[0, -0.72, 0.9]}>
        <Line points={[[-2.4, 0, 0], [2.4, 0, 0]]} color={INK} opacity={0.85} />
        {[-1.8, -0.7, 0.4, 1.5].map((x, i) => (
          <mesh key={x} position={[x, 0, 0]}>
            <sphereGeometry args={[i === 2 ? 0.055 : 0.04, 16, 16]} />
            <meshStandardMaterial color={i === 2 ? RUST : INK} />
          </mesh>
        ))}
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.501, 0]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <shadowMaterial opacity={0.12} />
      </mesh>
    </group>
  );
}

export default function ParcelScene({ still }: { still: boolean }) {
  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={[1, 1.75]}
      frameloop={still ? "demand" : "always"}
      camera={{ position: [0, 2.1, 5.6], fov: 34 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      onCreated={({ camera }) => camera.lookAt(0, 0.15, 0)}
      aria-hidden
    >
      <ambientLight intensity={0.85} color="#fff8ee" />
      <directionalLight position={[3.5, 6, 4]} intensity={1.6} color="#fff4e6" castShadow shadow-mapSize={[1024, 1024]} shadow-radius={6} />
      <directionalLight position={[-4, 2, -2]} intensity={0.35} color="#dfe8ef" />
      <Scene still={still} />
    </Canvas>
  );
}
