import React from "react";

const Aurora: React.FC = () => {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-60">
      <span
        className="absolute -top-32 -left-32 h-[70vh] w-[70vh] sm:h-[70vh] sm:w-[70vh] blur-3xl opacity-30 sm:opacity-40 dark:opacity-60 mix-blend-multiply dark:mix-blend-screen animate-aurora-1"
        style={{
          background: "radial-gradient(ellipse at center, hsl(var(--glow-1) / 0.4) 0%, hsl(var(--glow-2) / 0.2) 40%, transparent 70%)",
        }}
      />
      <span
        className="absolute top-10 right-0 h-[65vh] w-[65vh] sm:h-[65vh] sm:w-[65vh] blur-3xl opacity-25 sm:opacity-35 dark:opacity-50 mix-blend-multiply dark:mix-blend-screen animate-aurora-2"
        style={{
          background: "radial-gradient(ellipse at center, hsl(var(--glow-3) / 0.35) 0%, hsl(var(--glow-4) / 0.2) 40%, transparent 70%)",
        }}
      />
      <span
        className="absolute bottom-[-20vh] left-1/3 h-[80vh] w-[80vh] sm:h-[80vh] sm:w-[80vh] blur-3xl opacity-20 sm:opacity-30 dark:opacity-40 mix-blend-multiply dark:mix-blend-screen animate-aurora-1"
        style={{
          background: "radial-gradient(ellipse at center, hsl(var(--glow-5) / 0.3) 0%, hsl(var(--glow-1) / 0.15) 50%, transparent 75%)",
          animationDuration: "28s",
        }}
      />
      <span
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-[90vh] w-[90vh] blur-3xl opacity-15 sm:opacity-25 dark:opacity-35 mix-blend-multiply dark:mix-blend-screen animate-aurora-2"
        style={{
          background: "radial-gradient(ellipse at center, hsl(var(--glow-2) / 0.2) 0%, hsl(var(--glow-4) / 0.15) 60%, transparent 80%)",
          animationDuration: "32s",
        }}
      />
    </div>
  );
};

export default Aurora;
