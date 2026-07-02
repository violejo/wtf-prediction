import { useRef, useState, useImperativeHandle, forwardRef } from "react";

const SLICES = [
  { value: 50, color: "#1a1a1a", label: "50" },
  { value: 150, color: "#cc2200", label: "150" },
  { value: 300, color: "#1a1a1a", label: "300" },
  { value: 500, color: "#cc2200", label: "500" },
  { value: 1000, color: "#1a7a1a", label: "1000" },
];

const TOTAL = SLICES.length;
const DEG = 360 / TOTAL;

function polarToCart(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polarToCart(cx, cy, r, startDeg);
  const e = polarToCart(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M${cx},${cy} L${s.x},${s.y} A${r},${r},0,${large},1,${e.x},${e.y} Z`;
}

export interface SpinWheelRef {
  spin: (winIndex: number) => void;
}

interface Props {
  onDone: (value: number) => void;
}

const SpinWheel = forwardRef<SpinWheelRef, Props>(({ onDone }, ref) => {
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const currentAngle = useRef(0);
  const SIZE = 220;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = SIZE / 2 - 6;

  useImperativeHandle(ref, () => ({
    spin(winIndex: number) {
      if (spinning) return;
      setSpinning(true);

      const sliceCenter = winIndex * DEG + DEG / 2;
      const target = 360 - sliceCenter;
      const extra = 5 * 360 + target - (currentAngle.current % 360);
      const newAngle = currentAngle.current + extra;
      currentAngle.current = newAngle;
      setAngle(newAngle);

      setTimeout(() => {
        setSpinning(false);
        onDone(SLICES[winIndex].value);
      }, 3200);
    },
  }));

  return (
    <div style={{ position: "relative", width: SIZE, height: SIZE, margin: "0 auto" }}>
      <svg
        width={SIZE}
        height={SIZE}
        style={{
          transform: `rotate(${angle}deg)`,
          transition: spinning
            ? "transform 3.2s cubic-bezier(0.17,0.67,0.08,1)"
            : "none",
          borderRadius: "50%",
          boxShadow: "0 0 24px #00000088",
        }}
      >
        {SLICES.map((sl, i) => {
          const start = i * DEG;
          const end = start + DEG;
          const mid = start + DEG / 2;
          const textPos = polarToCart(CX, CY, R * 0.65, mid);
          return (
            <g key={i}>
              <path
                d={slicePath(CX, CY, R, start, end)}
                fill={sl.color}
                stroke="#ffffff22"
                strokeWidth={1.5}
              />
              <text
                x={textPos.x}
                y={textPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={sl.color === "#1a7a1a" ? "#fff" : "#fff"}
                fontSize={sl.value === 1000 ? 13 : 14}
                fontWeight="bold"
                fontFamily="Inter,Arial,sans-serif"
                transform={`rotate(${mid}, ${textPos.x}, ${textPos.y})`}
              >
                {sl.label}
              </text>
            </g>
          );
        })}
        <circle cx={CX} cy={CY} r={18} fill="#0f0f1a" stroke="#f0c040" strokeWidth={2} />
        <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle" fontSize={14}>
          🎯
        </text>
      </svg>

      <div style={{
        position: "absolute",
        top: -14,
        left: "50%",
        transform: "translateX(-50%)",
        fontSize: 22,
        filter: "drop-shadow(0 2px 4px #000)",
        zIndex: 10,
      }}>
        ▼
      </div>

      <div style={{
        position: "absolute",
        inset: 0,
        borderRadius: "50%",
        border: "3px solid #f0c04055",
        pointerEvents: "none",
      }} />
    </div>
  );
});

export { SLICES };
export default SpinWheel;
