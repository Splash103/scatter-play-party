import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { gradientFromString, initialsFromName } from "@/lib/gradient";
import { ChatPanel, type ChatMessage } from "@/components/ChatPanel";
import { ResultsOverlay, type PlayerResult } from "@/components/ResultsOverlay";
import { FinalScoreboard, type FinalSummary } from "@/components/FinalScoreboard";
import { CATEGORY_LISTS, generateRandomList, type CategoryList } from "@/data/categoryLists";
import { useGameSounds } from "@/hooks/use-sound";
import { usePublicRoomAdvertiser } from "@/hooks/usePublicRoomAdvertiser";
import BackButton from "@/components/BackButton";
import Aurora from "@/components/Aurora";
import Particles from "@/components/Particles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  Users,
  Play,
  Pause,
  RotateCcw,
  Settings,
  Crown,
  Flame,
  Trophy,
  Volume2,
  VolumeX,
  Shuffle,
  List,
  Zap,
} from "lucide-react";

// Types
type GamePhase = "lobby" | "playing" | "results" | "final";
type Player = { id: string; name: string; present: boolean };
type GameState = {
  phase: GamePhase;
  letter: string | null;
  categories: string[];
  timeLeft: number;
  roundNumber: number;
  maxRounds: number;
  results: Record<string, PlayerResult>;
  votes: Record<string, string[]>;
  voteTimeLeft: number;
  scores: Record<string, number>;
  winners: string[];
};

// Constants
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DEFAULT_ROUND_TIME = 90;
const DEFAULT_VOTE_TIME = 30;
const DEFAULT_MAX_ROUNDS = 3;

const Game = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roomCode = searchParams.get("room");
  const isMultiplayer = !!roomCode;

  // Core state
  const [gameState, setGameState] = useState<GameState>({
    phase: "lobby",
    letter: null,
    categories: [],
    timeLeft: DEFAULT_ROUND_TIME,
    roundNumber: 0,
    maxRounds: DEFAULT_MAX_ROUNDS,
    results: {},
    votes: {},
    voteTimeLeft: DEFAULT_VOTE_TIME,
    scores: {},
    winners: [],
  });

  // UI state
  const [playerName, setPlayerName] = useState(() => localStorage.getItem("profileName") || "");
  const [players, setPlayers] = useState<Player[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const [localPlayerId] = useState(() => `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showFinalScoreboard, setShowFinalScoreboard] = useState(false);
  const [finalSummary, setFinalSummary] = useState<FinalSummary | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("soundEnabled") !== "false");
  const [selectedCategoryList, setSelectedCategoryList] = useState<CategoryList>(CATEGORY_LISTS[0]);
  const [roundTime, setRoundTime] = useState(DEFAULT_ROUND_TIME);
  const [voteTime, setVoteTime] = useState(DEFAULT_VOTE_TIME);
  const [maxRounds, setMaxRounds] = useState(DEFAULT_MAX_ROUNDS);
  const [roomName, setRoomName] = useState("");

  // Refs
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const gameTimerRef = useRef<NodeJS.Timeout | null>(null);
  const voteTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Hooks
  const { playRoundStart, playVote, playWin } = useGameSounds(soundEnabled);

  // Computed values
  const isHost = hostId === localPlayerId;
  const currentPlayer = players.find(p => p.id === localPlayerId);
  const presentPlayers = players.filter(p => p.present);
  const presentCount = presentPlayers.length;

  // Room advertising for public lobby
  usePublicRoomAdvertiser({
    enabled: isMultiplayer && isHost,
    roomCode: roomCode || "",
    payload: {
      name: roomName || `${roomCode} Room`,
      hostName: playerName || "Host",
      maxPlayers: 8,
      createdAtISO: new Date().toISOString(),
    },
    players: presentCount,
    inMatch: gameState.phase !== "lobby",
  });

  // Initialize room
  useEffect(() => {
    if (!playerName.trim()) {
      const randomName = `Player${Math.floor(Math.random() * 1000)}`;
      setPlayerName(randomName);
      localStorage.setItem("profileName", randomName);
    }

    if (isMultiplayer && roomCode) {
      initializeMultiplayerRoom();
      setRoomName(`${roomCode} Room`);
    } else {
      // Solo mode
      setPlayers([{ id: localPlayerId, name: playerName, present: true }]);
      setHostId(localPlayerId);
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
      if (voteTimerRef.current) clearInterval(voteTimerRef.current);
    };
  }, [roomCode, isMultiplayer]);

  const initializeMultiplayerRoom = useCallback(() => {
    if (!roomCode) return;

    const channel = supabase.channel(`game_${roomCode}`, {
      config: { presence: { key: localPlayerId } }
    });

    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const playerList: Player[] = Object.entries(state).map(([id, presences]) => {
          const presence = presences[0] as any;
          return {
            id,
            name: presence.name || "Player",
            present: true,
          };
        });
        setPlayers(playerList);

        // Set host as first player to join
        if (playerList.length > 0 && !hostId) {
          setHostId(playerList[0].id);
        }
      })
      .on("broadcast", { event: "game_state" }, ({ payload }) => {
        setGameState(payload);
      })
      .on("broadcast", { event: "chat_message" }, ({ payload }) => {
        setChatMessages(prev => [...prev, payload]);
      })
      .on("broadcast", { event: "player_answers" }, ({ payload }) => {
        setGameState(prev => ({
          ...prev,
          results: { ...prev.results, [payload.playerId]: payload.result }
        }));
      })
      .on("broadcast", { event: "vote" }, ({ payload }) => {
        setGameState(prev => ({
          ...prev,
          votes: { ...prev.votes, [payload.key]: payload.voterIds }
        }));
      })
      .on("broadcast", { event: "room_settings" }, ({ payload }) => {
        setRoundTime(payload.roundTime);
        setVoteTime(payload.voteTime);
        setMaxRounds(payload.maxRounds);
        setSelectedCategoryList(payload.categoryList);
        setRoomName(payload.roomName);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            name: playerName,
            joinedAt: Date.now(),
          });
        }
      });
  }, [roomCode, localPlayerId, playerName, hostId]);

  // Game timer
  useEffect(() => {
    if (gameState.phase === "playing" && gameState.timeLeft > 0) {
      gameTimerRef.current = setInterval(() => {
        setGameState(prev => {
          const newTimeLeft = prev.timeLeft - 1;
          if (newTimeLeft <= 0) {
            // Time's up - submit answers and move to results
            submitAnswers();
            return { ...prev, timeLeft: 0, phase: "results", voteTimeLeft: voteTime };
          }
          return { ...prev, timeLeft: newTimeLeft };
        });
      }, 1000);
    } else if (gameTimerRef.current) {
      clearInterval(gameTimerRef.current);
      gameTimerRef.current = null;
    }

    return () => {
      if (gameTimerRef.current) {
        clearInterval(gameTimerRef.current);
        gameTimerRef.current = null;
      }
    };
  }, [gameState.phase, gameState.timeLeft]);

  // Vote timer
  useEffect(() => {
    if (gameState.phase === "results" && gameState.voteTimeLeft > 0) {
      voteTimerRef.current = setInterval(() => {
        setGameState(prev => {
          const newVoteTimeLeft = prev.voteTimeLeft - 1;
          if (newVoteTimeLeft <= 0) {
            // Voting time's up
            if (isHost) {
              endRound();
            }
            return { ...prev, voteTimeLeft: 0 };
          }
          return { ...prev, voteTimeLeft: newVoteTimeLeft };
        });
      }, 1000);
    } else if (voteTimerRef.current) {
      clearInterval(voteTimerRef.current);
      voteTimerRef.current = null;
    }

    return () => {
      if (voteTimerRef.current) {
        clearInterval(voteTimerRef.current);
        voteTimerRef.current = null;
      }
    };
  }, [gameState.phase, gameState.voteTimeLeft, isHost]);

  // Show results overlay
  useEffect(() => {
    if (gameState.phase === "results") {
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  }, [gameState.phase]);

  const broadcastGameState = useCallback((newState: GameState) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "game_state",
        payload: newState,
      });
    }
  }, []);

  const broadcastRoomSettings = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "room_settings",
        payload: {
          roundTime,
          voteTime,
          maxRounds,
          categoryList: selectedCategoryList,
          roomName,
        },
      });
    }
  }, [roundTime, voteTime, maxRounds, selectedCategoryList, roomName]);

  const sendChatMessage = useCallback((text: string) => {
    const message: ChatMessage = {
      id: localPlayerId,
      name: playerName,
      text,
      ts: Date.now(),
    };

    setChatMessages(prev => [...prev, message]);

    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "chat_message",
        payload: message,
      });
    }
  }, [localPlayerId, playerName]);

  const startRound = useCallback(() => {
    if (!isHost) return;

    const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const categories = selectedCategoryList.categories.slice(0, 12);

    const newState: GameState = {
      ...gameState,
      phase: "playing",
      letter,
      categories,
      timeLeft: roundTime,
      roundNumber: gameState.roundNumber + 1,
      maxRounds,
      results: {},
      votes: {},
      voteTimeLeft: voteTime,
    };

    setGameState(newState);
    setAnswers({});
    
    if (isMultiplayer) {
      broadcastGameState(newState);
    }

    playRoundStart();
  }, [isHost, gameState, selectedCategoryList, roundTime, maxRounds, voteTime, isMultiplayer, broadcastGameState, playRoundStart]);

  const submitAnswers = useCallback(() => {
    const result: PlayerResult = {
      playerId: localPlayerId,
      name: playerName,
      letter: gameState.letter,
      answers,
    };

    setGameState(prev => ({
      ...prev,
      results: { ...prev.results, [localPlayerId]: result }
    }));

    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "player_answers",
        payload: { playerId: localPlayerId, result },
      });
    }
  }, [localPlayerId, playerName, gameState.letter, answers]);

  const vote = useCallback((voteKey: string) => {
    const currentVotes = gameState.votes[voteKey] || [];
    const hasVoted = currentVotes.includes(localPlayerId);
    
    let newVoterIds: string[];
    if (hasVoted) {
      newVoterIds = currentVotes.filter(id => id !== localPlayerId);
    } else {
      newVoterIds = [...currentVotes, localPlayerId];
    }

    setGameState(prev => ({
      ...prev,
      votes: { ...prev.votes, [voteKey]: newVoterIds }
    }));

    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "vote",
        payload: { key: voteKey, voterIds: newVoterIds },
      });
    }

    playVote();
  }, [gameState.votes, localPlayerId, playVote]);

  const endRound = useCallback(() => {
    if (!isHost) return;

    // Calculate scores
    const newScores = { ...gameState.scores };
    const majority = Math.floor(presentCount / 2) + 1;

    Object.values(gameState.results).forEach(result => {
      const playerId = result.playerId;
      let roundScore = 0;
      const letter = (result.letter || '').toUpperCase();

      // Count duplicates
      const countsByIdx: Record<number, Record<string, number>> = {};
      Object.values(gameState.results).forEach(r => {
        const ltr = (r.letter || '').toUpperCase();
        Object.entries(r.answers || {}).forEach(([idxStr, val]) => {
          const idx = Number(idxStr);
          if (!val || !ltr || val.trimStart().charAt(0).toUpperCase() !== ltr) return;
          const norm = (val || "").toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
          countsByIdx[idx] = countsByIdx[idx] || {};
          countsByIdx[idx][norm] = (countsByIdx[idx][norm] || 0) + 1;
        });
      });

      // Score each answer
      Object.entries(result.answers || {}).forEach(([idxStr, val]) => {
        const idx = Number(idxStr);
        if (!val || !val.trim()) return;

        const key = `${playerId}:${idx}`;
        const isDisqualified = (gameState.votes[key]?.length || 0) >= majority;
        const startsCorrect = letter && val.trimStart().charAt(0).toUpperCase() === letter;

        if (isDisqualified) {
          roundScore -= 1;
        } else if (startsCorrect) {
          const norm = (val || "").toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
          const isDuplicate = (countsByIdx[idx]?.[norm] || 0) > 1;
          
          if (!isDuplicate) {
            roundScore += 1;
            // Alliteration bonus
            const words = val.trim().split(/\s+/);
            const alliterationCount = words.filter(w => w.charAt(0).toUpperCase() === letter).length;
            if (alliterationCount >= 2) {
              roundScore += 1;
            }
          }
        }
      });

      newScores[playerId] = (newScores[playerId] || 0) + roundScore;
    });

    // Check if game is over
    const isGameOver = gameState.roundNumber >= gameState.maxRounds;
    
    if (isGameOver) {
      // Calculate winners
      const maxScore = Math.max(...Object.values(newScores));
      const winners = Object.entries(newScores)
        .filter(([_, score]) => score === maxScore)
        .map(([playerId]) => playerId);

      const finalSummary: FinalSummary = {
        totals: newScores,
        winners: winners.map(id => ({
          id,
          name: players.find(p => p.id === id)?.name || "Player",
          total: newScores[id],
        })),
        players: players.map(p => ({ id: p.id, name: p.name })),
      };

      setFinalSummary(finalSummary);
      setShowFinalScoreboard(true);

      // Save to leaderboard for winners
      winners.forEach(winnerId => {
        const winnerName = players.find(p => p.id === winnerId)?.name || "Player";
        saveToLeaderboard(winnerName);
      });

      const newState: GameState = {
        ...gameState,
        phase: "final",
        scores: newScores,
        winners,
      };

      setGameState(newState);
      if (isMultiplayer) {
        broadcastGameState(newState);
      }

      playWin();
    } else {
      // Continue to next round
      const newState: GameState = {
        ...gameState,
        phase: "lobby",
        scores: newScores,
        results: {},
        votes: {},
      };

      setGameState(newState);
      if (isMultiplayer) {
        broadcastGameState(newState);
      }
    }
  }, [isHost, gameState, presentCount, players, isMultiplayer, broadcastGameState, playWin]);

  const saveToLeaderboard = useCallback((winnerName: string) => {
    try {
      const existing = localStorage.getItem("leaderboard");
      const entries = existing ? JSON.parse(existing) : [];
      entries.push({ name: winnerName, wins: 1 });
      localStorage.setItem("leaderboard", JSON.stringify(entries));
    } catch (error) {
      console.error("Failed to save to leaderboard:", error);
    }
  }, []);

  const resetGame = useCallback(() => {
    if (!isHost) return;

    const newState: GameState = {
      phase: "lobby",
      letter: null,
      categories: [],
      timeLeft: roundTime,
      roundNumber: 0,
      maxRounds,
      results: {},
      votes: {},
      voteTimeLeft: voteTime,
      scores: {},
      winners: [],
    };

    setGameState(newState);
    setAnswers({});
    setShowResults(false);
    setShowFinalScoreboard(false);
    setFinalSummary(null);

    if (isMultiplayer) {
      broadcastGameState(newState);
    }
  }, [isHost, roundTime, maxRounds, voteTime, isMultiplayer, broadcastGameState]);

  const toggleSound = useCallback(() => {
    const newSoundEnabled = !soundEnabled;
    setSoundEnabled(newSoundEnabled);
    localStorage.setItem("soundEnabled", newSoundEnabled.toString());
  }, [soundEnabled]);

  // Memoized values
  const streaks = useMemo(() => {
    const result: Record<string, number> = {};
    // This would typically come from a more sophisticated tracking system
    return result;
  }, []);

  const leaderId = useMemo(() => {
    if (Object.keys(gameState.scores).length === 0) return null;
    const maxScore = Math.max(...Object.values(gameState.scores));
    return Object.entries(gameState.scores).find(([_, score]) => score === maxScore)?.[0] || null;
  }, [gameState.scores]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <Helmet>
        <title>
          {isMultiplayer 
            ? `Room ${roomCode} — Scattergories Online`
            : "Solo Game — Scattergories Online"
          }
        </title>
        <meta 
          name="description" 
          content={
            isMultiplayer 
              ? `Playing Scattergories in room ${roomCode}. Join the fun!`
              : "Playing Scattergories solo. Test your creativity!"
          } 
        />
      </Helmet>

      <div className="relative min-h-screen card-game-bg">
        <Aurora />
        <Particles />
        <BackButton />
        
        <div className="relative z-10 container mx-auto p-4 max-w-7xl">
          <div className="rounded-lg border bg-card shadow-sm p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {isMultiplayer && (
                    <Badge variant="outline" className="font-mono text-lg px-3 py-1">
                      {roomCode}
                    </Badge>
                  )}
                  <h1 className="text-2xl font-bold">
                    {isMultiplayer ? (roomName || `Room ${roomCode}`) : "Solo Game"}
                  </h1>
                </div>
                {gameState.phase !== "lobby" && (
                  <Badge variant="secondary">
                    Round {gameState.roundNumber}/{gameState.maxRounds}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSound}
                  className="glass-card hover:scale-105"
                >
                  {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </Button>
                {isHost && gameState.phase === "lobby" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedCategoryList(generateRandomList())}
                    className="glass-card hover:scale-105"
                  >
                    <Shuffle className="h-4 w-4 mr-2" />
                    Random
                  </Button>
                )}
              </div>
            </div>

            {/* Game Content */}
            <div className="grid gap-6 lg:grid-cols-4">
              {/* Main Game Area */}
              <div className="lg:col-span-3 space-y-6">
                {gameState.phase === "lobby" && (
                  <div className="space-y-6">
                    {/* Game Settings (Host Only) */}
                    {isHost && (
                      <Card className="glass-card">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Settings className="h-5 w-5" />
                            Game Settings
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                              <label className="text-sm font-medium mb-2 block">Round Time</label>
                              <Select value={roundTime.toString()} onValueChange={(v) => setRoundTime(Number(v))}>
                                <SelectTrigger className="glass-card">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="60">1 minute</SelectItem>
                                  <SelectItem value="90">1.5 minutes</SelectItem>
                                  <SelectItem value="120">2 minutes</SelectItem>
                                  <SelectItem value="180">3 minutes</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-sm font-medium mb-2 block">Vote Time</label>
                              <Select value={voteTime.toString()} onValueChange={(v) => setVoteTime(Number(v))}>
                                <SelectTrigger className="glass-card">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="15">15 seconds</SelectItem>
                                  <SelectItem value="30">30 seconds</SelectItem>
                                  <SelectItem value="45">45 seconds</SelectItem>
                                  <SelectItem value="60">1 minute</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-sm font-medium mb-2 block">Max Rounds</label>
                              <Select value={maxRounds.toString()} onValueChange={(v) => setMaxRounds(Number(v))}>
                                <SelectTrigger className="glass-card">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">1 round</SelectItem>
                                  <SelectItem value="3">3 rounds</SelectItem>
                                  <SelectItem value="5">5 rounds</SelectItem>
                                  <SelectItem value="10">10 rounds</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-sm font-medium mb-2 block">Categories</label>
                              <Select 
                                value={selectedCategoryList.id} 
                                onValueChange={(v) => {
                                  const list = CATEGORY_LISTS.find(l => l.id === v) || CATEGORY_LISTS[0];
                                  setSelectedCategoryList(list);
                                }}
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
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          {isMultiplayer && (
                            <div>
                              <label className="text-sm font-medium mb-2 block">Room Name</label>
                              <Input
                                value={roomName}
                                onChange={(e) => setRoomName(e.target.value)}
                                placeholder={`${roomCode} Room`}
                                className="glass-card"
                              />
                            </div>
                          )}
                          <Button onClick={broadcastRoomSettings} variant="outline" size="sm" className="glass-card hover:scale-105">
                            Update Settings
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    {/* Category Preview */}
                    <Card className="glass-card">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <List className="h-5 w-5" />
                          Categories: {selectedCategoryList.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {selectedCategoryList.categories.slice(0, 12).map((category, idx) => (
                            <div key={idx} className="text-sm p-2 rounded bg-muted/50">
                              {idx + 1}. {category}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Start Game Button */}
                    {isHost && (
                      <div className="text-center">
                        <Button 
                          onClick={startRound} 
                          size="lg" 
                          className="glass-card hover:scale-105 text-lg px-8 py-4"
                        >
                          <Play className="h-5 w-5 mr-2" />
                          Start Round {gameState.roundNumber + 1}
                        </Button>
                      </div>
                    )}

                    {!isHost && (
                      <div className="text-center text-muted-foreground">
                        <Crown className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Waiting for host to start the game...</p>
                      </div>
                    )}
                  </div>
                )}

                {gameState.phase === "playing" && (
                  <div className="space-y-6">
                    {/* Game Header */}
                    <Card className="glass-card">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <div className="text-sm text-muted-foreground">Letter</div>
                              <div className="text-4xl font-bold text-primary">
                                {gameState.letter}
                              </div>
                            </div>
                            <Separator orientation="vertical" className="h-12" />
                            <div className="text-center">
                              <div className="text-sm text-muted-foreground">Time Left</div>
                              <div className="text-2xl font-bold">
                                {formatTime(gameState.timeLeft)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Round</div>
                            <div className="text-xl font-bold">
                              {gameState.roundNumber}/{gameState.maxRounds}
                            </div>
                          </div>
                        </div>
                        <div className="mt-4">
                          <Progress 
                            value={(gameState.timeLeft / roundTime) * 100} 
                            className="h-2"
                          />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Answer Form */}
                    <Card className="glass-card">
                      <CardHeader>
                        <CardTitle>Your Answers</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4">
                          {gameState.categories.map((category, idx) => (
                            <div key={idx} className="space-y-2">
                              <label className="text-sm font-medium">
                                {idx + 1}. {category}
                              </label>
                              <Input
                                value={answers[idx] || ""}
                                onChange={(e) => setAnswers(prev => ({ ...prev, [idx]: e.target.value }))}
                                placeholder={`Something that starts with ${gameState.letter}...`}
                                className="glass-card"
                              />
                            </div>
                          ))}
                        </div>
                        <div className="mt-6 text-center">
                          <Button 
                            onClick={submitAnswers}
                            className="glass-card hover:scale-105"
                          >
                            <Zap className="h-4 w-4 mr-2" />
                            Submit Answers
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {gameState.phase === "final" && (
                  <Card className="glass-card text-center">
                    <CardContent className="py-12">
                      <Trophy className="h-16 w-16 mx-auto mb-4 text-yellow-500" />
                      <h2 className="text-3xl font-bold mb-4">Game Complete!</h2>
                      <p className="text-muted-foreground mb-6">
                        {gameState.winners.length === 1 
                          ? `${players.find(p => p.id === gameState.winners[0])?.name} wins!`
                          : "It's a tie!"
                        }
                      </p>
                      {isHost && (
                        <div className="flex gap-4 justify-center">
                          <Button onClick={resetGame} className="glass-card hover:scale-105">
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Play Again
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Players */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Players ({presentCount})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {presentPlayers.map(player => (
                      <div key={player.id} className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback style={{ backgroundImage: gradientFromString(player.name), color: "white" }}>
                            {initialsFromName(player.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {hostId === player.id && <Crown className="h-4 w-4 text-primary" />}
                            {leaderId === player.id && <Trophy className="h-4 w-4 text-yellow-500" />}
                            <span className="font-medium truncate">
                              {player.id === localPlayerId ? "You" : player.name}
                            </span>
                            {streaks[player.id] > 0 && (
                              <div className="flex items-center gap-1 text-xs text-primary">
                                <Flame className="h-3 w-3" />
                                {streaks[player.id]}
                              </div>
                            )}
                          </div>
                          {gameState.scores[player.id] !== undefined && (
                            <div className="text-sm text-muted-foreground">
                              {gameState.scores[player.id]} points
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Chat */}
                {isMultiplayer && (
                  <ChatPanel
                    messages={chatMessages}
                    onSend={sendChatMessage}
                    currentName={playerName}
                    hostId={hostId}
                    leaderId={leaderId}
                    streaks={streaks}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Results Overlay */}
        <ResultsOverlay
          open={showResults}
          onClose={() => setShowResults(false)}
          results={gameState.results}
          presentCount={presentCount}
          votes={gameState.votes}
          onVote={vote}
          categories={gameState.categories}
          localPlayerId={localPlayerId}
          voteTimeLeft={gameState.voteTimeLeft}
          players={players}
        />

        {/* Final Scoreboard */}
        <FinalScoreboard
          open={showFinalScoreboard}
          onClose={() => setShowFinalScoreboard(false)}
          summary={finalSummary}
          isHost={isHost}
          onPlayAgain={resetGame}
        />
      </div>
    </>
  );
};

export default Game;