import React, { useMemo } from "react";

interface ParticlesProps {
  count?: number;
}

// Lightweight decorative particles using CSS animations and design tokens
export const Particles: React.FC<ParticlesProps> = ({ count = 24 }) => {
  const particles = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const size = Math.floor(Math.random() * 6) + 4; // 4-10px
      const left = Math.random() * 100;
      const top = Math.random() * 100;
      const duration = 6 + Math.random() * 6; // 6-12s
      const delay = Math.random() * 4; // 0-4s
      const blur = Math.random() > 0.6 ? 4 : 0;
      return { id: i, size, left, top, duration, delay, blur };
    });
  }, [count]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-full pulse"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            filter: p.blur ? `blur(${p.blur}px)` : undefined,
            background: `hsla(var(--primary), 0.18)`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
};

export default Particles;
