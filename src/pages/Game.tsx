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
const ROUND_TIME = 90;
const VOTE_TIME = 30;
const RESULTS_TIME = 10;

// Types
type GamePhase = "lobby" | "playing" | "voting" | "results" | "final";
type Player = { id: string; name: string; present: boolean };

const Game = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomCode = searchParams.get("room")?.toUpperCase() || "";
  const isHost = !roomCode;
  
  // Player state
  const [playerName, setPlayerName] = useState(() => localStorage.getItem("profileName") || "");
  const [playerId] = useState(() => `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  
  // Room state
  const [players, setPlayers] = useState<Player[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("soundEnabled") !== "false");
  
  // Game state
  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(3);
  const [timeLeft, setTimeLeft] = useState(0);
  const [letter, setLetter] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedList, setSelectedList] = useState<CategoryList>(CATEGORY_LISTS[0]);
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
      createdAtISO: new Date().toISOString(),
    },
    players: players.filter(p => p.present).length,
    inMatch: phase !== "lobby",
  });

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
    if (!isHost) return;
    
    const newLetter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const newCategories = selectedList.categories.slice(0, 12);
    
    setLetter(newLetter);
    setCategories(newCategories);
    setPhase("playing");
    setAnswers({});
    setResults({});
    setVotes({});
    
    playRoundStart();
    startTimer(ROUND_TIME);
    
    // Broadcast to room
    channelRef.current?.send({
      type: "broadcast",
      event: "round_start",
      payload: { letter: newLetter, categories: newCategories, round: currentRound }
    });
  }, [isHost, selectedList, currentRound, playRoundStart, startTimer]);

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
    
    setPhase("voting");
  }, [playerId, playerName, letter, answers]);

  const vote = useCallback((voteKey: string) => {
    if (!channelRef.current) return;
    
    playVote();
    channelRef.current.send({
      type: "broadcast",
      event: "vote_cast",
      payload: { voteKey, voterId: playerId }
    });
  }, [playerId, playVote]);

  // Room setup
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
        startTimer(ROUND_TIME);
        playRoundStart();
      })
      .on("broadcast", { event: "answers_submitted" }, ({ payload }) => {
        setResults(prev => ({ ...prev, [payload.playerId]: payload }));
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
  }, [roomCode, playerName, playerId, isHost, hostId, startTimer, playRoundStart]);

  // Timer effects
  useEffect(() => {
    if (timeLeft === 0 && phase === "playing") {
      submitAnswers();
    }
  }, [timeLeft, phase, submitAnswers]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const presentPlayers = players.filter(p => p.present);
  const isPlayerHost = hostId === playerId;

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
          <div className="grid gap-6 lg:grid-cols-4">
            {/* Main Game Area */}
            <div className="lg:col-span-3 space-y-6">
              {/* Game Status */}
              <Card className="glass-panel">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
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
                    
                    {(phase === "playing" || phase === "voting") && (
                      <div className="text-right">
                        <div className="text-3xl font-bold text-primary">{timeLeft}</div>
                        <div className="text-sm text-muted-foreground">seconds</div>
                      </div>
                    )}
                  </div>
                  
                  {(phase === "playing" || phase === "voting") && (
                    <Progress 
                      value={((phase === "playing" ? ROUND_TIME : VOTE_TIME) - timeLeft) / (phase === "playing" ? ROUND_TIME : VOTE_TIME) * 100} 
                      className="mt-4"
                    />
                  )}
                </CardHeader>
              </Card>

              {/* Lobby Phase */}
              {phase === "lobby" && (
                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle>Game Setup</CardTitle>
                    <CardDescription>Configure your game settings</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Category List</label>
                        <select
                          value={selectedList.id}
                          onChange={(e) => {
                            const list = CATEGORY_LISTS.find(l => l.id === e.target.value) || CATEGORY_LISTS[0];
                            setSelectedList(list);
                          }}
                          className="w-full p-2 rounded-md border border-input bg-background"
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
                          className="w-full p-2 rounded-md border border-input bg-background"
                          disabled={!isPlayerHost}
                        >
                          <option value={1}>1 Round</option>
                          <option value={3}>3 Rounds</option>
                          <option value={5}>5 Rounds</option>
                        </select>
                      </div>
                    </div>
                    
                    {isPlayerHost && (
                      <div className="flex gap-2">
                        <Button onClick={startRound} className="glass-card hover:scale-105">
                          <Play className="w-4 h-4 mr-2" />
                          Start Game
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setSelectedList(generateRandomList())}
                          className="glass-card hover:scale-105"
                        >
                          <Shuffle className="w-4 h-4 mr-2" />
                          Random Categories
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Playing Phase */}
              {phase === "playing" && (
                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                        {letter}
                      </div>
                      Answer Categories
                    </CardTitle>
                    <CardDescription>
                      Find words that start with "{letter}" for each category below
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {categories.map((category, index) => (
                        <div key={index} className="space-y-2">
                          <label className="text-sm font-medium">
                            {index + 1}. {category}
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
                      <Button onClick={submitAnswers} className="glass-card hover:scale-105">
                        Submit Answers
                      </Button>
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
                    Players ({presentPlayers.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {presentPlayers.map((player) => (
                    <div key={player.id} className="flex items-center gap-3 p-2 rounded-lg glass-card">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback style={{ backgroundImage: gradientFromString(player.name), color: "white" }}>
                          {initialsFromName(player.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{player.name}</span>
                          {player.id === hostId && <Crown className="w-4 h-4 text-yellow-500" />}
                          {player.id === playerId && <span className="text-xs text-primary">(You)</span>}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Score: {scores[player.id] || 0}</span>
                          {streaks[player.id] > 0 && (
                            <span className="flex items-center gap-1 text-orange-500">
                              <Flame className="w-3 h-3" />
                              {streaks[player.id]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {roomCode && presentPlayers.length < 8 && (
                    <div className="text-center p-4 border-2 border-dashed border-border rounded-lg">
                      <UserPlus className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Share room code <strong>{roomCode}</strong> to invite friends
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

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
          voteTimeLeft={timeLeft}
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
          }}
        />
      </div>
    </>
  );
};

export default Game;