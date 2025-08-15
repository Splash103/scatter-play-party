import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { gradientFromString, initialsFromName } from "@/lib/gradient";
import { CATEGORY_LISTS, generateRandomList, type CategoryList } from "@/data/categoryLists";
import { ChatPanel, type ChatMessage } from "@/components/ChatPanel";
import { ResultsOverlay, type PlayerResult } from "@/components/ResultsOverlay";
import { FinalScoreboard, type FinalSummary } from "@/components/FinalScoreboard";
import { usePublicRoomAdvertiser } from "@/hooks/usePublicRoomAdvertiser";
import { useGameSounds } from "@/hooks/use-sound";
import { supabase } from "@/integrations/supabase/client";
import Aurora from "@/components/Aurora";
import Particles from "@/components/Particles";
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
  Copy,
  Check,
  Shuffle,
  List,
  Home,
} from "lucide-react";

// Game constants
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ROUND_TIME = 90; // seconds
const VOTE_TIME = 30; // seconds

// Game state types
type GamePhase = "lobby" | "playing" | "voting" | "results" | "final";
type Player = { id: string; name: string; isHost?: boolean };

const Game = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomCode = searchParams.get("room");
  const isMultiplayer = !!roomCode;

  // Player state
  const [localPlayerId] = useState(() => `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const [localPlayerName, setLocalPlayerName] = useState(() => localStorage.getItem("profileName") || "");
  const [players, setPlayers] = useState<Player[]>([]);
  const [isHost, setIsHost] = useState(!isMultiplayer);

  // Game state
  const [gamePhase, setGamePhase] = useState<GamePhase>("lobby");
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(3);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [currentLetter, setCurrentLetter] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedList, setSelectedList] = useState<CategoryList>(CATEGORY_LISTS[0]);

  // Player answers and results
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [allResults, setAllResults] = useState<Record<string, PlayerResult>>({});
  const [votes, setVotes] = useState<Record<string, string[]>>({});
  const [roundScores, setRoundScores] = useState<Record<string, number[]>>({});

  // UI state
  const [showResults, setShowResults] = useState(false);
  const [showFinalScoreboard, setShowFinalScoreboard] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("soundEnabled") !== "false");
  const [codeCopied, setCodeCopied] = useState(false);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Refs
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Hooks
  const { playRoundStart, playVote, playWin } = useGameSounds(soundEnabled);

  // Room advertising for multiplayer
  usePublicRoomAdvertiser({
    enabled: isMultiplayer && isHost,
    roomCode: roomCode || "",
    payload: {
      name: `${localPlayerName || "Anonymous"}'s Room`,
      hostName: localPlayerName || "Anonymous",
      maxPlayers: 8,
      createdAtISO: new Date().toISOString(),
    },
    players: players.length,
    inMatch: gamePhase !== "lobby",
  });

  // Initialize player name
  useEffect(() => {
    if (!localPlayerName) {
      const name = prompt("Enter your name:") || "Anonymous";
      setLocalPlayerName(name);
      localStorage.setItem("profileName", name);
    }
  }, [localPlayerName]);

  // Multiplayer setup
  useEffect(() => {
    if (!isMultiplayer || !roomCode || !localPlayerName) return;

    const channel = supabase.channel(roomCode);
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const playerList = Object.entries(state).map(([id, presences]) => {
          const p = presences[0] as any;
          return { id, name: p.name, isHost: p.isHost };
        });
        setPlayers(playerList);

        // Determine if current player is host
        const currentPlayer = playerList.find(p => p.id === localPlayerId);
        setIsHost(currentPlayer?.isHost || playerList.length === 1);
      })
      .on("broadcast", { event: "game_state" }, ({ payload }) => {
        const { phase, round, timeLeft: time, letter, categories: cats, totalRounds: total } = payload;
        setGamePhase(phase);
        setCurrentRound(round);
        setTimeLeft(time);
        setCurrentLetter(letter);
        setCategories(cats);
        setTotalRounds(total);
        if (phase === "playing") playRoundStart();
      })
      .on("broadcast", { event: "results" }, ({ payload }) => {
        setAllResults(payload.results);
        setShowResults(true);
      })
      .on("broadcast", { event: "vote" }, ({ payload }) => {
        setVotes(prev => ({
          ...prev,
          [payload.key]: payload.voters,
        }));
      })
      .on("broadcast", { event: "final_scores" }, ({ payload }) => {
        setRoundScores(payload.scores);
        setShowFinalScoreboard(true);
      })
      .on("broadcast", { event: "chat" }, ({ payload }) => {
        setChatMessages(prev => [...prev, payload]);
      })
      .on("broadcast", { event: "player_answers" }, ({ payload }) => {
        setAllResults(prev => ({
          ...prev,
          [payload.playerId]: payload.result,
        }));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            name: localPlayerName,
            isHost: players.length === 0,
          });
        }
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [isMultiplayer, roomCode, localPlayerName, localPlayerId, players.length, playRoundStart]);

  // Timer logic
  useEffect(() => {
    if (gamePhase === "playing" || gamePhase === "voting") {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (gamePhase === "playing") {
              handleRoundEnd();
            } else if (gamePhase === "voting") {
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
  }, [gamePhase]);

  // Game logic functions
  const startGame = useCallback(() => {
    const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const gameState = {
      phase: "playing" as GamePhase,
      round: 1,
      timeLeft: ROUND_TIME,
      letter,
      categories: selectedList.categories,
      totalRounds,
    };

    setGamePhase("playing");
    setCurrentRound(1);
    setTimeLeft(ROUND_TIME);
    setCurrentLetter(letter);
    setCategories(selectedList.categories);
    setAnswers({});
    setAllResults({});
    setVotes({});
    setRoundScores({});

    if (isMultiplayer && channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "game_state",
        payload: gameState,
      });
    }

    playRoundStart();
  }, [selectedList, totalRounds, isMultiplayer, playRoundStart]);

  const handleRoundEnd = useCallback(() => {
    const result: PlayerResult = {
      playerId: localPlayerId,
      name: localPlayerName,
      letter: currentLetter,
      answers,
    };

    setAllResults(prev => ({ ...prev, [localPlayerId]: result }));
    setGamePhase("voting");
    setTimeLeft(VOTE_TIME);

    if (isMultiplayer && channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "player_answers",
        payload: { playerId: localPlayerId, result },
      });
    }

    setTimeout(() => setShowResults(true), 500);
  }, [localPlayerId, localPlayerName, currentLetter, answers, isMultiplayer]);

  const handleVotingEnd = useCallback(() => {
    // Calculate scores and determine if game should continue
    const newScores = { ...roundScores };
    Object.keys(allResults).forEach(playerId => {
      if (!newScores[playerId]) newScores[playerId] = [];
      // Score calculation logic would go here
      newScores[playerId][currentRound - 1] = Math.floor(Math.random() * 10); // Placeholder
    });

    setRoundScores(newScores);
    setShowResults(false);

    if (currentRound >= totalRounds) {
      setGamePhase("final");
      setShowFinalScoreboard(true);
      playWin();
    } else {
      // Start next round
      const nextRound = currentRound + 1;
      const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
      
      setCurrentRound(nextRound);
      setCurrentLetter(letter);
      setGamePhase("playing");
      setTimeLeft(ROUND_TIME);
      setAnswers({});
      setAllResults({});
      setVotes({});

      if (isMultiplayer && channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "game_state",
          payload: {
            phase: "playing",
            round: nextRound,
            timeLeft: ROUND_TIME,
            letter,
            categories,
            totalRounds,
          },
        });
      }

      playRoundStart();
    }
  }, [roundScores, allResults, currentRound, totalRounds, categories, isMultiplayer, playWin, playRoundStart]);

  const handleVote = useCallback((voteKey: string) => {
    const currentVoters = votes[voteKey] || [];
    const hasVoted = currentVoters.includes(localPlayerId);
    const newVoters = hasVoted 
      ? currentVoters.filter(id => id !== localPlayerId)
      : [...currentVoters, localPlayerId];

    setVotes(prev => ({ ...prev, [voteKey]: newVoters }));

    if (isMultiplayer && channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "vote",
        payload: { key: voteKey, voters: newVoters },
      });
    }

    playVote();
  }, [votes, localPlayerId, isMultiplayer, playVote]);

  const sendChatMessage = useCallback((text: string) => {
    const message: ChatMessage = {
      id: localPlayerId,
      name: localPlayerName,
      text,
      ts: Date.now(),
    };

    setChatMessages(prev => [...prev, message]);

    if (isMultiplayer && channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "chat",
        payload: message,
      });
    }
  }, [localPlayerId, localPlayerName, isMultiplayer]);

  const copyRoomCode = useCallback(() => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
      toast({ title: "Room code copied!", description: `Share ${roomCode} with friends` });
    }
  }, [roomCode]);

  // Computed values
  const progress = useMemo(() => {
    const maxTime = gamePhase === "voting" ? VOTE_TIME : ROUND_TIME;
    return ((maxTime - timeLeft) / maxTime) * 100;
  }, [gamePhase, timeLeft]);

  const finalSummary = useMemo((): FinalSummary | null => {
    if (!showFinalScoreboard) return null;
    
    const totals: Record<string, number> = {};
    Object.entries(roundScores).forEach(([playerId, scores]) => {
      totals[playerId] = scores.reduce((sum, score) => sum + score, 0);
    });

    const maxScore = Math.max(...Object.values(totals));
    const winners = Object.entries(totals)
      .filter(([, score]) => score === maxScore)
      .map(([id]) => ({
        id,
        name: players.find(p => p.id === id)?.name || "Player",
        total: maxScore,
      }));

    return { totals, winners, players };
  }, [showFinalScoreboard, roundScores, players]);

  const streaks = useMemo(() => {
    // Calculate win streaks for chat display
    const streakMap: Record<string, number> = {};
    // This would be calculated based on game history
    return streakMap;
  }, []);

  // Solo game setup
  useEffect(() => {
    if (!isMultiplayer) {
      setPlayers([{ id: localPlayerId, name: localPlayerName, isHost: true }]);
    }
  }, [isMultiplayer, localPlayerId, localPlayerName]);

  return (
    <>
      <Helmet>
        <title>
          {isMultiplayer ? `Room ${roomCode} — Scattergories` : "Solo Game — Scattergories"}
        </title>
        <meta name="description" content="Play Scattergories with friends in real-time!" />
      </Helmet>

      <div className="relative min-h-screen card-game-bg">
        <Aurora />
        <Particles />
        
        <div className="relative z-10 container mx-auto px-4 py-6">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="glass-panel rounded-2xl p-6 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/")}
                    className="glass-card hover:scale-105"
                  >
                    <Home className="w-4 h-4 mr-2" />
                    Home
                  </Button>
                  
                  {isMultiplayer && roomCode && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-lg px-3 py-1">
                        {roomCode}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyRoomCode}
                        className="glass-card hover:scale-105"
                      >
                        {codeCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSoundEnabled(!soundEnabled);
                      localStorage.setItem("soundEnabled", (!soundEnabled).toString());
                    }}
                    className="glass-card hover:scale-105"
                  >
                    {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </Button>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4" />
                    <span>{players.length} player{players.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Game Content */}
            <div className="grid gap-6 lg:grid-cols-4">
              {/* Main Game Area */}
              <div className="lg:col-span-3 space-y-6">
                {gamePhase === "lobby" && (
                  <Card className="glass-panel">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        Game Setup
                      </CardTitle>
                      <CardDescription>
                        Configure your game settings before starting
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Category List</label>
                          <div className="grid gap-2">
                            {CATEGORY_LISTS.slice(0, 3).map((list) => (
                              <Button
                                key={list.id}
                                variant={selectedList.id === list.id ? "default" : "outline"}
                                onClick={() => setSelectedList(list)}
                                className="justify-start glass-card hover:scale-105"
                              >
                                <List className="w-4 h-4 mr-2" />
                                {list.name}
                              </Button>
                            ))}
                            <Button
                              variant={selectedList.id.startsWith("rand") ? "default" : "outline"}
                              onClick={() => setSelectedList(generateRandomList())}
                              className="justify-start glass-card hover:scale-105"
                            >
                              <Shuffle className="w-4 h-4 mr-2" />
                              Random Mix
                            </Button>
                          </div>
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">Number of Rounds</label>
                          <div className="grid grid-cols-3 gap-2">
                            {[1, 3, 5].map((rounds) => (
                              <Button
                                key={rounds}
                                variant={totalRounds === rounds ? "default" : "outline"}
                                onClick={() => setTotalRounds(rounds)}
                                className="glass-card hover:scale-105"
                              >
                                {rounds}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-medium mb-3">Categories Preview</h3>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {selectedList.categories.map((category, index) => (
                            <div key={index} className="text-sm p-2 rounded glass-card">
                              {index + 1}. {category}
                            </div>
                          ))}
                        </div>
                      </div>

                      {(!isMultiplayer || isHost) && (
                        <Button
                          onClick={startGame}
                          size="lg"
                          className="w-full glass-card hover:scale-105"
                          disabled={players.length === 0}
                        >
                          <Play className="w-5 h-5 mr-2" />
                          Start Game
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}

                {(gamePhase === "playing" || gamePhase === "voting") && (
                  <Card className="glass-panel">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                              {currentLetter}
                            </div>
                            Round {currentRound} of {totalRounds}
                          </CardTitle>
                          <CardDescription>
                            {gamePhase === "playing" 
                              ? "Fill in answers that start with the letter above"
                              : "Vote on questionable answers"
                            }
                          </CardDescription>
                        </div>
                        
                        <div className="text-right">
                          <div className="flex items-center gap-2 text-2xl font-bold">
                            <Clock className="w-6 h-6" />
                            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                          </div>
                          <Progress value={progress} className="w-32 mt-2" />
                        </div>
                      </div>
                    </CardHeader>
                    
                    {gamePhase === "playing" && (
                      <CardContent>
                        <div className="grid gap-4">
                          {categories.map((category, index) => (
                            <div key={index} className="glass-card p-4 rounded-lg">
                              <label className="block text-sm font-medium mb-2">
                                {index + 1}. {category}
                              </label>
                              <Input
                                value={answers[index] || ""}
                                onChange={(e) => setAnswers(prev => ({ ...prev, [index]: e.target.value }))}
                                placeholder={`Something that starts with ${currentLetter}...`}
                                className="glass-card"
                                disabled={timeLeft === 0}
                              />
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                )}

                {gamePhase === "final" && (
                  <Card className="glass-panel">
                    <CardHeader className="text-center">
                      <CardTitle className="flex items-center justify-center gap-2 text-3xl">
                        <Trophy className="w-8 h-8 text-yellow-500" />
                        Game Complete!
                      </CardTitle>
                      <CardDescription>
                        Thanks for playing! Check out the final scores.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center space-y-4">
                      <Button
                        onClick={() => setShowFinalScoreboard(true)}
                        size="lg"
                        className="glass-card hover:scale-105"
                      >
                        <Trophy className="w-5 h-5 mr-2" />
                        View Final Scores
                      </Button>
                      
                      {(!isMultiplayer || isHost) && (
                        <Button
                          onClick={() => {
                            setGamePhase("lobby");
                            setCurrentRound(1);
                            setAnswers({});
                            setAllResults({});
                            setVotes({});
                            setRoundScores({});
                          }}
                          variant="outline"
                          size="lg"
                          className="glass-card hover:scale-105 ml-4"
                        >
                          <RotateCcw className="w-5 h-5 mr-2" />
                          Play Again
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Players List */}
                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Players ({players.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {players.map((player) => (
                        <div key={player.id} className="flex items-center gap-3 p-2 rounded glass-card">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback style={{ backgroundImage: gradientFromString(player.name), color: "white" }}>
                              {initialsFromName(player.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {player.isHost && <Crown className="w-4 h-4 text-yellow-500" />}
                              <span className="font-medium truncate">
                                {player.id === localPlayerId ? "You" : player.name}
                              </span>
                              {streaks[player.id] > 0 && (
                                <div className="flex items-center gap-1 text-xs text-orange-500">
                                  <Flame className="w-3 h-3" />
                                  {streaks[player.id]}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Chat Panel */}
                {isMultiplayer && (
                  <ChatPanel
                    messages={chatMessages}
                    onSend={sendChatMessage}
                    currentName={localPlayerName}
                    hostId={players.find(p => p.isHost)?.id}
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
          results={allResults}
          presentCount={players.length}
          votes={votes}
          onVote={handleVote}
          categories={categories}
          localPlayerId={localPlayerId}
          voteTimeLeft={timeLeft}
          players={players}
        />

        {/* Final Scoreboard */}
        <FinalScoreboard
          open={showFinalScoreboard}
          onClose={() => setShowFinalScoreboard(false)}
          summary={finalSummary}
          isHost={!isMultiplayer || isHost}
          onPlayAgain={() => {
            setGamePhase("lobby");
            setShowFinalScoreboard(false);
            setCurrentRound(1);
            setAnswers({});
            setAllResults({});
            setVotes({});
            setRoundScores({});
          }}
        />
      </div>
    </>
  );
};

export default Game;