import React from "react";

const Aurora: React.FC = () => {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Large soft glows that slowly float around */}
      <span
        className="absolute -top-32 -left-32 h-[60vh] w-[60vh] blur-3xl opacity-70 dark:opacity-70 opacity-0 mix-blend-screen animate-aurora-1"
        style={{
          background: "radial-gradient(ellipse at center, hsl(var(--glow-1) / 0.45) 0%, transparent 60%)",
        }}
      />
      <span
        className="absolute top-10 right-0 h-[55vh] w-[55vh] blur-3xl opacity-60 dark:opacity-60 opacity-0 mix-blend-screen animate-aurora-2"
        style={{
          background: "radial-gradient(ellipse at center, hsl(var(--glow-2) / 0.4) 0%, transparent 60%)",
        }}
      />
      <span
        className="absolute bottom-[-20vh] left-1/3 h-[70vh] w-[70vh] blur-3xl opacity-50 dark:opacity-50 opacity-0 mix-blend-screen animate-aurora-1"
        style={{
          background: "radial-gradient(ellipse at center, hsl(var(--glow-1) / 0.25) 0%, transparent 65%)",
          animationDuration: "26s",
        }}
      />
    </div>
  );
};

export default Aurora;
