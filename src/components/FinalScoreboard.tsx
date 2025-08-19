import { useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";
import { gradientFromString, initialsFromName } from "@/lib/gradient";
import confetti from "canvas-confetti";

export type FinalSummary = {
  totals: Record<string, number>;
  winners: { id: string; name: string; total: number }[];
  players: { id: string; name: string }[];
};

export function FinalScoreboard({
  open,
  onClose,
  summary,
  isHost,
  onPlayAgain,
}: {
  open: boolean;
  onClose: () => void;
  summary: FinalSummary | null;
  isHost: boolean;
  onPlayAgain: () => void;
}) {
  const rows = useMemo(() => {
    if (!summary) return [] as { id: string; name: string; score: number }[];
    const mapName = new Map(summary.players.map((p) => [p.id, p.name] as const));
    return Object.entries(summary.totals)
      .map(([id, score]) => ({ id, score, name: mapName.get(id) || "Player" }))
      .sort((a, b) => b.score - a.score);
  }, [summary]);

  useEffect(() => {
    if (!open || !summary) return;
    // celebratory confetti burst
    const end = Date.now() + 800;
    const frame = () => {
      if (Date.now() > end) return;
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { x: Math.random() * 0.6 + 0.2, y: 0.2 },
        colors: ["#FFD166", "#06D6A0", "#EF476F", "#118AB2"],
        scalar: 0.8,
      });
      requestAnimationFrame(frame);
    };
    frame();
  }, [open, summary]);

  const winnerIds = useMemo(() => new Set(summary?.winners.map((w) => w.id) || []), [summary]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Final Scoreboard</DialogTitle>
          <DialogDescription>Game completed - here are the final standings</DialogDescription>
        </DialogHeader>
        {!summary ? null : (
          <div className="space-y-4">
            <Card className="bg-gradient-to-br from-primary/10 to-background/60 border-border/60">
              <CardContent className="py-4">
                <div className="grid gap-3">
                  {rows.map((r, idx) => (
                    <div key={r.id} className="flex items-center justify-between rounded-md border px-3 py-2 bg-background/60">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback style={{ backgroundImage: gradientFromString(r.name), color: "white" }}>
                            {initialsFromName(r.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{idx + 1}. {r.name}</span>
                          {winnerIds.has(r.id) && (
                            <Badge variant="secondary" className="inline-flex items-center gap-1">
                              <Crown className="h-3.5 w-3.5 text-primary" /> Winner
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-sm">{r.score} pts</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-end gap-2">
              {isHost && (
                <Button variant="secondary" onClick={onPlayAgain}>Play again</Button>
              )}
              <Button onClick={onClose}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
