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
    <Card className="animate-enter glass-card card-stack group hover:shadow-[var(--shadow-card-hover)] transition-all duration-500 max-w-2xl mx-auto">
      <div className="rounded-t-lg bg-gradient-to-br from-primary/20 via-blue-500/10 via-purple-500/10 to-pink-500/10 p-1">
        <CardHeader className="flex flex-row items-center gap-3 pb-3">
          <Avatar className="h-12 w-12 border-2 border-white/20 shadow-lg">
            <AvatarFallback style={{ backgroundImage: gradientFromString(r.name), color: "white" }}>
              {initialsFromName(r.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent truncate">
              {r.name}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">Letter:</span>
              <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-bold shadow-md">
                {r.letter ?? "–"}
              </div>
            </div>
          </div>
          <div className="text-right">
            <Badge variant="secondary" className="glass-card text-xs font-bold px-2 py-1">
              {scoreFor(r)} pts
            </Badge>
          </div>
        </CardHeader>
      </div>
      
      <CardContent className="pt-4 px-4">
        <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
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
              <div key={i} className="glass-card rounded-lg p-3 hover:bg-gradient-to-br hover:from-primary/10 hover:to-blue-500/5 transition-all duration-300 group/answer">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-primary/80 uppercase tracking-wide mb-1">
                      {i + 1}. {c}
                    </div>
                    <div className={`text-base font-medium ${disq ? "line-through text-muted-foreground" : "text-foreground"} truncate`}>
                      {val || <span className="text-muted-foreground italic">No answer</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {disq && <Badge variant="destructive" className="text-xs">-1</Badge>}
                    {!disq && startsOk && dup && <Badge variant="secondary" className="text-xs">0</Badge>}
                    {!disq && startsOk && !dup && allit && <Badge variant="default" className="text-xs bg-green-600">+1</Badge>}
                    {!disq && startsOk && !dup && !allit && <Badge variant="default" className="text-xs">+1</Badge>}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  {voterIds.length > 0 ? (
                    <div className="flex -space-x-1">
                      {voterIds.map((vid) => {
                        const nm = playerNameById.get(vid) || "Player";
                        return (
                          <Avatar key={vid} className="h-6 w-6 border-2 border-white shadow-sm">
                            <AvatarFallback 
                              style={{ backgroundImage: gradientFromString(nm), color: "white" }}
                              className="text-xs"
                            >
                              {initialsFromName(nm)}
                            </AvatarFallback>
                          </Avatar>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-6" />
                  )}

                  {!!val && !disq && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onVote(key)}
                      disabled={r.playerId === localPlayerId}
                      aria-label={`Vote out ${r.name}'s answer for ${c}`}
                      className="glass-card hover:scale-105 text-xs px-2 py-1 h-6 opacity-0 group-hover/answer:opacity-100 transition-all duration-200"
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
