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
          toast({ title: "Time's up!", description: "Review and submit your answers." });
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const startRound = () => {
    const l = randomLetter();
    setLetter(l);
    setAnswers({});
    setTimeLeft(timer);
    setRunning(true);
    toast({ title: "Round started", description: `Letter: ${l} • ${timer} seconds` });
  };

  const submitRound = () => {
    setRunning(false);
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
      <main className="container mx-auto py-8">
<header className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Scattergories Online — {roomCode ? "Room" : "Solo"}</h1>
            <p className="text-muted-foreground mt-1">12 categories • one letter • beat the clock</p>
          </div>
          {roomCode && (
            <div className="flex items-center gap-2">
              <span className="rounded-full border px-3 py-1 text-sm">Room {roomCode}</span>
              <Button variant="secondary" onClick={leaveRoom}>Leave Room</Button>
            </div>
          )}
        </header>

        <section className="grid gap-6 md:grid-cols-[1fr,360px]">
          <article>
            <Card>
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
                  <Button onClick={startRound} disabled={running}>
                    {running ? "Round Running" : "Start Round"}
                  </Button>
                  <Button variant="secondary" onClick={submitRound} disabled={!letter}>
                    Submit Round
                  </Button>
                </div>
              </CardContent>
            </Card>
          </article>

          <aside>
            <Card>
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
          </aside>
        </section>
      </main>
    </>
  );
};

export default Game;
