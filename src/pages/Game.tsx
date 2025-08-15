import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
  Play,
  Pause,
  RotateCcw,
  Users,
  Crown,
  Settings,
  Clock,
  Trophy,
  Flame,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Copy,
  Check,
  Shuffle,
  List,
  Send,
  UserPlus,
  LogOut,
} from "lucide-react";

// Game constants
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ROUND_TIME = 120; // 2 minutes
const VOTE_TIME = 30; // 30 seconds

// Types
type GamePhase = "lobby" | "playing" | "voting" | "results" | "final";
type Player = { id: string; name: string };

const Game = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roomCode = searchParams.get("room");
  const isMultiplayer = !!roomCode;

  // Player state
  const [playerName, setPlayerName] = useState(() => localStorage.getItem("profileName") || "");
  const [playerId] = useState(() => `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  // Room state
  const [players, setPlayers] = useState<Player[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("Game Room");
  const [isPublic, setIsPublic] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(8);

  // Game state
  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(3);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [letter, setLetter] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedList, setSelectedList] = useState<CategoryList>(CATEGORY_LISTS[0]);

  // Player answers and results
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [results, setResults] = useState<Record<string, PlayerResult>>({});
  const [votes, setVotes] = useState<Record<string, string[]>>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [streaks, setStreaks] = useState<Record<string, number>>({});

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // UI state
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("soundEnabled") !== "false");
  const [showResults, setShowResults] = useState(false);
  const [showFinal, setShowFinal] = useState(false);
  const [finalSummary, setFinalSummary] = useState<FinalSummary | null>(null);
  const [copied, setCopied] = useState(false);

  // Refs
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Hooks
  const { playRoundStart, playVote, playWin } = useGameSounds(soundEnabled);

  // Computed values
  const isHost = hostId === playerId;
  const currentPlayer = players.find(p => p.id === playerId);
  const presentCount = players.length;

  // Public room advertising
  usePublicRoomAdvertiser({
    enabled: isMultiplayer && isHost && isPublic,
    roomCode: roomCode || "",
    payload: {
      name: roomName,
      hostName: currentPlayer?.name,
      maxPlayers,
      createdAtISO: new Date().toISOString(),
    },
    players: players.length,
    inMatch: phase !== "lobby",
  });

  // Initialize room
  useEffect(() => {
    if (!isMultiplayer) {
      setPlayers([{ id: playerId, name: playerName || "You" }]);
      setHostId(playerId);
      return;
    }

    if (!roomCode) {
      navigate("/");
      return;
    }

    const channel = supabase.channel(`game_${roomCode}`, {
      config: { presence: { key: playerId } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const playerList = Object.entries(state).map(([id, presences]) => {
          const p = presences[0] as any;
          return { id, name: p.name || "Player" };
        });
        setPlayers(playerList);

        if (playerList.length > 0 && !hostId) {
          setHostId(playerList[0].id);
        }
      })
      .on("broadcast", { event: "game_state" }, ({ payload }) => {
        const { phase: newPhase, round, letter: newLetter, categories: newCategories, timeLeft: newTimeLeft, results: newResults, votes: newVotes, scores: newScores, streaks: newStreaks, roomName: newRoomName, isPublic: newIsPublic, maxPlayers: newMaxPlayers, totalRounds: newTotalRounds } = payload;
        
        if (newPhase) setPhase(newPhase);
        if (round !== undefined) setCurrentRound(round);
        if (newTotalRounds !== undefined) setTotalRounds(newTotalRounds);
        if (newLetter) setLetter(newLetter);
        if (newCategories) setCategories(newCategories);
        if (newTimeLeft !== undefined) setTimeLeft(newTimeLeft);
        if (newResults) setResults(newResults);
        if (newVotes) setVotes(newVotes);
        if (newScores) setScores(newScores);
        if (newStreaks) setStreaks(newStreaks);
        if (newRoomName) setRoomName(newRoomName);
        if (newIsPublic !== undefined) setIsPublic(newIsPublic);
        if (newMaxPlayers !== undefined) setMaxPlayers(newMaxPlayers);
      })
      .on("broadcast", { event: "chat" }, ({ payload }) => {
        setMessages(prev => [...prev, payload]);
      })
      .on("broadcast", { event: "vote" }, ({ payload }) => {
        setVotes(prev => ({
          ...prev,
          [payload.key]: [...(prev[payload.key] || []), payload.voterId],
        }));
      })
      .on("broadcast", { event: "show_results" }, () => {
        setShowResults(true);
      })
      .on("broadcast", { event: "show_final" }, ({ payload }) => {
        setFinalSummary(payload);
        setShowFinal(true);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            name: playerName || "Player",
            joinedAt: Date.now(),
          });
        }
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [roomCode, playerId, playerName, hostId, isMultiplayer, navigate]);

  // Timer management
  useEffect(() => {
    if (phase === "playing" || phase === "voting") {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (phase === "playing") {
              handleTimeUp();
            } else if (phase === "voting") {
              handleVotingEnd();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [phase]);

  // Game functions
  const broadcastGameState = useCallback((updates: any) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: "broadcast",
      event: "game_state",
      payload: updates,
    });
  }, []);

  const sendChatMessage = useCallback((text: string) => {
    const message: ChatMessage = {
      id: playerId,
      name: currentPlayer?.name || "Player",
      text,
      ts: Date.now(),
    };
    
    if (isMultiplayer && channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "chat",
        payload: message,
      });
    }
    
    setMessages(prev => [...prev, message]);
  }, [playerId, currentPlayer?.name, isMultiplayer]);

  const startRound = useCallback(() => {
    const newLetter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const newCategories = selectedList.id === 'random' 
      ? generateRandomList(12).categories 
      : selectedList.categories;
    
    setPhase("playing");
    setLetter(newLetter);
    setCategories(newCategories);
    setTimeLeft(ROUND_TIME);
    setAnswers({});
    setResults({});
    setVotes({});
    
    if (isMultiplayer) {
      broadcastGameState({
        phase: "playing",
        letter: newLetter,
        categories: newCategories,
        timeLeft: ROUND_TIME,
        round: currentRound,
        totalRounds: totalRounds,
      });
    }
    
    playRoundStart();
  }, [selectedList, currentRound, totalRounds, isMultiplayer, broadcastGameState, playRoundStart]);

  const handleTimeUp = useCallback(() => {
    if (!isMultiplayer) {
      // Solo game - go straight to results
      const playerResult: PlayerResult = {
        playerId,
        name: currentPlayer?.name || "You",
        letter,
        answers,
      };
      setResults({ [playerId]: playerResult });
      setPhase("results");
      setShowResults(true);
      return;
    }

    // Multiplayer - submit answers and wait for voting
    if (channelRef.current) {
      const playerResult: PlayerResult = {
        playerId,
        name: currentPlayer?.name || "Player",
        letter,
        answers,
      };
      
      channelRef.current.send({
        type: "broadcast",
        event: "submit_answers",
        payload: playerResult,
      });
    }
    
    if (isHost) {
      setPhase("voting");
      setTimeLeft(VOTE_TIME);
      broadcastGameState({
        phase: "voting",
        timeLeft: VOTE_TIME,
      });
    }
  }, [isMultiplayer, playerId, currentPlayer?.name, letter, answers, isHost, broadcastGameState]);

  const handleVotingEnd = useCallback(() => {
    if (isHost) {
      // Calculate scores and show results
      setPhase("results");
      broadcastGameState({ phase: "results" });
      
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "show_results",
        });
      }
      
      setShowResults(true);
    }
  }, [isHost, broadcastGameState]);

  const nextRound = useCallback(() => {
    if (currentRound >= totalRounds) {
      // Game over
      const totals = Object.fromEntries(
        players.map(p => [p.id, scores[p.id] || 0])
      );
      const maxScore = Math.max(...Object.values(totals));
      const winners = players.filter(p => totals[p.id] === maxScore);
      
      const summary: FinalSummary = {
        totals,
        winners: winners.map(w => ({ id: w.id, name: w.name, total: totals[w.id] })),
        players,
      };
      
      setFinalSummary(summary);
      setShowFinal(true);
      setPhase("final");
      
      if (isMultiplayer) {
        broadcastGameState({ phase: "final" });
        if (channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "show_final",
            payload: summary,
          });
        }
      }
      
      playWin();
    } else {
      setCurrentRound(prev => prev + 1);
      setShowResults(false);
      startRound();
    }
  }, [currentRound, totalRounds, players, scores, isMultiplayer, broadcastGameState, playWin, startRound]);

  const copyRoomCode = useCallback(() => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Room code copied!", description: `Share ${roomCode} with friends.` });
    }
  }, [roomCode]);

  const leaveRoom = useCallback(() => {
    navigate("/");
  }, [navigate]);

  // Render lobby
  if (phase === "lobby") {
    return (
      <>
        <Helmet>
          <title>{isMultiplayer ? `Room ${roomCode}` : "Solo Game"} — Scattergories Online</title>
        </Helmet>
        
        <div className="relative min-h-screen card-game-bg">
          <Aurora />
          <Particles />
          
          <div className="relative z-10 container mx-auto px-4 py-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold text-black dark:text-white">
                  {isMultiplayer ? `Room ${roomCode}` : "Solo Game"}
                </h1>
                {isMultiplayer && (
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="glass-card hover:scale-105"
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={leaveRoom}
                  className="glass-card hover:scale-105"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Leave
                </Button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Main Game Setup */}
              <div className="lg:col-span-2 space-y-6">
                {/* Room Settings */}
                {isMultiplayer && isHost && (
                  <Card className="glass-panel">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        Room Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Room Name</label>
                          <Input
                            value={roomName}
                            onChange={(e) => setRoomName(e.target.value)}
                            className="glass-card"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Max Players</label>
                          <Select value={maxPlayers.toString()} onValueChange={(v) => setMaxPlayers(Number(v))}>
                            <SelectTrigger className="glass-card">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[4, 6, 8, 10, 12].map(n => (
                                <SelectItem key={n} value={n.toString()}>{n} players</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="public"
                          checked={isPublic}
                          onChange={(e) => setIsPublic(e.target.checked)}
                          className="rounded"
                        />
                        <label htmlFor="public" className="text-sm">
                          Make room public (visible in lobby)
                        </label>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Game Configuration */}
                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <List className="w-5 h-5" />
                      Game Setup
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Category List</label>
                        <Select
                          value={selectedList.id}
                          onValueChange={(id) => {
                            const list = CATEGORY_LISTS.find(l => l.id === id) || CATEGORY_LISTS[0];
                            setSelectedList(list);
                          }}
                          disabled={!isHost && isMultiplayer}
                        >
                          <SelectTrigger className="glass-card">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORY_LISTS.map(list => (
                              <SelectItem key={list.id} value={list.id}>
                                {list.name}
                              </SelectItem>
                            ))}
                            <SelectItem value="random">
                              <div className="flex items-center gap-2">
                                <Shuffle className="w-4 h-4" />
                                Random Mix
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Rounds</label>
                        <Select
                          value={totalRounds.toString()}
                          onValueChange={(v) => setTotalRounds(Number(v))}
                          disabled={!isHost && isMultiplayer}
                        >
                          <SelectTrigger className="glass-card">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map(n => (
                              <SelectItem key={n} value={n.toString()}>
                                {n} round{n > 1 ? 's' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Category Preview */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Categories Preview</label>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                        {selectedList.categories.slice(0, 12).map((cat, i) => (
                          <div key={i} className="p-2 rounded glass-card text-center">
                            {i + 1}. {cat}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Start Button */}
                    {(!isMultiplayer || isHost) && (
                      <Button
                        onClick={startRound}
                       disabled={isMultiplayer && players.length < 1}
                        className="w-full glass-card hover:scale-105 h-12 text-lg"
                      >
                        <Play className="w-5 h-5 mr-2" />
                        Start Game
                      </Button>
                    )}
                    
                    {isMultiplayer && !isHost && (
                      <div className="text-center text-muted-foreground">
                        Waiting for host to start the game...
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Players */}
                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Players ({players.length}{isMultiplayer ? `/${maxPlayers}` : ''})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {players.map((player) => (
                      <div key={player.id} className="flex items-center gap-3 p-2 rounded glass-card">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback
                            style={{ backgroundImage: gradientFromString(player.name), color: "white" }}
                          >
                            {initialsFromName(player.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {player.name}
                            {player.id === playerId && " (You)"}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {player.id === hostId && (
                              <Badge variant="secondary" className="text-xs">
                                <Crown className="w-3 h-3 mr-1" />
                                Host
                              </Badge>
                            )}
                            {streaks[player.id] > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <Flame className="w-3 h-3 mr-1" />
                                {streaks[player.id]}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-sm font-medium">
                          {scores[player.id] || 0} pts
                        </div>
                      </div>
                    ))}
                    
                    {isMultiplayer && players.length < maxPlayers && (
                      <div className="text-center text-muted-foreground text-sm p-4 border-2 border-dashed border-muted rounded-lg">
                        <UserPlus className="w-6 h-6 mx-auto mb-2 opacity-50" />
                        Waiting for more players...
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Chat */}
                {isMultiplayer && (
                  <ChatPanel
                    messages={messages}
                    onSend={sendChatMessage}
                    currentName={currentPlayer?.name || "Player"}
                    hostId={hostId}
                    leaderId={null}
                    streaks={streaks}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Render game phases
  return (
    <>
      <Helmet>
        <title>
          {phase === "playing" ? `Round ${currentRound}` : 
           phase === "voting" ? "Voting" : 
           phase === "results" ? "Results" : "Game"} — Scattergories Online
        </title>
      </Helmet>
      
      <div className="relative min-h-screen card-game-bg">
        <Aurora />
        <Particles />
        
        <div className="relative z-10 container mx-auto px-4 py-6">
          {/* Game Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-black dark:text-white">
                Round {currentRound} of {totalRounds}
              </h1>
              {letter && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Letter:</span>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {letter}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              {/* Timer */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg glass-card">
                <Clock className="w-4 h-4" />
                <span className="font-mono text-lg">
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </span>
              </div>
              
              {/* Phase indicator */}
              <Badge variant={phase === "playing" ? "default" : "secondary"} className="glass-card">
                {phase === "playing" ? "Playing" : 
                 phase === "voting" ? "Voting" : 
                 phase === "results" ? "Results" : "Game"}
              </Badge>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Game Area */}
            <div className="lg:col-span-2">
              {phase === "playing" && (
                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle>Your Answers</CardTitle>
                    <CardDescription>
                      Fill in answers that start with "{letter}" for each category
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4">
                      {categories.map((category, index) => (
                        <div key={index} className="space-y-2">
                          <label className="text-sm font-medium">
                            {index + 1}. {category}
                          </label>
                          <Input
                            value={answers[index] || ""}
                            onChange={(e) => setAnswers(prev => ({ ...prev, [index]: e.target.value }))}
                            placeholder={`Something that starts with "${letter}"`}
                            className="glass-card"
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {phase === "voting" && (
                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle>Voting Phase</CardTitle>
                    <CardDescription>
                      Vote out answers that don't fit the category or letter
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center text-muted-foreground">
                      Review other players' answers and vote on questionable entries...
                    </div>
                  </CardContent>
                </Card>
              )}

              {phase === "results" && !showResults && (
                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle>Round Complete!</CardTitle>
                    <CardDescription>
                      Calculating scores and preparing results...
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                      <p className="text-muted-foreground">Processing results...</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Players */}
              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Players
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {players.map((player) => (
                    <div key={player.id} className="flex items-center gap-3 p-2 rounded glass-card">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback
                          style={{ backgroundImage: gradientFromString(player.name), color: "white" }}
                        >
                          {initialsFromName(player.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {player.name}
                          {player.id === playerId && " (You)"}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {player.id === hostId && (
                            <Badge variant="secondary" className="text-xs">
                              <Crown className="w-3 h-3 mr-1" />
                              Host
                            </Badge>
                          )}
                          {streaks[player.id] > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <Flame className="w-3 h-3 mr-1" />
                              {streaks[player.id]}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-sm font-medium">
                        {scores[player.id] || 0} pts
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Chat */}
              {isMultiplayer && (
                <ChatPanel
                  messages={messages}
                  onSend={sendChatMessage}
                  currentName={currentPlayer?.name || "Player"}
                  hostId={hostId}
                  leaderId={null}
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
          presentCount={presentCount}
          votes={votes}
          onVote={(key) => {
            if (channelRef.current) {
              channelRef.current.send({
                type: "broadcast",
                event: "vote",
                payload: { key, voterId: playerId },
              });
            }
            playVote();
          }}
          categories={categories}
          localPlayerId={playerId}
          voteTimeLeft={timeLeft}
          players={players}
        />

        {/* Final Scoreboard */}
        <FinalScoreboard
          open={showFinal}
          onClose={() => setShowFinal(false)}
          summary={finalSummary}
          isHost={isHost}
          onPlayAgain={() => {
            setShowFinal(false);
            setCurrentRound(1);
            setPhase("lobby");
            setScores({});
            setStreaks({});
            if (isMultiplayer) {
              broadcastGameState({
                phase: "lobby",
                round: 1,
                scores: {},
                streaks: {},
              });
            }
          }}
        />
      </div>
    </>
  );
};

export default Game;