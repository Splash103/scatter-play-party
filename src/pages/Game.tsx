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
import { Settings, Crown, Flame, Volume2, VolumeX } from "lucide-react";
import Particles from "@/components/Particles";
import Aurora from "@/components/Aurora";
import { CATEGORY_LISTS, generateRandomList } from "@/data/categoryLists";
import { FinalScoreboard } from "@/components/FinalScoreboard";
import { useGameSounds } from "@/hooks/use-sound";
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
  const [players, setPlayers] = useState<{ id: string; name: string; online_at?: string }[]>([]);
  const [results, setResults] = useState<Record<string, PlayerResult>>({});
  const [votes, setVotes] = useState<Record<string, string[]>>({});
  const [showResults, setShowResults] = useState(false);

  // Match state (multiplayer)
  const [roundsPerMatch, setRoundsPerMatch] = useState<number>(5);
  const [roundsPlayed, setRoundsPlayed] = useState<number>(0);
  const [currentRoundIndex, setCurrentRoundIndex] = useState<number>(0);
  const [activeCategories, setActiveCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [usedListIds, setUsedListIds] = useState<Set<string>>(new Set());
  const [matchTotals, setMatchTotals] = useState<Record<string, number>>({});
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [leaderId, setLeaderId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [roundCommitted, setRoundCommitted] = useState<boolean>(false);
  const isHost = Boolean(roomCode) && hostId === playerId;
  const [matchSummary, setMatchSummary] = useState<{
    winners: { id: string; name: string; total: number }[];
    totals: Record<string, number>;
    players: { id: string; name: string }[];
  } | null>(null);
  const [finalOpen, setFinalOpen] = useState<boolean>(false);
  const [voteSeconds, setVoteSeconds] = useState<number>(15);
  const [voteTimeLeft, setVoteTimeLeft] = useState<number>(0);
  const [votingActive, setVotingActive] = useState<boolean>(false);
  const [soundOn, setSoundOn] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem('soundOn') ?? 'true'); } catch { return true; }
  });
  useEffect(() => { localStorage.setItem('soundOn', JSON.stringify(soundOn)); }, [soundOn]);
  const { playRoundStart, playVote, playWin } = useGameSounds(soundOn);
  const [roundStarting, setRoundStarting] = useState<boolean>(false);
  const roundStartingRef = useRef<boolean>(false);
  const leaveRoom = () => {
    navigate("/");
    toast({ title: "Left room", description: "You returned to the main menu." });
  };
  const progress = useMemo(() => {
    if (!running || timer === 0) return 0;
    return Math.min(100, ((timer - timeLeft) / timer) * 100);
  }, [running, timeLeft, timer]);

  const displayRound = useMemo(() => {
    if (currentRoundIndex > 0) return currentRoundIndex;
    const base = roundsPlayed;
    const inProgress = running || showResults || votingActive;
    const next = base + (inProgress ? 1 : 0);
    if (next <= 0) return 1;
    return Math.min(roundsPerMatch, next);
  }, [currentRoundIndex, roundsPlayed, running, showResults, votingActive, roundsPerMatch]);

  const primaryButtonLabel = useMemo(() => {
    if (running) return "Round Running";
    if (roundsPlayed >= roundsPerMatch) return "Start New Match";
    if (roundsPlayed === 0 && !currentRoundIndex) return roomCode ? "Start Match" : "Start Round";
    return "Next Round";
  }, [running, roundsPlayed, roundsPerMatch, currentRoundIndex, roomCode]);

  // Lock settings when a match is in progress (any round started until match ends)
  const matchInProgress = useMemo(
    () => running || showResults || votingActive || roundsPlayed > 0 || currentRoundIndex > 0,
    [running, showResults, votingActive, roundsPlayed, currentRoundIndex]
  );
  const matchInProgressRef = useRef(false);
  useEffect(() => {
    matchInProgressRef.current = matchInProgress;
  }, [matchInProgress]);
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
            if (isHost) {
              channelRef.current.send({ type: "broadcast", event: "round_end", payload: {} });
            }
          }
          if (!roomCode || isHost) {
            setShowResults(true);
            setVotingActive(true);
          }
          toast({ title: "Time's up!", description: "Review and submit your answers." });
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, roomCode, playerId, profileName, letter, answers, isHost]);

  useEffect(() => {
    if (!roomCode) return;
    const channel = supabase.channel(`room_${roomCode}`, { config: { presence: { key: playerId } } });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, { id: string; name: string; online_at?: string }[]>;
        const list = Object.entries(state).map(([key, presences]) => ({
          id: key,
          name: presences?.[0]?.name || 'Player',
          online_at: presences?.[0]?.online_at,
        }));
        setPlayers(list);
        setPresentCount(list.length || 1);
        const withTs = list.map((p) => ({ ...p, ts: Date.parse(p.online_at || '') || Date.now() }));
        withTs.sort((a, b) => a.ts - b.ts);
        setHostId(withTs[0]?.id ?? null);
      })
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        setMessages((m) => [...m, payload as ChatMessage].slice(-200));
      })
      .on('broadcast', { event: 'round_start' }, ({ payload }) => {
        const p = payload as { letter: string; timer: number; categories: string[]; roundIndex: number };
        setLetter(p.letter);
        setAnswers({});
        setActiveCategories(p.categories);
        setTimeLeft(p.timer);
        setRunning(true);
        setResults({});
        setVotes({});
        setShowResults(false);
        setRoundCommitted(false);
        setCurrentRoundIndex(p.roundIndex);
        /* round index received: p.roundIndex; keep roundsPlayed as completed rounds */
        toast({ title: "Round started", description: `Letter: ${p.letter} • ${p.timer} seconds` });
        playRoundStart();
        setRoundStarting(false);
        roundStartingRef.current = false;
      })
      .on('broadcast', { event: 'round_submit' }, ({ payload }) => {
        const r = payload as PlayerResult;
        setResults((prev) => ({ ...prev, [r.playerId]: r }));
      })
      .on('broadcast', { event: 'round_end' }, () => {
        // Auto-submit local answers if not already submitted
        if (!results[playerId]) {
          const r: PlayerResult = { playerId, name: profileName, letter, answers } as PlayerResult;
          setResults((prev) => ({ ...prev, [playerId]: r }));
          channelRef.current?.send({ type: 'broadcast', event: 'round_submit', payload: r });
        }
        setRunning(false);
        setShowResults(true);
        setVotingActive(true);
      })
      .on('broadcast', { event: 'vote' }, ({ payload }) => {
        const { key, voterId } = payload as { key: string; voterId: string };
        setVotes((prev) => {
          const set = new Set([...(prev[key] || [])]);
          set.add(voterId);
          return { ...prev, [key]: Array.from(set) };
        });
      })
      .on('broadcast', { event: 'vote_extend' }, ({ payload }) => {
        const { add } = payload as { add: number };
        setVoteTimeLeft((t) => t + (add || 0));
      })
      .on('broadcast', { event: 'room_settings' }, ({ payload }) => {
        // Ignore mid-match setting changes
        if (matchInProgressRef.current) return;
        const p = payload as { timer: number; roundsPerMatch: number; voteSeconds?: number };
        setTimer(p.timer);
        setRoundsPerMatch(p.roundsPerMatch);
        if (typeof p.voteSeconds === 'number') setVoteSeconds(p.voteSeconds);
        toast({ title: "Room settings updated", description: `Timer ${p.timer}s • Rounds ${p.roundsPerMatch}${typeof p.voteSeconds === 'number' ? ` • Voting ${p.voteSeconds}s` : ''}` });
      })
      .on('broadcast', { event: 'scores_state' }, ({ payload }) => {
        const p = payload as { matchTotals: Record<string, number>; streaks: Record<string, number>; roundsPlayed: number; leaderId: string | null };
        setMatchTotals(p.matchTotals);
        setStreaks(p.streaks);
        setRoundsPlayed(p.roundsPlayed);
        setLeaderId(p.leaderId ?? null);
      })
      .on('broadcast', { event: 'match_end' }, ({ payload }) => {
        const p = payload as { winners: { id: string; name: string; total: number }[]; matchId?: string };
        // Update local leaderboard (legacy local storage)
        try {
          const raw = localStorage.getItem('leaderboard');
          const existing = raw ? (JSON.parse(raw) as { name: string; wins: number }[]) : [];
          const map = new Map(existing.map((e) => [e.name, e.wins] as const));
          for (const w of p.winners) {
            map.set(w.name, (map.get(w.name) ?? 0) + 1);
          }
          const updated = Array.from(map.entries()).map(([name, wins]) => ({ name, wins }));
          localStorage.setItem('leaderboard', JSON.stringify(updated));
        } catch (_) {}
        toast({ title: "Match over!", description: `Winner(s): ${p.winners.map((w) => w.name).join(', ')}` });

        // Persist to Supabase if signed in
        (async () => {
          const { data: sess } = await supabase.auth.getSession();
          const user = sess.session?.user;
          if (!user) return;
          const meWon = p.winners.some((w) => w.id === playerId);
          // Ensure profile exists and update streaks
          const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
          const display_name = prof?.display_name || profileName || user.email || 'Player';
          const current_streak = meWon ? (prof?.current_streak ?? 0) + 1 : 0;
          const best_streak = Math.max(prof?.best_streak ?? 0, current_streak);
          await supabase.from('profiles').upsert({ id: user.id, display_name, current_streak, best_streak }).select();
          // Record a match win if this client won and we have a matchId
          if (meWon && p.matchId) {
            await supabase.from('match_wins').insert({ match_id: p.matchId, user_id: user.id }).select();
          }
        })();

        // Show final scoreboard to non-host clients too
        if (!isHost) {
          const currentPlayers = players.map((pl) => ({ id: pl.id, name: pl.name }));
          const totals: Record<string, number> = { ...matchTotals };
          for (const pl of currentPlayers) { if (totals[pl.id] === undefined) totals[pl.id] = 0; }
          setMatchSummary({ winners: p.winners, totals, players: currentPlayers });
          setFinalOpen(true);
        }
        // Reset match state
        setMatchTotals({});
        setStreaks({});
        setRoundsPlayed(0);
        setLeaderId(null);
        setUsedListIds(new Set());
        setCurrentRoundIndex(0);
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

  // Host: broadcast current settings/scores when becoming host or on subscribe
  useEffect(() => {
    if (!roomCode || !channelRef.current || !isHost) return;
    channelRef.current.send({ type: 'broadcast', event: 'room_settings', payload: { timer, roundsPerMatch, voteSeconds } });
    channelRef.current.send({ type: 'broadcast', event: 'scores_state', payload: { matchTotals, streaks, roundsPlayed, leaderId } });
  }, [roomCode, isHost]);

  // Compute majority threshold for disqualification
  const majority = useMemo(() => Math.floor(presentCount / 2) + 1, [presentCount]);

  // Host-only: commit round scores based on current results and votes
  const commitRoundScores = (autoAdvance = false) => {
    if (!roomCode || !isHost) return;
    if (roundCommitted) return;
    // Tally round scores
    const newTotals = { ...matchTotals };
    const nextStreaks: Record<string, number> = { ...streaks };
    const perPlayerRoundScore: Record<string, number> = {};
    for (const r of Object.values(results)) {
      let score = 0;
      const targetLetter = (r.letter || letter || '').toUpperCase();
      for (const [idxStr, ans] of Object.entries(r.answers || {})) {
        const idx = Number(idxStr);
        const key = `${r.playerId}:${idx}`;
        const dq = (votes[key]?.length || 0) >= majority;
        const startsOk = !!ans && targetLetter && ans.trimStart().charAt(0).toUpperCase() === targetLetter;
        if (startsOk && !dq) score += 1;
        if (dq && !!ans?.trim()) score -= 1; // majority removal penalty
      }
      perPlayerRoundScore[r.playerId] = score;
      newTotals[r.playerId] = (newTotals[r.playerId] ?? 0) + score;
    }
    // Determine round winners (for UI only); do NOT update streaks here (streaks are per MATCH)
    const maxScore = Math.max(0, ...Object.values(perPlayerRoundScore));
    const winners = Object.entries(perPlayerRoundScore)
      .filter(([, s]) => s === maxScore)
      .map(([id]) => id);

    // Keep streaks unchanged during rounds
    // Compute leader by totals (tie => null)
    let nextLeader: string | null = null;
    let maxTotal = -1;
    let tie = false;
    for (const [id, tot] of Object.entries(newTotals)) {
      if (tot > maxTotal) { maxTotal = tot; nextLeader = id; tie = false; }
      else if (tot === maxTotal) { tie = true; }
    }
    if (tie) nextLeader = null;

    // Compute next round index based on current state
    const nextRound = roundsPlayed + 1;

    setMatchTotals(newTotals);
    setStreaks(nextStreaks);
    setRoundsPlayed(nextRound);
    setLeaderId(nextLeader);
    setRoundCommitted(true);

    // Broadcast state
    channelRef.current?.send({ type: 'broadcast', event: 'scores_state', payload: {
      matchTotals: newTotals,
      streaks: nextStreaks,
      roundsPlayed: nextRound,
      leaderId: nextLeader,
    }});

    // Auto end match if done
    const done = nextRound >= roundsPerMatch;
    if (done) endMatch(newTotals);
  };

  const endMatch = (totalsArg?: Record<string, number>) => {
    if (!roomCode || !isHost) return;
    const currentPlayers = players.map((p) => ({ id: p.id, name: p.name }));
    const totalsRaw = totalsArg ?? matchTotals;
    // Ensure all players are present in totals
    const totals: Record<string, number> = { ...totalsRaw };
    for (const p of currentPlayers) { if (totals[p.id] === undefined) totals[p.id] = 0; }

    const maxTotal = Math.max(0, ...Object.values(totals));
    const winners = Object.entries(totals).filter(([, t]) => t === maxTotal).map(([id]) => {
      const name = players.find((p) => p.id === id)?.name || 'Player';
      return { id, name, total: maxTotal };
    });

    // Update streaks at MATCH end (not per round)
    const newStreaks: Record<string, number> = { ...streaks };
    const winnerIds = new Set(winners.map((w) => w.id));
    for (const p of currentPlayers) {
      if (winnerIds.has(p.id)) newStreaks[p.id] = (newStreaks[p.id] ?? 0) + 1; else newStreaks[p.id] = 0;
    }

    // Create a match id for persistence
    const matchId = (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as string;

    // Open final scoreboard locally
    setMatchSummary({ winners, totals, players: currentPlayers });
    setFinalOpen(true);
    playWin();

    // Broadcast to room (include match id)
    channelRef.current?.send({ type: 'broadcast', event: 'match_end', payload: { winners, matchId } });
    channelRef.current?.send({ type: 'broadcast', event: 'scores_state', payload: {
      matchTotals: totals,
      streaks: newStreaks,
      roundsPlayed: 0,
      leaderId: null,
    }});

    // Update local state for next match (keep totals for scoreboard until reset)
    setStreaks(newStreaks);
    setRoundsPlayed(0);
    setLeaderId(null);
  };

  const selectNextList = (): { id: string; categories: string[] } | null => {
    const available = CATEGORY_LISTS.filter((l) => !usedListIds.has(l.id));
    if (available.length === 0) {
      const rand = generateRandomList();
      return { id: rand.id, categories: rand.categories };
    }
    const pick = available[Math.floor(Math.random() * available.length)];
    return { id: pick.id, categories: pick.categories };
  };

  const startRound = () => {
    if (roomCode && !isHost) {
      toast({ title: "Host only", description: "Only the host can start a round." });
      return;
    }

    if (roundStartingRef.current) return;
    roundStartingRef.current = true;
    setRoundStarting(true);

    const willCommit = !!roomCode && showResults && !roundCommitted;
    if (willCommit) {
      commitRoundScores();
    }

    let effectiveRoundsPlayed = roundsPlayed + (willCommit ? 1 : 0);

      if (roomCode) {
        if (effectiveRoundsPlayed >= roundsPerMatch) {
          // Do not auto-start a new match; show final results instead
          toast({ title: "Match finished", description: "View the final scoreboard. Start a new match from there." });
          roundStartingRef.current = false;
          setRoundStarting(false);
          return;
        }
      }


    // Pick categories for this round
    let categories = activeCategories;
    let listId: string | null = null;
    if (roomCode) {
      const next = selectNextList();
      if (!next) {
        toast({ title: "No lists left", description: "All lists used this match." });
        roundStartingRef.current = false;
        setRoundStarting(false);
        return;
      }
      categories = next.categories;
      listId = next.id;
      setActiveCategories(categories);
      setUsedListIds((prev) => new Set(prev).add(next.id));
    }

    const l = randomLetter();
    setLetter(l);
    setAnswers({});
    setTimeLeft(timer);
    setRunning(true);
    setResults({});
    setVotes({});
    setShowResults(false);
    setVotingActive(false);
    setRoundCommitted(false);
    const roundIndex = effectiveRoundsPlayed + 1;
    setCurrentRoundIndex(roundIndex);
    toast({ title: "Round started", description: `Letter: ${l} • ${timer} seconds` });
    if (roomCode && channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event: 'round_start', payload: { letter: l, timer, categories, roundIndex } });
    }

    // Safety: release debounce if we don't get our own broadcast echo
    setTimeout(() => { roundStartingRef.current = false; setRoundStarting(false); }, 500);
  };

  const submitRound = () => {
    setRunning(false);
    const r: PlayerResult = { playerId, name: profileName, letter, answers } as PlayerResult;
    setResults((prev) => ({ ...prev, [playerId]: r }));
    if (roomCode && channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event: 'round_submit', payload: r });
      if (isHost) {
        channelRef.current.send({ type: 'broadcast', event: 'round_end', payload: {} });
      }
    }
    if (!roomCode || isHost) { setShowResults(true); setVotingActive(true); }
    const totalFilled = Object.values(answers as Record<number, string>).filter((a) => a && a.trim().length > 0).length;
    const totalCats = activeCategories.length;
    toast({ title: "Round submitted", description: `You filled ${totalFilled}/${totalCats} categories.` });
  };

  const endRoundEarly = () => {
    if (!roomCode || !isHost || !channelRef.current) return;
    setRunning(false);
    const r: PlayerResult = { playerId, name: profileName, letter, answers } as PlayerResult;
    setResults((prev) => ({ ...prev, [playerId]: r }));
    channelRef.current.send({ type: 'broadcast', event: 'round_submit', payload: r });
    channelRef.current.send({ type: 'broadcast', event: 'round_end', payload: {} });
    setShowResults(true);
    setVotingActive(true);
  };
  useEffect(() => {
    if (!votingActive) { setVoteTimeLeft(0); return; }
    setVoteTimeLeft(voteSeconds);
    const id = setInterval(() => {
      setVoteTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id);
          if (isHost) {
            if (!roundCommitted) commitRoundScores(true);
            setShowResults(false);
            setVotingActive(false);
            const nextRoundNum = roundsPlayed + 1;
            if (roomCode && nextRoundNum < roundsPerMatch) {
              setTimeout(() => startRound(), 250);
            }
          } else {
            setVotingActive(false);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [votingActive, voteSeconds, isHost, roundsPlayed, roundsPerMatch, roomCode]);

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
            <header className="mb-4 sm:mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-lg p-3 sm:p-4 bg-gradient-to-r from-primary/10 to-transparent animate-fade-in">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Scattergories Online — {roomCode ? "Room" : "Solo"}</h1>
                <p className="text-muted-foreground mt-1 text-sm sm:text-base">12 categories • one letter • beat the clock</p>
              </div>
              {roomCode && (
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="hidden md:flex -space-x-2">
                    {players.map((p) => (
                      <Avatar key={p.id} className="border shadow">
                        <AvatarFallback style={{ backgroundImage: gradientFromString(p.name), color: "white" }}>
                          {initialsFromName(p.name)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  <span className="rounded-full border px-2 py-0.5 text-xs sm:text-sm sm:px-3 sm:py-1">Room {roomCode} • {presentCount} online</span>

                  <Button variant="ghost" size="icon" aria-label={soundOn ? "Mute sound" : "Unmute sound"} onClick={() => setSoundOn((s) => !s)} className="hover-scale">
                    {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                  </Button>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Room settings"
                        className="hover-scale"
                        disabled={matchInProgress}
                        title={matchInProgress ? "Settings are locked during a match" : undefined}
                      >
                        <Settings className="h-5 w-5" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Room Settings</DialogTitle>
                        <DialogDescription>Host-only. Applies to everyone instantly.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <Label>Timer</Label>
                          <Select value={String(timer)} onValueChange={(v) => {
                            const val = parseInt(v, 10);
                            if (matchInProgress) {
                              toast({ title: "Settings locked", description: "Cannot change during a match." });
                              return;
                            }
                            setTimer(val);
                            if (roomCode && isHost) channelRef.current?.send({ type: 'broadcast', event: 'room_settings', payload: { timer: val, roundsPerMatch, voteSeconds } });
                          }} disabled={!!roomCode && (!isHost || matchInProgress)}>

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
                        <div className="grid gap-2">
                          <Label>Rounds per match</Label>
                          <Select value={String(roundsPerMatch)} onValueChange={(v) => {
                            const val = parseInt(v, 10);
                            if (matchInProgress) {
                              toast({ title: "Settings locked", description: "Cannot change during a match." });
                              return;
                            }
                            setRoundsPerMatch(val);
                            if (roomCode && isHost) channelRef.current?.send({ type: 'broadcast', event: 'room_settings', payload: { timer, roundsPerMatch: val, voteSeconds } });
                          }} disabled={!!roomCode && (!isHost || matchInProgress)}>

                            <SelectTrigger>
                              <SelectValue placeholder="Select rounds" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>Rounds</SelectLabel>
                                {[3,5,7,9,10].map((n) => (
                                  <SelectItem key={n} value={String(n)}>{n} rounds</SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Voting window</Label>
                          <Select value={String(voteSeconds)} onValueChange={(v) => {
                            const val = parseInt(v, 10);
                            if (matchInProgress) {
                              toast({ title: "Settings locked", description: "Cannot change during a match." });
                              return;
                            }
                            setVoteSeconds(val);
                            if (roomCode && isHost) channelRef.current?.send({ type: 'broadcast', event: 'room_settings', payload: { timer, roundsPerMatch, voteSeconds: val } });
                          }} disabled={!!roomCode && (!isHost || matchInProgress)}>

                            <SelectTrigger>
                              <SelectValue placeholder="Select voting time" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>Voting</SelectLabel>
                                {[10,15,20].map((n) => (
                                  <SelectItem key={n} value={String(n)}>{n} seconds</SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>
                        {!!roomCode && !isHost && (
                          <div className="text-sm text-muted-foreground">Only the host can change settings.</div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
  
                  <Button variant="secondary" onClick={leaveRoom} className="hover-scale">Leave Room</Button>
                </div>
              )}
            </header>
  
            <section className="grid gap-4 md:grid-cols-[1fr,360px]">
              <article>
                <Card className="animate-fade-in bg-background/60 backdrop-blur-xl border border-border/60 shadow-[var(--shadow-elegant)]">
                  <CardHeader className="flex flex-row items-center justify-between sticky top-0 z-10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <CardTitle className="text-lg sm:text-xl">Your List</CardTitle>
                    <div className="flex items-center gap-2 sm:gap-3">
                      {roomCode && (running || showResults || votingActive || roundsPlayed > 0) && (
                        <div className="rounded-full border px-2 py-0.5 text-xs sm:px-3 sm:py-1">Round {displayRound}/{roundsPerMatch}</div>
                      )}
                      <div className="rounded-full border px-3 py-1 text-base font-semibold hidden xs:block">
                        {letter ?? "–"}
                      </div>
                      <div className="w-32 sm:w-40">
                        <Progress value={progress} />
                        <div className="text-xs text-muted-foreground mt-1">
                          {running ? `${timeLeft}s remaining` : "Timer idle"}
                        </div>
                      </div>
                      {votingActive && (
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border px-2 py-0.5 text-xs sm:px-3 sm:py-1">Voting {voteTimeLeft}s</span>
                          {isHost && (
                            <Button variant="secondary" size="sm" onClick={() => {
                              setVoteTimeLeft((t) => t + 5);
                              channelRef.current?.send({ type: 'broadcast', event: 'vote_extend', payload: { add: 5 } });
                            }}>
                              +5s
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4 sm:pb-6">
                    <div className="grid gap-4">
                      {letter && running ? (
                        activeCategories.map((cat, idx) => (
                          <div key={idx} className="grid gap-2">
                            <Label htmlFor={`cat-${idx}`}>{idx + 1}. {cat}</Label>
                            <Input
                              id={`cat-${idx}`}
                              placeholder={letter ? `Starts with ${letter}` : "Start a round to get a letter"}
                              value={answers[idx] ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (!letter) return;
                                if (v.length === 0) {
                                  setAnswers((prev) => ({ ...prev, [idx]: "" }));
                                  return;
                                }
                                const first = v.trimStart().charAt(0).toUpperCase();
                                if (first === letter.toUpperCase()) {
                                  setAnswers((prev) => ({ ...prev, [idx]: v }));
                                }
                              }}
                              disabled={!letter}
                            />
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-muted-foreground">Categories will be revealed when the round starts.</div>
                      )}
                    </div>
                    <div className="mt-4 sm:mt-6 flex items-center gap-2 sm:gap-3">
                      <Button onClick={startRound} disabled={running || votingActive || roundStarting || (!!roomCode && !isHost)} className="hover-scale w-full sm:w-auto">
                        {primaryButtonLabel}
                      </Button>
                      {roomCode && isHost && running && (
                        <Button variant="outline" onClick={endRoundEarly} className="hover-scale w-full sm:w-auto">
                          End Round (Host)
                        </Button>
                      )}
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
                                    <div className="font-medium flex items-center gap-1">
                                      {p.id === hostId ? <Crown className="h-3.5 w-3.5 text-primary" aria-label="Host" /> : null}
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
                        hostId={hostId}
                        leaderId={leaderId ?? undefined}
                        streaks={streaks}
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
        <>
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
              playVote();
            }}
            categories={activeCategories}
            localPlayerId={playerId}
            voteTimeLeft={voteTimeLeft}
            players={players}
          />
          <FinalScoreboard
            open={finalOpen}
            onClose={() => setFinalOpen(false)}
            summary={matchSummary}
            isHost={isHost}
            onPlayAgain={() => {
              setFinalOpen(false);
              setMatchTotals({});
              setStreaks({});
              setLeaderId(null);
              setUsedListIds(new Set());
              setRoundsPlayed(0);
              setCurrentRoundIndex(0);
              startRound();
            }}
          />
        </>
      )}
    </>
  );
};

export default Game;
