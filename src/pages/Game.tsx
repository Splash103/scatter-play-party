import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ChatPanel, ChatMessage } from "@/components/ChatPanel";
import { ResultsOverlay, PlayerResult } from "@/components/ResultsOverlay";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { gradientFromString, initialsFromName } from "@/lib/gradient";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings } from "lucide-react";
import Particles from "@/components/Particles";
import Aurora from "@/components/Aurora";
const DEFAULT_CATEGORIES = [
  "Fruits",
  "Countries",
  "Things in a bedroom",
  "TV Shows",
  "Things that are cold",
  "Animals",
  "Occupations",
  "Colors",
  "Sports",
  "Things you wear",
  "In the kitchen",
  "City names",
];

const ALLOWED_LETTERS = [
  "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","R","S","T","W"
];

function randomLetter() {
  return ALLOWED_LETTERS[Math.floor(Math.random() * ALLOWED_LETTERS.length)];
}

const Game = () => {
  const [timer, setTimer] = useState<number>(180);
  const [timeLeft, setTimeLeft] = useState<number>(180);
  const [running, setRunning] = useState(false);
  const [letter, setLetter] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const total = DEFAULT_CATEGORIES.length;

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const roomCode: string | null = ((searchParams.get("room") || "").toUpperCase()) || null;

  const initialName = (typeof window !== 'undefined' ? localStorage.getItem('profileName') : '') || 'Player';
  const [profileName] = useState<string>(initialName);
  const [playerId] = useState<string>(() => {
    const existing = typeof window !== 'undefined' ? localStorage.getItem('playerId') : null;
    if (existing) return existing;
    const id = (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    if (typeof window !== 'undefined') localStorage.setItem('playerId', id);
    return id;
  });
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [presentCount, setPresentCount] = useState<number>(1);
  const [players, setPlayers] = useState<{ id: string; name: string }[]>([]);
  const [results, setResults] = useState<Record<string, PlayerResult>>({});
  const [votes, setVotes] = useState<Record<string, string[]>>({});
  const [showResults, setShowResults] = useState(false);

  const leaveRoom = () => {
    navigate("/");
    toast({ title: "Left room", description: "You returned to the main menu." });
  };
  const progress = useMemo(() => {
    if (!running || timer === 0) return 0;
    return Math.min(100, ((timer - timeLeft) / timer) * 100);
  }, [running, timeLeft, timer]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id);
          setRunning(false);
          const r: PlayerResult = { playerId, name: profileName, letter, answers } as PlayerResult;
          setResults((prev) => ({ ...prev, [playerId]: r }));
          if (roomCode && channelRef.current) {
            channelRef.current.send({ type: "broadcast", event: "round_submit", payload: r });
            channelRef.current.send({ type: "broadcast", event: "round_end", payload: {} });
          }
          setShowResults(true);
          toast({ title: "Time's up!", description: "Review and submit your answers." });
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, roomCode, playerId, profileName, letter, answers]);

  useEffect(() => {
    if (!roomCode) return;
    const channel = supabase.channel(`room_${roomCode}`, { config: { presence: { key: playerId } } });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, { id: string; name: string }[]>;
        const list = Object.entries(state).map(([key, presences]) => ({ id: key, name: presences?.[0]?.name || 'Player' }));
        setPlayers(list);
        setPresentCount(list.length || 1);
      })
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        setMessages((m) => [...m, payload as ChatMessage].slice(-200));
      })
      .on('broadcast', { event: 'round_start' }, ({ payload }) => {
        const p = payload as { letter: string; timer: number };
        setLetter(p.letter);
        setAnswers({});
        setTimeLeft(p.timer);
        setRunning(true);
        setResults({});
        setVotes({});
        setShowResults(false);
        toast({ title: "Round started", description: `Letter: ${p.letter} • ${p.timer} seconds` });
      })
      .on('broadcast', { event: 'round_submit' }, ({ payload }) => {
        const r = payload as PlayerResult;
        setResults((prev) => ({ ...prev, [r.playerId]: r }));
      })
      .on('broadcast', { event: 'round_end' }, () => {
        setShowResults(true);
      })
      .on('broadcast', { event: 'vote' }, ({ payload }) => {
        const { key, voterId } = payload as { key: string; voterId: string };
        setVotes((prev) => {
          const set = new Set([...(prev[key] || [])]);
          set.add(voterId);
          return { ...prev, [key]: Array.from(set) };
        });
      });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ id: playerId, name: profileName, online_at: new Date().toISOString() });
      }
    });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomCode, playerId, profileName]);

  const startRound = () => {
    const l = randomLetter();
    setLetter(l);
    setAnswers({});
    setTimeLeft(timer);
    setRunning(true);
    setResults({});
    setVotes({});
    setShowResults(false);
    toast({ title: "Round started", description: `Letter: ${l} • ${timer} seconds` });
    if (roomCode && channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event: 'round_start', payload: { letter: l, timer } });
    }
  };
  const submitRound = () => {
    setRunning(false);
    const r: PlayerResult = { playerId, name: profileName, letter, answers } as PlayerResult;
    setResults((prev) => ({ ...prev, [playerId]: r }));
    if (roomCode && channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event: 'round_submit', payload: r });
      channelRef.current.send({ type: 'broadcast', event: 'round_end', payload: {} });
    }
    setShowResults(true);
    const score = Object.values(answers).filter((a) => a && a.trim().length > 0).length;
    toast({ title: "Round submitted", description: `You filled ${score}/${total} categories.` });
  };

  return (
    <>
      <Helmet>
        <title>Scattergories Online — Solo Round</title>
        <meta name="description" content="Play Scattergories online in solo mode. Random letters, timed rounds, and 12 classic categories. Start a quick round now!" />
        <link rel="canonical" href="/game" />
      </Helmet>
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-primary/10 via-accent/10 to-background">
        <Aurora />
        <Particles />
        <main className="relative z-10 container mx-auto py-8">
          <div className="rounded-xl border border-border/60 bg-background/60 backdrop-blur-xl p-4 md:p-6 shadow-[var(--shadow-elegant)]">
            <header className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-lg p-4 bg-gradient-to-r from-primary/10 to-transparent animate-fade-in">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Scattergories Online — {roomCode ? "Room" : "Solo"}</h1>
                <p className="text-muted-foreground mt-1">12 categories • one letter • beat the clock</p>
              </div>
              {roomCode && (
                <div className="flex items-center gap-3">
                  <div className="hidden md:flex -space-x-2">
                    {players.map((p) => (
                      <Avatar key={p.id} className="border shadow">
                        <AvatarFallback style={{ backgroundImage: gradientFromString(p.name), color: "white" }}>
                          {initialsFromName(p.name)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  <span className="rounded-full border px-3 py-1 text-sm">Room {roomCode} • {presentCount} online</span>
  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Room settings" className="hover-scale">
                        <Settings className="h-5 w-5" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Room Settings</DialogTitle>
                        <DialogDescription>Adjust round options for this session.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <Label>Timer</Label>
                          <Select value={String(timer)} onValueChange={(v) => setTimer(parseInt(v, 10))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select duration" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>Duration</SelectLabel>
                                <SelectItem value="60">60 seconds</SelectItem>
                                <SelectItem value="120">120 seconds</SelectItem>
                                <SelectItem value="180">180 seconds</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          These settings apply locally. Use chat to align with players.
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
  
                  <Button variant="secondary" onClick={leaveRoom} className="hover-scale">Leave Room</Button>
                </div>
              )}
            </header>
  
            <section className="grid gap-6 md:grid-cols-[1fr,360px]">
              <article>
                <Card className="animate-fade-in bg-background/60 backdrop-blur-xl border border-border/60 shadow-[var(--shadow-elegant)]">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-xl">Your List</CardTitle>
                    <div className="flex items-center gap-3">
                      <div className="rounded-full border px-4 py-2 text-lg font-semibold">
                        {letter ?? "–"}
                      </div>
                      <div className="w-40">
                        <Progress value={progress} />
                        <div className="text-xs text-muted-foreground mt-1">
                          {running ? `${timeLeft}s remaining` : "Timer idle"}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4">
                      {DEFAULT_CATEGORIES.map((cat, idx) => (
                        <div key={idx} className="grid gap-2">
                          <Label htmlFor={`cat-${idx}`}>{idx + 1}. {cat}</Label>
                          <Input
                            id={`cat-${idx}`}
                            placeholder={letter ? `Starts with ${letter}` : "Start a round to get a letter"}
                            value={answers[idx] ?? ""}
                            onChange={(e) => setAnswers((prev) => ({ ...prev, [idx]: e.target.value }))}
                            disabled={!letter}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 flex items-center gap-3">
                      <Button onClick={startRound} disabled={running} className="hover-scale">
                        {running ? "Round Running" : "Start Round"}
                      </Button>
                      <Button variant="secondary" onClick={submitRound} disabled={!letter} className="hover-scale">
                        Submit Round
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </article>
  
              <aside>
                {!roomCode && (
                  <Card className="animate-fade-in bg-background/60 backdrop-blur-xl border border-border/60 shadow-[var(--shadow-elegant)]">
                    <CardHeader>
                      <CardTitle>Round Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                      <div className="grid gap-2">
                        <Label>Timer</Label>
                        <Select value={String(timer)} onValueChange={(v) => setTimer(parseInt(v, 10))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select duration" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>Duration</SelectLabel>
                              <SelectItem value="60">60 seconds</SelectItem>
                              <SelectItem value="120">120 seconds</SelectItem>
                              <SelectItem value="180">180 seconds</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Scoring in solo mode counts filled categories. Multiplayer uniqueness rules will be added with realtime rooms.
                      </div>
                    </CardContent>
                  </Card>
                )}
  
                {roomCode && (
                  <>
                    <Card className="animate-fade-in bg-background/60 backdrop-blur-xl border border-border/60 shadow-[var(--shadow-elegant)]">
                      <CardHeader>
                        <CardTitle>Players in Room</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-48">
                          <div className="space-y-3 pr-2">
                            {players.length === 0 ? (
                              <div className="text-sm text-muted-foreground">No players yet</div>
                            ) : (
                              players.map((p) => (
                                <div key={p.id} className="flex items-center gap-3">
                                  <Avatar className="border shadow">
                                    <AvatarFallback style={{ backgroundImage: gradientFromString(p.name), color: "white" }}>
                                      {initialsFromName(p.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="text-sm">
                                    <div className="font-medium">
                                      {p.name} {p.id === playerId ? <span className="text-muted-foreground">(You)</span> : null}
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
  
                    <div className="mt-6 animate-fade-in">
                      <ChatPanel
                        messages={messages}
                        onSend={(text) => {
                          if (!channelRef.current) return;
                          const payload = { id: playerId, name: profileName, text, ts: Date.now() } as ChatMessage;
                          channelRef.current.send({ type: 'broadcast', event: 'chat', payload });
                          setMessages((m) => [...m, payload].slice(-200));
                        }}
                        currentName={profileName}
                      />
                    </div>
                  </>
                )}
              </aside>
            </section>
          </div>
        </main>
      </div>
      {roomCode && (
        <ResultsOverlay
          open={showResults}
          onClose={() => setShowResults(false)}
          results={results}
          presentCount={presentCount}
          votes={votes}
          onVote={(key) => {
            if (!channelRef.current) return;
            channelRef.current.send({ type: 'broadcast', event: 'vote', payload: { key, voterId: playerId } });
            setVotes((prev) => {
              const set = new Set([...(prev[key] || [])]);
              set.add(playerId);
              return { ...prev, [key]: Array.from(set) };
            });
          }}
          categories={DEFAULT_CATEGORIES}
          localPlayerId={playerId}
        />
      )}
    </>
  );
};

export default Game;
