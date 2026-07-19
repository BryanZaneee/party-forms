"use client";

import { useEffect } from "react";

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- JSX intrinsics can only be augmented via a namespace
  namespace JSX {
    interface IntrinsicElements {
      "paper-shader": { style?: React.CSSProperties } & Record<string, unknown>;
    }
  }
}

/** Dark hero header with the animated shader background (CSS-gradient fallback). */
export default function Hero({
  maxWidth = 1100,
  padding,
  children,
}: {
  maxWidth?: number;
  padding: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    import("./paper-shader.js");
  }, []);
  return (
    <div style={{ position: "relative", overflow: "hidden", background: "#070d1a" }}>
      <paper-shader
        style={{ position: "absolute", inset: 0 }}
        color-back="#070d1a"
        color-front="#e11d74"
        shape="simplex"
        type="8x8"
        px-size="2.5"
        speed="0.65"
      />
      <div style={{ position: "relative", maxWidth, margin: "0 auto", padding }}>{children}</div>
    </div>
  );
}
