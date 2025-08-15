import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { gradientFromString, initialsFromName } from "@/lib/gradient";
import { useGameSounds } from "@/hooks/use-sound";
import { usePublicRoomAdvertiser } from "@/hooks/usePublicRoomAdvertiser";
import { ChatPanel, type ChatMessage } from "@/components/ChatPanel";
import { ResultsOverlay, type PlayerResult } from "@/components/ResultsOverlay";
import { FinalScoreboard, type FinalSummary } from "@/components/FinalScoreboard";
import BackButton from "@/components/BackButton";
import Aurora from "@/components/Aurora";
import Particles from "@/components/Particles";
import { CATEGORY_LISTS, generateRandomList, type CategoryList } from "@/data/categoryLists";
import {
  Users,
  Settings,
  Play,
  Crown,
  Clock,
  Send,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Shuffle,
  RotateCcw,
  Trophy,
  Flame,
  Star,
  Zap,
  Target,
  Globe,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";

// Game state types
type GamePhase = "lobby" | "playing" | "voting" | "results" | "final";
type Player = { id: string; name: string; present: boolean };
type GameSettings = {
  rounds: number;
  timePerRound: number;
  voteTime: number;
  categoryList: string;
  isPublic: boolean;
};

// Default settings
const DEFAULT_SETTINGS: GameSettings = {
  rounds: 3,
  timePerRound: 90,
  voteTime: 30,
  categoryList: "classic-1",
  isPublic: false,
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const Game = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roomCode = searchParams.get("room");
  const isMultiplayer = !!roomCode;

  // Core game state
  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [players, setPlayers] = useState<Player[]>([]);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [isHost, setIsHost] = useState(!isMultiplayer);
  const [localPlayerId] = useState(() => `player_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const [localPlayerName, setLocalPlayerName] = useState(() => localStorage.getItem("profileName") || "");

  // Game round state
  const [currentRound, setCurrentRound] = useState(0);
  const [roundLetter, setRoundLetter] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [voteTimeLeft, setVoteTimeLeft] = useState(0);

  // Results and voting
  const [roundResults, setRoundResults] = useState<Record<string, PlayerResult>>({});
  const [votes, setVotes] = useState<Record<string, string[]>>({});
  const [showResults, setShowResults] = useState(false);
  const [finalSummary, setFinalSummary] = useState<FinalSummary | null>(null);
  const [showFinalResults, setShowFinalResults] = useState(false);

  // UI state
  const [copied, setCopied] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("soundEnabled") !== "false");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Refs and hooks
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const sounds = useGameSounds(soundEnabled);

  // Get current category list
  const currentCategoryList = useMemo(() => {
    if (settings.categoryList === "random") return generateRandomList(12);
    return CATEGORY_LISTS.find(l => l.id === settings.categoryList) || CATEGORY_LISTS[0];
  }, [settings.categoryList]);

  // Room advertising for public rooms
  usePublicRoomAdvertiser({
    enabled: isMultiplayer && isHost && settings.isPublic,
    roomCode: roomCode || "",
    payload: {
      name: `${localPlayerName || "Host"}'s Room`,
      hostName: localPlayerName || "Host",
      maxPlayers: 8,
      createdAtISO: new Date().toISOString(),
    },
    players: players.filter(p => p.present).length,
    inMatch: phase !== "lobby",
  });

  // Initialize room
  useEffect(() => {
    if (!isMultiplayer) {
      // Solo mode
      setPlayers([{ id: localPlayerId, name: localPlayerName || "You", present: true }]);
      return;
    }

    if (!roomCode) {
      navigate("/");
      return;
    }

    // Join multiplayer room
    const channel = supabase.channel(`game_${roomCode}`, {
      config: { presence: { key: localPlayerId } }
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const playerList = Object.entries(state).map(([id, presences]) => {
          const p = presences[0] as any;
          return {
            id,
            name: p.name || "Player",
            present: true,
          };
        });
        setPlayers(playerList);

        // Determine host (first to join)
        const sortedPlayers = playerList.sort((a, b) => a.id.localeCompare(b.id));
        setIsHost(sortedPlayers[0]?.id === localPlayerId);
      })
      .on("broadcast", { event: "game_state" }, ({ payload }) => {
        const { phase: newPhase, settings: newSettings, currentRound: newRound, roundLetter: newLetter, categories: newCategories, timeLeft: newTimeLeft, voteTimeLeft: newVoteTimeLeft } = payload;
        setPhase(newPhase);
        if (newSettings) setSettings(newSettings);
        if (typeof newRound === "number") setCurrentRound(newRound);
        if (newLetter) setRoundLetter(newLetter);
        if (newCategories) setCategories(newCategories);
        if (typeof newTimeLeft === "number") setTimeLeft(newTimeLeft);
        if (typeof newVoteTimeLeft === "number") setVoteTimeLeft(newVoteTimeLeft);
      })
      .on("broadcast", { event: "round_results" }, ({ payload }) => {
        setRoundResults(payload.results || {});
        setVotes(payload.votes || {});
        setShowResults(true);
      })
      .on("broadcast", { event: "final_results" }, ({ payload }) => {
        setFinalSummary(payload.summary);
        setShowFinalResults(true);
      })
      .on("broadcast", { event: "chat" }, ({ payload }) => {
        setMessages(prev => [...prev, payload]);
      })
      .on("broadcast", { event: "vote" }, ({ payload }) => {
        setVotes(prev => ({
          ...prev,
          [payload.key]: payload.voters,
        }));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            name: localPlayerName || "Player",
            id: localPlayerId,
          });
        }
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [roomCode, localPlayerId, localPlayerName, isMultiplayer, navigate]);

  // Game timers
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setTimeout(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft]);

  useEffect(() => {
    if (voteTimeLeft <= 0) return;
    const timer = setTimeout(() => setVoteTimeLeft(t => Math.max(0, t - 1)), 1000);
    return () => clearTimeout(timer);
  }, [voteTimeLeft]);

  // Auto-advance phases
  useEffect(() => {
    if (phase === "playing" && timeLeft === 0) {
      if (isHost || !isMultiplayer) {
        startVotingPhase();
      }
    }
  }, [phase, timeLeft, isHost, isMultiplayer]);

  useEffect(() => {
    if (phase === "voting" && voteTimeLeft === 0) {
      if (isHost || !isMultiplayer) {
        endVotingPhase();
      }
    }
  }, [phase, voteTimeLeft, isHost, isMultiplayer]);

  // Game control functions
  const broadcastGameState = useCallback((updates: any) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "game_state",
        payload: updates,
      });
    }
  }, []);

  const startGame = useCallback(() => {
    if (!isHost && isMultiplayer) return;
    
    setPhase("playing");
    setCurrentRound(1);
    const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const gameCategories = currentCategoryList.categories.slice(0, 12);
    
    setRoundLetter(letter);
    setCategories(gameCategories);
    setTimeLeft(settings.timePerRound);
    setAnswers({});
    
    if (isMultiplayer) {
      broadcastGameState({
        phase: "playing",
        currentRound: 1,
        roundLetter: letter,
        categories: gameCategories,
        timeLeft: settings.timePerRound,
      });
    }
    
    sounds.playRoundStart();
  }, [isHost, isMultiplayer, currentCategoryList, settings.timePerRound, broadcastGameState, sounds]);

  const startVotingPhase = useCallback(() => {
    if (!isHost && isMultiplayer) return;
    
    setPhase("voting");
    setVoteTimeLeft(settings.voteTime);
    
    // Collect results
    const results: Record<string, PlayerResult> = {};
    players.forEach(player => {
      if (player.id === localPlayerId) {
        results[player.id] = {
          playerId: player.id,
          name: player.name,
          letter: roundLetter,
          answers: { ...answers },
        };
      } else {
        // In a real implementation, you'd get other players' answers
        results[player.id] = {
          playerId: player.id,
          name: player.name,
          letter: roundLetter,
          answers: {},
        };
      }
    });
    
    setRoundResults(results);
    setVotes({});
    
    if (isMultiplayer) {
      broadcastGameState({
        phase: "voting",
        voteTimeLeft: settings.voteTime,
      });
      
      channelRef.current?.send({
        type: "broadcast",
        event: "round_results",
        payload: { results, votes: {} },
      });
    } else {
      setShowResults(true);
    }
  }, [isHost, isMultiplayer, settings.voteTime, players, localPlayerId, roundLetter, answers, broadcastGameState]);

  const endVotingPhase = useCallback(() => {
    if (!isHost && isMultiplayer) return;
    
    setShowResults(false);
    
    if (currentRound >= settings.rounds) {
      // Game over
      const totals: Record<string, number> = {};
      const playerList = players.map(p => ({ id: p.id, name: p.name }));
      
      // Calculate final scores (simplified)
      players.forEach(player => {
        totals[player.id] = Math.floor(Math.random() * 20); // Mock scoring
      });
      
      const winners = Object.entries(totals)
        .map(([id, total]) => ({ id, name: players.find(p => p.id === id)?.name || "Player", total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 1);
      
      const summary: FinalSummary = { totals, winners, players: playerList };
      setFinalSummary(summary);
      setShowFinalResults(true);
      setPhase("final");
      
      if (isMultiplayer) {
        broadcastGameState({ phase: "final" });
        channelRef.current?.send({
          type: "broadcast",
          event: "final_results",
          payload: { summary },
        });
      }
      
      sounds.playWin();
    } else {
      // Next round
      const nextRound = currentRound + 1;
      const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
      
      setCurrentRound(nextRound);
      setRoundLetter(letter);
      setTimeLeft(settings.timePerRound);
      setAnswers({});
      setPhase("playing");
      
      if (isMultiplayer) {
        broadcastGameState({
          phase: "playing",
          currentRound: nextRound,
          roundLetter: letter,
          timeLeft: settings.timePerRound,
        });
      }
      
      sounds.playRoundStart();
    }
  }, [isHost, isMultiplayer, currentRound, settings.rounds, settings.timePerRound, players, broadcastGameState, sounds]);

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
    
    sounds.playVote();
  }, [votes, localPlayerId, isMultiplayer, sounds]);

  const sendMessage = useCallback((text: string) => {
    const message: ChatMessage = {
      id: localPlayerId,
      name: localPlayerName || "You",
      text,
      ts: Date.now(),
    };
    
    setMessages(prev => [...prev, message]);
    
    if (isMultiplayer && channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "chat",
        payload: message,
      });
    }
  }, [localPlayerId, localPlayerName, isMultiplayer]);

  const copyRoomCode = useCallback(() => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Room code copied!", description: `Share ${roomCode} with friends.` });
  }, [roomCode]);

  const toggleSound = useCallback(() => {
    const newEnabled = !soundEnabled;
    setSoundEnabled(newEnabled);
    localStorage.setItem("soundEnabled", String(newEnabled));
  }, [soundEnabled]);

  const updateSettings = useCallback((newSettings: Partial<GameSettings>) => {
    if (!isHost) return;
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    
    if (isMultiplayer) {
      broadcastGameState({ settings: updated });
    }
  }, [isHost, settings, isMultiplayer, broadcastGameState]);

  const playAgain = useCallback(() => {
    if (!isHost && isMultiplayer) return;
    
    setPhase("lobby");
    setCurrentRound(0);
    setRoundLetter(null);
    setCategories([]);
    setAnswers({});
    setTimeLeft(0);
    setVoteTimeLeft(0);
    setRoundResults({});
    setVotes({});
    setShowResults(false);
    setFinalSummary(null);
    setShowFinalResults(false);
    
    if (isMultiplayer) {
      broadcastGameState({
        phase: "lobby",
        currentRound: 0,
        roundLetter: null,
        categories: [],
        timeLeft: 0,
        voteTimeLeft: 0,
      });
    }
  }, [isHost, isMultiplayer, broadcastGameState]);

  // Render helpers
  const renderLobby = () => (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main lobby area */}
      <div className="lg:col-span-2 space-y-6">
        {/* Room info */}
        {isMultiplayer && (
          <Card className="glass-card">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Globe className="w-5 h-5 text-primary" />
                    Room {roomCode}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    {settings.isPublic ? (
                      <>
                        <Eye className="w-4 h-4" />
                        Public Room
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        Private Room
                      </>
                    )}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={copyRoomCode} className="glass-card hover:scale-105">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy Code"}
                </Button>
              </div>
            </CardHeader>
          </Card>
        )}

        {/* Players */}
        <Card className="glass-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Players ({players.filter(p => p.present).length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {players.filter(p => p.present).map((player, idx) => (
                <div key={player.id} className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/50">
                  <Avatar className="border-2 border-white/20">
                    <AvatarFallback style={{ backgroundImage: gradientFromString(player.name), color: "white" }}>
                      {initialsFromName(player.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{player.name}</span>
                      {player.id === localPlayerId && (
                        <Badge variant="secondary" className="text-xs">You</Badge>
                      )}
                      {isHost && player.id === players.find(p => p.present)?.id && (
                        <Crown className="w-4 h-4 text-primary" title="Host" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Game settings */}
        {isHost && (
          <Card className="glass-card">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  Game Settings
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(!settingsOpen)}>
                  {settingsOpen ? "Hide" : "Show"}
                </Button>
              </div>
            </CardHeader>
            {settingsOpen && (
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Rounds</Label>
                    <Select value={String(settings.rounds)} onValueChange={(v) => updateSettings({ rounds: Number(v) })}>
                      <SelectTrigger className="glass-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 Round</SelectItem>
                        <SelectItem value="3">3 Rounds</SelectItem>
                        <SelectItem value="5">5 Rounds</SelectItem>
                        <SelectItem value="10">10 Rounds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Time per Round</Label>
                    <Select value={String(settings.timePerRound)} onValueChange={(v) => updateSettings({ timePerRound: Number(v) })}>
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
                  
                  <div className="space-y-2">
                    <Label>Category List</Label>
                    <Select value={settings.categoryList} onValueChange={(v) => updateSettings({ categoryList: v })}>
                      <SelectTrigger className="glass-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_LISTS.map(list => (
                          <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>
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
                    <Label>Voting Time</Label>
                    <Select value={String(settings.voteTime)} onValueChange={(v) => updateSettings({ voteTime: Number(v) })}>
                      <SelectTrigger className="glass-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 seconds</SelectItem>
                        <SelectItem value="30">30 seconds</SelectItem>
                        <SelectItem value="60">1 minute</SelectItem>
                        <SelectItem value="90">1.5 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {isMultiplayer && (
                  <div className="flex items-center justify-between p-4 rounded-lg bg-background/30 border border-border/50">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Public Room</Label>
                      <p className="text-xs text-muted-foreground">Allow others to find and join this room</p>
                    </div>
                    <Switch
                      checked={settings.isPublic}
                      onCheckedChange={(checked) => updateSettings({ isPublic: checked })}
                    />
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )}

        {/* Start game button */}
        {isHost && (
          <Card className="glass-card">
            <CardContent className="pt-6">
              <Button 
                onClick={startGame} 
                className="w-full h-12 text-lg glass-card hover:scale-105"
                disabled={players.filter(p => p.present).length === 0}
              >
                <Play className="w-5 h-5 mr-2" />
                Start Game
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Sound toggle */}
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <Label>Sound Effects</Label>
              </div>
              <Switch checked={soundEnabled} onCheckedChange={toggleSound} />
            </div>
          </CardContent>
        </Card>

        {/* Category preview */}
        <Card className="glass-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Categories Preview</CardTitle>
            <CardDescription>{currentCategoryList.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {currentCategoryList.categories.slice(0, 12).map((category, idx) => (
                <div key={idx} className="text-sm p-2 rounded bg-background/30 border border-border/30">
                  {idx + 1}. {category}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Chat for multiplayer */}
        {isMultiplayer && (
          <ChatPanel
            messages={messages}
            onSend={sendMessage}
            currentName={localPlayerName || "You"}
            hostId={players.find(p => p.present)?.id}
          />
        )}
      </div>
    </div>
  );

  const renderGame = () => (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Game header */}
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <span className="text-white text-2xl font-bold">{roundLetter}</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold">Round {currentRound} of {settings.rounds}</h2>
                <p className="text-muted-foreground">Letter: {roundLetter}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</div>
                <div className="text-xs text-muted-foreground">Time Left</div>
              </div>
              <Progress value={(timeLeft / settings.timePerRound) * 100} className="w-24" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories and answers */}
      <Card className="glass-card">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Categories
          </CardTitle>
          <CardDescription>Fill in answers that start with "{roundLetter}"</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {categories.map((category, idx) => (
              <div key={idx} className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">
                    {idx + 1}
                  </span>
                  {category}
                </Label>
                <Input
                  value={answers[idx] || ""}
                  onChange={(e) => setAnswers(prev => ({ ...prev, [idx]: e.target.value }))}
                  placeholder={`Something that starts with "${roundLetter}"`}
                  className="glass-card"
                  disabled={timeLeft === 0}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Players status */}
      {isMultiplayer && (
        <Card className="glass-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Player Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {players.filter(p => p.present).map(player => (
                <div key={player.id} className="flex items-center gap-2 p-2 rounded-lg bg-background/30 border border-border/30">
                  <Avatar className="w-6 h-6 border">
                    <AvatarFallback style={{ backgroundImage: gradientFromString(player.name), color: "white", fontSize: "10px" }}>
                      {initialsFromName(player.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{player.name}</span>
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Active" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <>
      <Helmet>
        <title>{isMultiplayer ? `Room ${roomCode}` : "Solo Game"} — Scattergories Online</title>
        <meta name="description" content="Play Scattergories online with friends or solo. Fill in categories with words that start with the given letter." />
      </Helmet>

      <div className="relative min-h-screen card-game-bg">
        <Aurora />
        <Particles />
        <BackButton />
        
        <div className="relative z-10 container py-8">
          <header className="mb-8 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-black dark:text-white mb-2">
              {isMultiplayer ? `Room ${roomCode}` : "Solo Game"}
            </h1>
            {phase === "lobby" && (
              <p className="text-lg text-muted-foreground">
                {isMultiplayer ? "Waiting for players to join..." : "Ready to start your solo game"}
              </p>
            )}
          </header>

          {phase === "lobby" && renderLobby()}
          {phase === "playing" && renderGame()}
          
          {/* Results overlay */}
          <ResultsOverlay
            open={showResults}
            onClose={() => setShowResults(false)}
            results={roundResults}
            presentCount={players.filter(p => p.present).length}
            votes={votes}
            onVote={handleVote}
            categories={categories}
            localPlayerId={localPlayerId}
            voteTimeLeft={voteTimeLeft}
            players={players.filter(p => p.present)}
          />

          {/* Final results */}
          <FinalScoreboard
            open={showFinalResults}
            onClose={() => setShowFinalResults(false)}
            summary={finalSummary}
            isHost={isHost}
            onPlayAgain={playAgain}
          />
        </div>
      </div>
    </>
  );
};

export default Game;