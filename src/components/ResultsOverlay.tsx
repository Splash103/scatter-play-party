import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { gradientFromString, initialsFromName } from "@/lib/gradient";

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

  const entries = Object.values(results);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader className="sm:flex sm:items-center sm:justify-between">
          <DialogTitle>Round Results</DialogTitle>
          <div className="text-sm text-muted-foreground">Voting ends in {voteTimeLeft}s</div>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-2">
          {entries.map((r) => (
            <Card key={r.playerId} className="animate-enter">
              <CardHeader className="flex flex-row items-center gap-3">
                <Avatar>
                  <AvatarFallback
                    style={{ backgroundImage: gradientFromString(r.name), color: "white" }}
                  >
                    {initialsFromName(r.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle className="text-base">{r.name}</CardTitle>
                  <div className="text-xs text-muted-foreground">Letter: {r.letter ?? "–"} • Score: {scoreFor(r)}</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {categories.map((c, i) => {
                  const val = r.answers[i];
                  const key = `${r.playerId}:${i}`;
                  const disq = isDisqualified(key);
                  return (
                    <div key={i} className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{i + 1}. {c}</div>
                        <div className={`text-sm ${disq ? "line-through text-muted-foreground" : ""}`}>{val || <span className="text-muted-foreground">—</span>}</div>
                      </div>
                      <div className="flex items-center gap-2">
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
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
