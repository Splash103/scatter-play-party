import { useCallback, useMemo, useRef } from "react";

// Lightweight game sounds using Web Audio API (no assets needed)
// Ensures no audio plays when disabled
export function useGameSounds(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback(() => {
    if (!enabled) return null;
    if (!ctxRef.current) {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      ctxRef.current = new Ctx();
    }
    return ctxRef.current;
  }, [enabled]);

  const playTone = useCallback(async (freq: number, durationMs: number, type: OscillatorType = "sine", gain = 0.03) => {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain; // gentle volume
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    await new Promise((r) => setTimeout(r, durationMs));
    osc.stop();
    osc.disconnect();
    g.disconnect();
  }, [getCtx]);

  const playChord = useCallback(async (freqs: number[], durationMs: number, type: OscillatorType = "sine", gain = 0.03) => {
    const ctx = getCtx();
    if (!ctx) return;
    const gains: GainNode[] = [];
    const oscs: OscillatorNode[] = [];
    for (const f of freqs) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = f;
      g.gain.value = gain / Math.max(freqs.length, 1);
      osc.connect(g);
      g.connect(ctx.destination);
      oscs.push(osc);
      gains.push(g);
    }
    oscs.forEach((o) => o.start());
    await new Promise((r) => setTimeout(r, durationMs));
    oscs.forEach((o) => o.stop());
    oscs.forEach((o) => o.disconnect());
    gains.forEach((g) => g.disconnect());
  }, [getCtx]);

  const playRoundStart = useCallback(async () => {
    // quick up arpeggio
    await playTone(440, 80, "triangle");
    await playTone(587, 80, "triangle");
    await playTone(740, 120, "triangle");
  }, [playTone]);

  const playVote = useCallback(async () => {
    // subtle click + pop
    await playTone(320, 40, "square");
    await playTone(520, 60, "square");
  }, [playTone]);

  const playWin = useCallback(async () => {
    // small victory fanfare
    await playChord([523.25, 659.25, 783.99], 160, "sine");
    await playChord([659.25, 783.99, 987.77], 220, "sine");
  }, [playChord]);

  return useMemo(() => ({ playRoundStart, playVote, playWin }), [playRoundStart, playVote, playWin]);
}
