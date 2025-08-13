import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { gradientFromString, initialsFromName } from "@/lib/gradient";
import React from "react";

export type PlayerResult = {
  playerId: string;
  name: string;
  letter: string | null;
  answers: Record<number, string>;
};

const normalizeAnswer = (s: string) => (s || "").toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
const isAlliteration = (s: string, letter: string | null) => {
  const l = (letter || "").toUpperCase();
  if (!l) return false;
  const words = (s || "").trim().split(/\s+/);
  let count = 0;
  for (const w of words) if (w.charAt(0).toUpperCase() === l) count++;
  return count >= 2;
};

export function PlayerResultCard({
  r,
  categories,
  countsByIdx,
  votes,
  isDisqualified,
  localPlayerId,
  onVote,
  scoreFor,
  playerNameById,
}: {
  r: PlayerResult;
  categories: string[];
  countsByIdx: Record<number, Record<string, number>>;
  votes: Record<string, string[]>;
  isDisqualified: (key: string) => boolean;
  localPlayerId: string;
  onVote: (key: string) => void;
  scoreFor: (r: PlayerResult) => number;
  playerNameById: Map<string, string>;
}) {
  return (
    <Card className="animate-enter bg-background/60 backdrop-blur-xl border border-border/60 shadow-[var(--shadow-elegant)]">
      <div className="rounded-t-lg bg-gradient-to-r from-primary/15 via-accent/10 to-transparent">
        <CardHeader className="flex flex-row items-center gap-3">
          <Avatar>
            <AvatarFallback style={{ backgroundImage: gradientFromString(r.name), color: "white" }}>
              {initialsFromName(r.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CardTitle className="text-base">{r.name}</CardTitle>
            <div className="text-xs text-muted-foreground">Letter: <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs font-semibold">{r.letter ?? "–"}</span></div>
          </div>
          <Badge variant="secondary" className="text-xs">Score {scoreFor(r)}</Badge>
        </CardHeader>
      </div>
      <CardContent className="pt-4">
        <div className="grid gap-3 md:grid-cols-2">
          {categories.map((c, i) => {
            const val = r.answers[i];
            const key = `${r.playerId}:${i}`;
            const disq = isDisqualified(key);
            const voterIds = votes[key] || [];
            const ltr = (r.letter || '').toUpperCase();
            const startsOk = !!val && ltr && val.trimStart().charAt(0).toUpperCase() === ltr;
            const dup = startsOk && (countsByIdx[i]?.[normalizeAnswer(val || '')] || 0) > 1;
            const allit = startsOk && !dup && !disq && isAlliteration(val || '', r.letter);

            return (
              <div key={i} className="rounded-xl border border-border/60 bg-gradient-to-br from-primary/5 to-accent/5 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">{i + 1}. {c}</div>
                    <div className={`text-sm ${disq ? "line-through text-muted-foreground" : ""}`}>{val || <span className="text-muted-foreground">—</span>}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {disq && <Badge variant="secondary">Removed -1</Badge>}
                    {!disq && startsOk && dup && <Badge variant="secondary">Duplicate 0</Badge>}
                    {!disq && startsOk && !dup && allit && <Badge variant="secondary">Alliteration +1</Badge>}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  {voterIds.length > 0 ? (
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
                  ) : <div className="h-6" />}

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
        </div>
      </CardContent>
    </Card>
  );
}
