
import { useEffect, useRef } from "react";

const Particles = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    // Helpers to resolve CSS variables into Canvas-friendly colors
    const getVar = (name: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim();

    const toCommaHsl = (hslTriplet: string) => {
      // Convert "222.2 47.4% 11.2%" -> "222.2, 47.4%, 11.2%"
      const parts = hslTriplet.split(/\s+/).filter(Boolean);
      if (parts.length >= 3) {
        return `${parts[0]}, ${parts[1]}, ${parts[2]}`;
      }
      // Sensible fallback if tokens are missing
      return "222, 47%, 11%";
    };

    const primaryHsl = toCommaHsl(getVar("--primary") || "222.2 47.4% 11.2%");
    const accentHsl = toCommaHsl(getVar("--accent") || "210 40% 96.1%");

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const particles: { x: number; y: number; vx: number; vy: number; r: number; a: number }[] = [];

    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };

    const init = () => {
      particles.length = 0;
      const count = Math.min(60, Math.floor((window.innerWidth * window.innerHeight) / 25000));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.2 * dpr,
          vy: (Math.random() - 0.5) * 0.2 * dpr,
          r: (Math.random() * 2 + 0.5) * dpr,
          a: Math.random() * 0.4 + 0.1,
        });
      }
    };

    const step = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Subtle gradient using resolved design tokens (Canvas requires concrete colors)
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, `hsla(${primaryHsl}, 0.08)`);
      grad.addColorStop(1, `hsla(${accentHsl}, 0.06)`);
      ctx.fillStyle = grad as unknown as string;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${primaryHsl}, ${p.a})`;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(step);
    };

    const onResize = () => {
      resize();
      init();
    };

    resize();
    init();
    step();

    window.addEventListener("resize", onResize);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 -z-10"
      aria-hidden="true"
    />
  );
};

export default Particles;
