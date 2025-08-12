import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { gradientFromString, initialsFromName } from "@/lib/gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
export type PlayerResult = {
  playerId: string;
  name: string;
  letter: string | null;
  answers: Record<number, string>;
};

export function ResultsOverlay({
  open,
  onClose,
  results,
  presentCount,
  votes,
  onVote,
  categories,
  localPlayerId,
  voteTimeLeft,
  players,
}: {
  open: boolean;
  onClose: () => void;
  results: Record<string, PlayerResult>;
  presentCount: number;
  votes: Record<string, string[]>;
  onVote: (voteKey: string) => void;
  categories: string[];
  localPlayerId: string;
  voteTimeLeft: number;
  players: { id: string; name: string }[];
}) {
  const majority = Math.floor(presentCount / 2) + 1;

  const isDisqualified = (key: string) => (votes[key]?.length || 0) >= majority;

  const scoreFor = (r: PlayerResult) => {
    let s = 0;
    for (const idx in r.answers) {
      const i = Number(idx);
      const val = r.answers[i];
      if (!val || !val.trim()) continue;
      const key = `${r.playerId}:${i}`;
      if (!isDisqualified(key)) s += 1;
    }
    return s;
  };

  const entries = useMemo(() => Object.values(results), [results]);
  const [index, setIndex] = useState(0);
  const initRef = useRef(0);
  useEffect(() => {
    if (open) {
      if (voteTimeLeft > initRef.current) initRef.current = voteTimeLeft;
    } else {
      initRef.current = 0;
      setIndex(0);
    }
  }, [open, voteTimeLeft]);
  useEffect(() => {
    if (!open) return;
    if (entries.length <= 1) return;
    const total = initRef.current || voteTimeLeft || 30;
    const step = Math.max(2, Math.floor(total / Math.max(entries.length, 1)));
    const id = setInterval(() => setIndex((i) => (i + 1) % entries.length), step * 1000);
    return () => clearInterval(id);
  }, [open, entries.length, voteTimeLeft]);
  useEffect(() => {
    if (index >= entries.length) setIndex(0);
  }, [entries.length, index]);
  const playerNameById = useMemo(() => new Map(players.map(p => [p.id, p.name] as const)), [players]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader className="sm:flex sm:items-center sm:justify-between">
          <DialogTitle>Round Results</DialogTitle>
          <div className="text-sm text-muted-foreground">Voting ends in {voteTimeLeft}s</div>
        </DialogHeader>
        <div className="space-y-4">
          {entries.length === 0 ? (
            <div className="text-sm text-muted-foreground">Waiting for submissions…</div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Button variant="outline" size="icon" onClick={() => setIndex((i) => (i - 1 + entries.length) % entries.length)} aria-label="Previous player">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm text-muted-foreground">{index + 1} / {entries.length}</div>
                <Button variant="outline" size="icon" onClick={() => setIndex((i) => (i + 1) % entries.length)} aria-label="Next player">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {(() => {
                const r = entries[index];
                return (
                  <Card key={r.playerId} className="animate-enter">
                    <CardHeader className="flex flex-row items-center gap-3">
                      <Avatar>
                        <AvatarFallback style={{ backgroundImage: gradientFromString(r.name), color: "white" }}>
                          {initialsFromName(r.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <CardTitle className="text-base">{r.name}</CardTitle>
                        <div className="text-xs text-muted-foreground">Letter: {r.letter ?? "–"} • Score: {scoreFor(r)}</div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {categories.map((c, i) => {
                        const val = r.answers[i];
                        const key = `${r.playerId}:${i}`;
                        const disq = isDisqualified(key);
                        const voterIds = votes[key] || [];
                        return (
                          <div key={i} className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium">{i + 1}. {c}</div>
                              <div className={`text-sm ${disq ? "line-through text-muted-foreground" : ""}`}>{val || <span className="text-muted-foreground">—</span>}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {voterIds.length > 0 && (
                                <div className="flex -space-x-2">
                                  {voterIds.map((vid) => {
                                    const nm = playerNameById.get(vid) || "Player";
                                    return (
                                      <Avatar key={vid} className="h-6 w-6 border">
                                        <AvatarFallback style={{ backgroundImage: gradientFromString(nm), color: "white" }}>
                                          {initialsFromName(nm)}
                                        </AvatarFallback>
                                      </Avatar>
                                    );
                                  })}
                                </div>
                              )}
                              {disq && <Badge variant="secondary">Removed</Badge>}
                              {!!val && !disq && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => onVote(key)}
                                  disabled={r.playerId === localPlayerId}
                                  aria-label={`Vote out ${r.name}'s answer for ${c}`}
                                >
                                  Vote out
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })()}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
