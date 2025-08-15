import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { gradientFromString, initialsFromName } from "@/lib/gradient";
import { ChatPanel, type ChatMessage } from "@/components/ChatPanel";
import { ResultsOverlay, type PlayerResult } from "@/components/ResultsOverlay";
import { FinalScoreboard, type FinalSummary } from "@/components/FinalScoreboard";
import { useGameSounds } from "@/hooks/use-sound";
import { usePublicRoomAdvertiser } from "@/hooks/usePublicRoomAdvertiser";
import { CATEGORY_LISTS, generateRandomList, type CategoryList } from "@/data/categoryLists";
import Particles from "@/components/Particles";
import Aurora from "@/components/Aurora";
import { 
  Users, 
  Crown, 
  Play, 
  Pause, 
  RotateCcw, 
  Settings, 
  Copy, 
  Check, 
  Timer, 
  Trophy,
  MessageCircle,
  Volume2,
  VolumeX,
  Shuffle,
  List,
  UserPlus,
  LogOut,
  Flame
} from "lucide-react";

// Game constants
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DEFAULT_ROUND_TIME = 90;
const VOTE_TIME = 30;
const RESULTS_TIME = 10;

// Types
type GamePhase = "lobby" | "playing" | "voting" | "results" | "final";
type Player = { id: string; name: string; present: boolean };

const Game = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomCode = searchParams.get("room")?.toUpperCase() || "";
  
  // Player state
  const [playerName, setPlayerName] = useState(() => localStorage.getItem("profileName") || "");
  const [playerId] = useState(() => `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  
  // Room state
  const [players, setPlayers] = useState<Player[]>([]);
  const presentPlayers = useMemo(() => players.filter(p => p.present), [players]);
  const [hostId, setHostId] = useState<string | null>(null);
  const isHost = !roomCode || hostId === playerId;
  const isPlayerHost = hostId === playerId;
  const [isPublic, setIsPublic] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("soundEnabled") !== "false");
  
  // Game state
  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(3);
  const [roundTime, setRoundTime] = useState(DEFAULT_ROUND_TIME);
  const [timeLeft, setTimeLeft] = useState(0);
  const [letter, setLetter] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedList, setSelectedList] = useState<CategoryList>(CATEGORY_LISTS[0]);
  const [voteTime, setVoteTime] = useState(30);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [results, setResults] = useState<Record<string, PlayerResult>>({});
  const [votes, setVotes] = useState<Record<string, string[]>>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [finalSummary, setFinalSummary] = useState<FinalSummary | null>(null);
  
  // UI state
  const [showResults, setShowResults] = useState(false);
  const [showFinal, setShowFinal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showChat, setShowChat] = useState(false);
  
  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  // Refs
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const createdAtRef = useRef<string>(new Date().toISOString());
  
  // Hooks
  const { playRoundStart, playVote, playWin } = useGameSounds(soundEnabled);
  
  // Room advertising for public rooms
  usePublicRoomAdvertiser({
    enabled: isHost && isPublic && roomCode !== "",
    roomCode,
    payload: {
      name: `${playerName || "Host"}'s Room`,
      hostName: playerName || "Host",
      maxPlayers: 8,
      createdAtISO: createdAtRef.current,
    },
    players: players.filter(p => p.present).length,
    inMatch: phase !== "lobby",
  });

  // Room setup - moved after all hooks
  useEffect(() => {
    if (!playerName.trim()) {
      const name = prompt("Enter your name:");
      if (!name?.trim()) {
        navigate("/");
        return;
      }
      setPlayerName(name.trim());
      localStorage.setItem("profileName", name.trim());
    }
  }, [playerName, navigate]);

  // Copy room code
  const copyRoomCode = useCallback(async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      toast({ title: "Copied!", description: "Room code copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", description: "Please copy the room code manually", variant: "destructive" });
    }
  }, [roomCode]);

  // Timer management
  const startTimer = useCallback((duration: number) => {
    setTimeLeft(duration);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Game logic
  const startRound = useCallback(() => {
    if (!isPlayerHost) return;
    
    const newLetter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const newCategories = selectedList.categories.slice(0, 12);
    
    setLetter(newLetter);
    setCategories(newCategories);
    setPhase("playing");
    setAnswers({});
    setResults({});
    setVotes({});
    
    playRoundStart();
    startTimer(roundTime);
    
    // Broadcast to room
    channelRef.current?.send({
      type: "broadcast",
      event: "round_start",
      payload: { letter: newLetter, categories: newCategories, round: currentRound }
    });
  }, [isPlayerHost, selectedList, currentRound, playRoundStart, startTimer, roundTime]);

  const submitAnswers = useCallback(() => {
    if (!channelRef.current) return;
    
    const playerResult: PlayerResult = {
      playerId,
      name: playerName || "Anonymous",
      letter,
      answers
    };
    
    channelRef.current.send({
      type: "broadcast",
      event: "answers_submitted",
      payload: playerResult
    });
  }, [playerId, playerName, letter, answers]);

  // Check if all players have submitted and transition to voting
  useEffect(() => {
    if (phase === "playing" && Object.keys(results).length === presentPlayers.length && presentPlayers.length > 0) {
      setPhase("voting");
      setShowResults(true);
      startTimer(voteTime);
    }
  }, [results, presentPlayers.length, phase, voteTime, startTimer]);

  const vote = useCallback((voteKey: string) => {
    if (!channelRef.current) return;
    
    playVote();
    channelRef.current.send({
      type: "broadcast",
      event: "vote_cast",
      payload: { voteKey, voterId: playerId }
    });
  }, [playerId, playVote]);

  // Calculate scores and handle round end
  const calculateScores = useCallback(() => {
    const newScores = { ...scores };
    const newStreaks = { ...streaks };
    
    Object.values(results).forEach(result => {
      let roundScore = 0;
      const ltr = (result.letter || '').toUpperCase();
      
      for (const idx in result.answers) {
        const i = Number(idx);
        const val = result.answers[i];
        if (!val || !val.trim()) continue;
        
        const key = `${result.playerId}:${i}`;
        const majority = Math.floor(presentPlayers.length / 2) + 1;
        const isDisqualified = (votes[key]?.length || 0) >= majority;
        const startsOk = ltr && val.trimStart().charAt(0).toUpperCase() === ltr;
        
        if (isDisqualified) {
          roundScore -= 1;
        } else if (startsOk) {
          roundScore += 1;
          // Check for alliteration bonus
          const words = val.trim().split(/\s+/);
          const alliterationCount = words.filter(w => w.charAt(0).toUpperCase() === ltr).length;
          if (alliterationCount >= 2) {
            roundScore += 1;
          }
        }
      }
      
      newScores[result.playerId] = (newScores[result.playerId] || 0) + Math.max(0, roundScore);
      
      // Update streaks
      if (roundScore > 0) {
        newStreaks[result.playerId] = (newStreaks[result.playerId] || 0) + 1;
      } else {
        newStreaks[result.playerId] = 0;
      }
    });
    
    setScores(newScores);
    setStreaks(newStreaks);
    
    // Check if game is complete
    if (currentRound >= totalRounds) {
      // Game complete - show final scoreboard
      const playerList = presentPlayers.map(p => ({ id: p.id, name: p.name }));
      const winners = Object.entries(newScores)
        .sort(([,a], [,b]) => b - a)
        .filter(([,score]) => score === Math.max(...Object.values(newScores)))
        .map(([id]) => ({ 
          id, 
          name: playerList.find(p => p.id === id)?.name || "Player",
          total: newScores[id] 
        }));
      
      setFinalSummary({
        totals: newScores,
        winners,
        players: playerList
      });
      setPhase("final");
      setShowFinal(true);
      playWin();
    } else {
      // Next round
      setTimeout(() => {
        setCurrentRound(prev => prev + 1);
        setPhase("lobby");
        setResults({});
        setVotes({});
        setShowResults(false);
      }, 3000);
    }
  }, [scores, streaks, results, votes, presentPlayers, currentRound, totalRounds, playWin]);

  // Force end round (host only)
  const forceEndRound = useCallback(() => {
    if (!isPlayerHost) return;
    
    if (phase === "playing") {
      // Auto-submit current player's answers and transition to voting
      const playerResult: PlayerResult = {
        playerId,
        name: playerName,
        letter,
        answers
      };
      setResults(prev => ({ ...prev, [playerId]: playerResult }));
      
      channelRef.current?.send({
        type: "broadcast",
        event: "force_end_round",
        payload: { phase: "playing" }
      });
    } else if (phase === "voting") {
      setPhase("results");
      setShowResults(false);
      channelRef.current?.send({
        type: "broadcast",
        event: "force_end_round", 
        payload: { phase: "voting" }
      });
    }
  }, [isPlayerHost, phase, playerId, playerName, letter, answers]);

  // Supabase channel setup
  useEffect(() => {
    if (!roomCode || !playerName) return;

    const channel = supabase.channel(roomCode, {
      config: { presence: { key: playerId } }
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const playerList: Player[] = Object.entries(state).map(([id, presences]) => {
          const presence = presences[0] as any;
          return {
            id,
            name: presence.name || "Anonymous",
            present: true
          };
        });
        setPlayers(playerList);
        
        // Set host as first player if not set
        if (!hostId && playerList.length > 0) {
          setHostId(playerList[0].id);
        }
      })
      .on("broadcast", { event: "round_start" }, ({ payload }) => {
        setLetter(payload.letter);
        setCategories(payload.categories);
        setCurrentRound(payload.round);
        setPhase("playing");
        setAnswers({});
        startTimer(roundTime);
        playRoundStart();
      })
      .on("broadcast", { event: "answers_submitted" }, ({ payload }) => {
        setResults(prev => ({ ...prev, [payload.playerId]: payload }));
      })
      .on("broadcast", { event: "force_end_round" }, ({ payload }) => {
        if (payload.phase === "playing") {
          // Auto-submit current answers if not already submitted
          if (!results[playerId]) {
            const playerResult: PlayerResult = {
              playerId,
              name: playerName,
              letter,
              answers
            };
            setResults(prev => ({ ...prev, [playerId]: playerResult }));
          }
        } else if (payload.phase === "voting") {
          setPhase("results");
          setShowResults(false);
        }
      })
      .on("broadcast", { event: "vote_cast" }, ({ payload }) => {
        setVotes(prev => ({
          ...prev,
          [payload.voteKey]: [...(prev[payload.voteKey] || []), payload.voterId]
        }));
      })
      .on("broadcast", { event: "chat_message" }, ({ payload }) => {
        setMessages(prev => [...prev, payload]);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            name: playerName,
            isHost: isHost
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, playerName, playerId, isHost, hostId, startTimer, playRoundStart, results, letter, answers, roundTime]);

  // Timer effects
  useEffect(() => {
    if (timeLeft === 0 && phase === "playing") {
      submitAnswers();
    }
    if (timeLeft === 0 && phase === "voting") {
      setPhase("results");
      setShowResults(false);
      calculateScores();
    }
  }, [timeLeft, phase, submitAnswers, calculateScores]);

  // Handle results phase transition
  useEffect(() => {
    if (phase === "results") {
      const timer = setTimeout(() => {
        calculateScores();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [phase, calculateScores]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (!playerName) {
    return (
      <div className="min-h-screen flex items-center justify-center card-game-bg">
        <Card className="glass-panel">
          <CardContent className="p-6">
            <div className="text-center">Setting up...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{roomCode ? `Room ${roomCode}` : "Solo Game"} — Scattergories Online</title>
        <meta name="description" content="Play Scattergories with friends in real-time multiplayer rooms." />
      </Helmet>

      <div className="relative min-h-screen card-game-bg">
        <Aurora />
        <Particles />
        
        {/* Header */}
        <div className="relative z-10 border-b border-border/20 bg-background/80 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold">
                  {roomCode ? `Room ${roomCode}` : "Solo Game"}
                </h1>
                {roomCode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyRoomCode}
                    className="glass-card hover:scale-105"
                  >
                    {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                    {copied ? "Copied!" : "Copy Code"}
                  </Button>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {/* Sound Toggle */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSoundEnabled(!soundEnabled);
                    localStorage.setItem("soundEnabled", (!soundEnabled).toString());
                  }}
                  className="glass-card hover:scale-105"
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </Button>
                
                {/* Chat Toggle */}
                {roomCode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowChat(!showChat)}
                    className="glass-card hover:scale-105"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </Button>
                )}
                
                {/* Settings */}
                {isPlayerHost && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSettings(!showSettings)}
                    className="glass-card hover:scale-105"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                )}
                
                {/* Leave Room */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/")}
                  className="glass-card hover:scale-105 text-destructive hover:text-destructive"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 container mx-auto px-4 py-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Game Area */}
            <div className="lg:col-span-2 space-y-6">
              {/* Game Status */}
              <Card className="glass-panel">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {phase === "lobby" && <Users className="w-5 h-5 text-primary" />}
                        {phase === "playing" && <Timer className="w-5 h-5 text-green-500" />}
                        {phase === "voting" && <Trophy className="w-5 h-5 text-yellow-500" />}
                        {phase === "results" && <Trophy className="w-5 h-5 text-blue-500" />}
                        
                        {phase === "lobby" && "Waiting to Start"}
                        {phase === "playing" && `Round ${currentRound} - Playing`}
                        {phase === "voting" && `Round ${currentRound} - Voting`}
                        {phase === "results" && `Round ${currentRound} - Results`}
                      </CardTitle>
                      <CardDescription>
                        {phase === "lobby" && "Get ready to play Scattergories!"}
                        {phase === "playing" && `Find words starting with "${letter}" for each category`}
                        {phase === "voting" && "Vote on questionable answers"}
                        {phase === "results" && "Round complete!"}
                      </CardDescription>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {(phase === "playing" || phase === "voting") && (
                        <div className="text-center">
                          <div className="text-4xl font-bold text-primary tabular-nums">{timeLeft}</div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wide">seconds</div>
                        </div>
                      )}
                      
                      {/* Round Progress */}
                      {phase !== "lobby" && (
                        <div className="text-center">
                          <div className="text-2xl font-bold text-muted-foreground">{currentRound}</div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wide">of {totalRounds}</div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  {(phase === "playing" || phase === "voting") && (
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-muted-foreground mb-2">
                        <span>Progress</span>
                        <span>{Math.round(((phase === "playing" ? roundTime : voteTime) - timeLeft) / (phase === "playing" ? roundTime : voteTime) * 100)}%</span>
                      </div>
                      <Progress 
                        value={((phase === "playing" ? roundTime : voteTime) - timeLeft) / (phase === "playing" ? roundTime : voteTime) * 100} 
                        className="h-2"
                      />
                    </div>
                  )}
                </CardHeader>
              </Card>

              {/* Letter Display - Only show during playing phase */}
              {phase === "playing" && letter && (
                <Card className="glass-panel">
                  <CardContent className="py-6">
                    <div className="flex items-center justify-center gap-6">
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground uppercase tracking-wide mb-2">Round Letter</div>
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-4xl font-bold shadow-lg">
                          {letter}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground uppercase tracking-wide mb-2">Categories</div>
                        <div className="text-3xl font-bold text-primary">{categories.length}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Lobby Phase */}
              {phase === "lobby" && (
                <Card className="glass-panel">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Game Setup</CardTitle>
                        <CardDescription>Configure your game settings</CardDescription>
                      </div>
                      {isPlayerHost && (
                        <Button
                          variant="outline"
                          onClick={() => setSelectedList(generateRandomList())}
                          className="glass-card hover:scale-105"
                        >
                          <Shuffle className="w-4 h-4 mr-2" />
                          Random Categories
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Game Settings Display */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-muted/20">
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground">Categories</div>
                        <div className="font-semibold">{selectedList.name}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground">Rounds</div>
                        <div className="font-semibold">{totalRounds}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground">Round Time</div>
                        <div className="font-semibold">{roundTime}s</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground">Vote Time</div>
                        <div className="font-semibold">{voteTime}s</div>
                      </div>
                    </div>
                    
                    {isPlayerHost && (
                      <div className="flex gap-2 justify-center">
                        <Button onClick={startRound} className="glass-card hover:scale-105">
                          <Play className="w-4 h-4 mr-2" />
                          Start Game
                        </Button>
                      </div>
                    )}
                    
                    {!isPlayerHost && (
                      <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                        <Users className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                        <p className="text-sm text-muted-foreground">Waiting for host to start the game...</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Playing Phase */}
              {phase === "playing" && (
                <div className="space-y-6">
                  <Card className="glass-panel">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Answer Categories</CardTitle>
                          <CardDescription>
                            Fill in your answers below
                          </CardDescription>
                        </div>
                        {isPlayerHost && (
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={forceEndRound}
                            className="glass-card hover:scale-105"
                          >
                            Force End Round
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {categories.map((category, index) => (
                          <div key={index} className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                                {index + 1}
                              </span>
                              {category}
                            </label>
                            <Input
                              value={answers[index] || ""}
                              onChange={(e) => setAnswers(prev => ({ ...prev, [index]: e.target.value }))}
                              placeholder={`Something starting with ${letter}...`}
                              className="glass-card"
                            />
                          </div>
                        ))}
                      </div>
                      
                      <div className="mt-6 flex justify-center">
                        <Button onClick={submitAnswers} className="glass-card hover:scale-105 px-8">
                          Submit Answers
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Voting Phase */}
              {phase === "voting" && (
                <Card className="glass-panel">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Voting Phase</CardTitle>
                        <CardDescription>
                          Vote on questionable answers. Results will show automatically.
                        </CardDescription>
                      </div>
                      {isPlayerHost && (
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={forceEndRound}
                          className="glass-card hover:scale-105"
                        >
                          Force End Voting
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <div className="text-lg font-medium mb-2">Reviewing Answers...</div>
                      <div className="text-sm text-muted-foreground">
                        Vote on any answers you think should be disqualified
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Results Phase */}
              {phase === "results" && (
                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle>Round Complete!</CardTitle>
                    <CardDescription>
                      Calculating scores and preparing next round...
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <div className="text-lg font-medium mb-2">Round {currentRound} Results</div>
                      <div className="text-sm text-muted-foreground">
                        {currentRound < totalRounds ? "Next round starting soon..." : "Preparing final results..."}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* Players */}
              <Card className="glass-panel">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Players
                    </CardTitle>
                    <Badge variant="secondary" className="glass-card">
                      {presentPlayers.length}/8
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {presentPlayers.map((player) => (
                    <div key={player.id} className="flex items-center gap-3 p-3 rounded-lg glass-card hover:bg-accent/50 transition-colors">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback style={{ backgroundImage: gradientFromString(player.name), color: "white" }}>
                          {initialsFromName(player.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{player.name}</span>
                          {player.id === hostId && <Crown className="w-4 h-4 text-yellow-500" />}
                          {player.id === playerId && (
                            <Badge variant="outline" className="text-xs px-1 py-0">You</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            {scores[player.id] || 0}
                          </span>
                          {streaks[player.id] > 0 && (
                            <span className="flex items-center gap-1 text-orange-500 font-medium">
                              <Flame className="w-3 h-3" />
                              ×{streaks[player.id]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {roomCode && presentPlayers.length < 8 && (
                    <div className="text-center p-4 border-2 border-dashed border-border/50 rounded-lg bg-muted/20">
                      <UserPlus className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Share room code <strong>{roomCode}</strong> to invite friends
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Game Controls - Only show for host */}
              {isPlayerHost && phase === "lobby" && (
                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      Host Controls
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowSettings(true)}
                      className="w-full glass-card hover:scale-105"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Game Settings
                    </Button>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Room Visibility</span>
                      <Badge variant={isPublic ? "default" : "secondary"} className="glass-card">
                        {isPublic ? "Public" : "Private"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Chat */}
              {roomCode && showChat && (
                <ChatPanel
                  messages={messages}
                  onSend={(text) => {
                    const message: ChatMessage = {
                      id: playerId,
                      name: playerName,
                      text,
                      ts: Date.now()
                    };
                    setMessages(prev => [...prev, message]);
                    channelRef.current?.send({
                      type: "broadcast",
                      event: "chat_message",
                      payload: message
                    });
                  }}
                  currentName={playerName}
                  hostId={hostId}
                  streaks={streaks}
                />
              )}
            </div>
          </div>
        </div>

        {/* Results Overlay */}
        <ResultsOverlay
          open={showResults}
          onClose={() => setShowResults(false)}
          results={results}
          presentCount={presentPlayers.length}
          votes={votes}
          onVote={vote}
          categories={categories}
          localPlayerId={playerId}
          voteTimeLeft={phase === "voting" ? timeLeft : 0}
          players={presentPlayers}
        />

        {/* Final Scoreboard */}
        <FinalScoreboard
          open={showFinal}
          onClose={() => setShowFinal(false)}
          summary={finalSummary}
          isHost={isPlayerHost}
          onPlayAgain={() => {
            setCurrentRound(1);
            setPhase("lobby");
            setShowFinal(false);
            setResults({});
            setVotes({});
            setScores({});
            setStreaks({});
          }}
        />

        {/* Settings Dialog */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent className="glass-panel border-0">
            <DialogHeader>
              <DialogTitle className="text-2xl text-center mb-4">Game Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium mb-2 block">Category List</label>
                  <select
                    value={selectedList.id}
                    onChange={(e) => {
                      const list = CATEGORY_LISTS.find(l => l.id === e.target.value) || CATEGORY_LISTS[0];
                      setSelectedList(list);
                    }}
                    className="w-full p-2 rounded-md border border-input bg-background glass-card"
                    disabled={!isPlayerHost}
                  >
                    {CATEGORY_LISTS.map(list => (
                      <option key={list.id} value={list.id}>{list.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Rounds</label>
                  <select
                    value={totalRounds}
                    onChange={(e) => setTotalRounds(Number(e.target.value))}
                    className="w-full p-2 rounded-md border border-input bg-background glass-card"
                    disabled={!isPlayerHost}
                  >
                    <option value={1}>1 Round</option>
                    <option value={3}>3 Rounds</option>
                    <option value={5}>5 Rounds</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Round Time</label>
                  <select
                    value={roundTime}
                    onChange={(e) => setRoundTime(Number(e.target.value))}
                    className="w-full p-2 rounded-md border border-input bg-background glass-card"
                    disabled={!isPlayerHost}
                  >
                    <option value={30}>30 seconds</option>
                    <option value={60}>60 seconds</option>
                    <option value={90}>90 seconds</option>
                    <option value={120}>2 minutes</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Voting Time</label>
                  <select
                    value={voteTime}
                    onChange={(e) => setVoteTime(Number(e.target.value))}
                    className="w-full p-2 rounded-md border border-input bg-background glass-card"
                    disabled={!isPlayerHost}
                  >
                    <option value={15}>15 seconds</option>
                    <option value={30}>30 seconds</option>
                    <option value={45}>45 seconds</option>
                    <option value={60}>60 seconds</option>
                  </select>
                </div>
              </div>
              
              {!isPlayerHost && (
                <div className="text-center text-sm text-muted-foreground bg-muted/20 p-3 rounded-lg">
                  Only the room host can change game settings
                </div>
              )}
              
              <div className="flex justify-end">
                <Button onClick={() => setShowSettings(false)} className="glass-card hover:scale-105">
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default Game;