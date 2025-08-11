export function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function gradientFromString(input: string): string {
  const h = hashString(input || "player");
  const h1 = h % 360;
  const h2 = (h1 + 60) % 360;
  // Return a CSS gradient string using HSL to match the design system
  return `linear-gradient(135deg, hsl(${h1} 70% 55%), hsl(${h2} 70% 55%))`;
}

export function initialsFromName(name: string): string {
  if (!name) return "P";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function colorSeedFromName(name: string): number {
  return hashString(name) % 360;
}
