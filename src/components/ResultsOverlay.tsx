import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useRef, useState } from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { PlayerResultCard } from "@/components/PlayerResultCard";

export type PlayerResult = {
  playerId: string;
  name: string;
  letter: string | null;
  answers: Record<number, string>;
};

// Normalize answers for duplicate detection
const normalizeAnswer = (s: string) => (s || "").toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
// Alliteration bonus: at least two words starting with the round letter
const isAlliteration = (s: string, letter: string | null) => {
  const l = (letter || "").toUpperCase();
  if (!l) return false;
  const words = (s || "").trim().split(/\s+/);
  let count = 0;
  for (const w of words) if (w.charAt(0).toUpperCase() === l) count++;
  return count >= 2;
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

  const countsByIdx = useMemo(() => {
    const map: Record<number, Record<string, number>> = {};
    for (const r of Object.values(results)) {
      const ltr = (r.letter || '').toUpperCase();
      for (const [idxStr, val] of Object.entries(r.answers || {})) {
        const idx = Number(idxStr);
        if (!val) continue;
        const startsOk = ltr && val.trimStart().charAt(0).toUpperCase() === ltr;
        if (!startsOk) continue;
        const norm = normalizeAnswer(val);
        map[idx] = map[idx] || {};
        map[idx][norm] = (map[idx][norm] || 0) + 1;
      }
    }
    return map;
  }, [results]);

  const isDisqualified = (key: string) => (votes[key]?.length || 0) >= majority;


  const scoreFor = (r: PlayerResult) => {
    let s = 0;
    const ltr = (r.letter || '').toUpperCase();
    for (const idx in r.answers) {
      const i = Number(idx);
      const val = r.answers[i];
      if (!val || !val.trim()) continue;
      const key = `${r.playerId}:${i}`;
      const dq = isDisqualified(key);
      const startsOk = ltr && val.trimStart().charAt(0).toUpperCase() === ltr;
      if (dq) { s -= 1; continue; }
      if (!startsOk) continue;
      const dup = (countsByIdx[i]?.[normalizeAnswer(val)] || 0) > 1;
      if (!dup) {
        s += 1;
        if (isAlliteration(val, r.letter)) s += 1;
      }
    }
    return s;
  };

  const entries = useMemo(() => Object.values(results), [results]);
  const [index, setIndex] = useState(0);
  const initRef = useRef(0);
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
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
    const id = setInterval(() => { try { carouselApi?.scrollNext(); } catch {} }, step * 1000);
    return () => clearInterval(id);
  }, [open, entries.length, voteTimeLeft, carouselApi]);
  useEffect(() => {
    if (index >= entries.length) setIndex(0);
  }, [entries.length, index]);
  useEffect(() => {
    if (!carouselApi) return;
    setIndex(carouselApi.selectedScrollSnap());
    const onSelect = () => setIndex(carouselApi.selectedScrollSnap());
    try { carouselApi.on('select', onSelect); } catch {}
    return () => { try { carouselApi.off('select', onSelect as any); } catch {} };
  }, [carouselApi]);
  const playerNameById = useMemo(() => new Map(players.map(p => [p.id, p.name] as const)), [players]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl glass-panel border-0">
        <DialogHeader className="sm:flex sm:items-center sm:justify-between">
          <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-primary via-blue-600 to-purple-600 bg-clip-text text-transparent">
            Round Results
          </DialogTitle>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="glass-card hover:scale-105"
            >
              Exit Voting
            </Button>
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-muted-foreground font-medium">
              Voting ends in {voteTimeLeft}s
            </span>
          </div>
        </DialogHeader>
        
        <div className="space-y-4">
          {entries.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
              <div className="text-lg font-medium text-muted-foreground">Waiting for submissions…</div>
            </div>
          ) : (
            <>
              <div className="relative">
                <Carousel setApi={setCarouselApi} opts={{ align: "center", loop: true }}>
                  <CarouselContent>
                    {entries.map((r) => (
                      <CarouselItem key={r.playerId} className="md:basis-3/4 lg:basis-2/3 xl:basis-1/2">
                        <PlayerResultCard
                          r={r}
                          categories={categories}
                          countsByIdx={countsByIdx}
                          votes={votes}
                          isDisqualified={isDisqualified}
                          localPlayerId={localPlayerId}
                          onVote={onVote}
                          scoreFor={scoreFor}
                          playerNameById={playerNameById}
                        />
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="left-4 top-1/2 -translate-y-1/2 glass-card hover:scale-110" />
                  <CarouselNext className="right-4 top-1/2 -translate-y-1/2 glass-card hover:scale-110" />
                </Carousel>
                <div className="mt-6 flex items-center justify-center gap-2">
                  {entries.map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        idx === index 
                          ? 'bg-primary scale-125' 
                          : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                      }`}
                    />
                  ))}
                </div>
                <div className="mt-2 text-center text-sm text-muted-foreground font-medium">
                  {index + 1} of {entries.length} players
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
