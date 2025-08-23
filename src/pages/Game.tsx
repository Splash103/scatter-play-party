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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { gradientFromString, initialsFromName } from "@/lib/gradient";
import { useGameSounds } from "@/hooks/use-sound";
import { usePublicRoomAdvertiser } from "@/hooks/usePublicRoomAdvertiser";
import { ChatPanel, type ChatMessage } from "@/components/ChatPanel";
import { ResultsOverlay } from "@/components/ResultsOverlay";
import { FinalScoreboard, type FinalSummary } from "@/components/FinalScoreboard";
import { CATEGORY_LISTS, generateRandomList, type CategoryList } from "@/data/categoryLists";
import Particles from "@/components/Particles";
import Aurora from "@/components/Aurora";
import {
  Play,
  Pause,
  RotateCcw,
  Settings,
  Users,
  Crown,
  Clock,
  Send,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Zap,
  Target,
  Trophy,
  Star,
  Flame,
  Shield,
  Eye,
  EyeOff,
  StopCircle,
  FastForward,
  AlertTriangle,
  CheckCircle2,
  Timer,
  Sparkles
} from "lucide-react";

// Game state types
type GamePhase = "lobby" | "playing" | "results" | "final" | "voting" | "rps";
type GameMode = "solo" | "multiplayer";

interface Player {
  id: string;
  name: string;
  isHost?: boolean;
  isReady?: boolean;
  score?: number;
  streak?: number;
  powerUps?: PowerUp[];
  achievements?: Achievement[];
}

interface PowerUp {
  id: string;
  type: "time_freeze" | "double_points" | "peek" | "shield" | "lightning";
  name: string;
  description: string;
  uses: number;
  maxUses: number;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string;
}

interface GameSettings {
  roundTime: number;
  maxRounds: number;
  allowEarlySubmit: boolean;
  showResultsAt: number; // seconds remaining when results show
  votingTime: number; // seconds for voting phase
  enablePowerUps: boolean;
  enableAchievements: boolean;
  publicRoom: boolean;
  maxPlayers: number;
  categoryList: string;
  autoSubmitOnTimeout: boolean; // auto-submit when timer ends
  autoSubmitOnEarlySubmit: boolean; // auto-submit when players submit early
  autoSubmitOnStop: boolean; // auto-submit when host stops round
}

interface RoundData {
  letter: string;
  categories: string[];
  answers: Record<string, string>;
  submitted: boolean;
  submittedAt?: number;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";


const DEFAULT_SETTINGS: GameSettings = {
  roundTime: 120,
  maxRounds: 3,
  allowEarlySubmit: true,
  showResultsAt: 60,
  votingTime: 30,
  enablePowerUps: true,
  enableAchievements: true,
  publicRoom: false,
  maxPlayers: 8,
  categoryList: "classic-1",
  autoSubmitOnTimeout: true,
  autoSubmitOnEarlySubmit: true,
  autoSubmitOnStop: true
};

const POWER_UPS: PowerUp[] = [
  {
    id: "time_freeze",
    type: "time_freeze",
    name: "Time Freeze",
    description: "Freeze the timer for 10 seconds",
    uses: 0,
    maxUses: 1
  },
  {
    id: "double_points",
    type: "double_points", 
    name: "Double Points",
    description: "Double points for this round",
    uses: 0,
    maxUses: 2
  },
  {
    id: "peek",
    type: "peek",
    name: "Peek",
    description: "See other players' progress",
    uses: 0,
    maxUses: 3
  },
  {
    id: "shield",
    type: "shield",
    name: "Shield",
    description: "Protect from vote-outs",
    uses: 0,
    maxUses: 1
  },
  {
    id: "lightning",
    type: "lightning",
    name: "Lightning",
    description: "Auto-fill one category",
    uses: 0,
    maxUses: 1
  }
];

export default function Game() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roomCode = searchParams.get("room");
  const isMultiplayer = !!roomCode;
  const gameMode: GameMode = isMultiplayer ? "multiplayer" : "solo";

  // Core game state
  const [gamePhase, setGamePhase] = useState<GamePhase>("lobby");
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  
  // Round state
  const [currentRound, setCurrentRound] = useState(0);
  const [roundData, setRoundData] = useState<RoundData | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [votingTimeLeft, setVotingTimeLeft] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [earlySubmitCount, setEarlySubmitCount] = useState(0);
  const [canSubmitEarly, setCanSubmitEarly] = useState(false);
  
  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showStopDialog, setShowStopDialog] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [copied, setCopied] = useState(false);
  const [peekMode, setPeekMode] = useState(false);
  const [activePowerUps, setActivePowerUps] = useState<Set<string>>(new Set());
  
  // Multiplayer state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [votes, setVotes] = useState<Record<string, string[]>>({});
  const [results, setResults] = useState<Record<string, any>>({});
  const [allPlayersAnswers, setAllPlayersAnswers] = useState<Record<string, any>>({});
  const [finalSummary, setFinalSummary] = useState<FinalSummary | null>(null);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [showRoundTransition, setShowRoundTransition] = useState(false);
  const [roomCreatorId, setRoomCreatorId] = useState<string | null>(null);
  const [finalScoreboardOpen, setFinalScoreboardOpen] = useState(false);
  const [showFinalResultsState, setShowFinalResultsState] = useState(false);
  const [transitionText, setTransitionText] = useState("");
  
  // Rock Paper Scissors state
  const [showRockPaperScissors, setShowRockPaperScissors] = useState(false);
  const [rpsChoices, setRpsChoices] = useState<Record<string, string>>({});
  const [rpsResults, setRpsResults] = useState<string | null>(null);
  const [tiedPlayers, setTiedPlayers] = useState<Player[]>([]);
  const [matchWinner, setMatchWinner] = useState<{ id: string; name: string } | null>(null);
  
  // Refs and hooks
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const joinTsRef = useRef<number>(Date.now());
  const hostReelectionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { playRoundStart, playVote, playWin } = useGameSounds(soundEnabled);
  const playerName = localStorage.getItem("profileName") || "Player";
  const playerId = useMemo(() => `player_${Date.now()}_${Math.random().toString(36).slice(2)}`, []);

  // Room advertising for public rooms
  usePublicRoomAdvertiser({
    enabled: isMultiplayer && (roomCreatorId === playerId) && settings.publicRoom,
    roomCode: roomCode || "",
    payload: {
      name: `${playerName}'s Room`,
      hostName: playerName,
      maxPlayers: settings.maxPlayers,
      createdAtISO: new Date().toISOString(),
    },
    players: players.length,
    inMatch: gamePhase !== "lobby",
  });

  // Initialize game
  useEffect(() => {
    if (isMultiplayer && roomCode) {
      initializeMultiplayerRoom();
    } else {
      initializeSoloGame();
    }
    return () => cleanup();
  }, [roomCode]);

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (hostReelectionTimerRef.current) {
      clearTimeout(hostReelectionTimerRef.current);
      hostReelectionTimerRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };

  const initializeSoloGame = () => {
    const player: Player = {
      id: playerId,
      name: playerName,
      isHost: true,
      isReady: true,
      score: 0,
      streak: 0,
      powerUps: [...POWER_UPS],
      achievements: []
    };
    setPlayers([player]);
    setCurrentPlayer(player);
    setIsHost(true);
    setGamePhase("lobby");
  };

  const initializeMultiplayerRoom = async () => {
    if (!roomCode) return;

    const channel = supabase.channel(`game_${roomCode}`, {
      config: { presence: { key: playerId } }
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, async () => {
        const state = channel.presenceState();
        const entries = Object.entries(state);
        const playerList = entries.map(([id, presences]) => {
          const presence = (presences as any[])[0] || {};
          return {
            id,
            name: presence.name || "Player",
            isReady: presence.isReady || false,
            score: presence.score || 0,
            streak: presence.streak || 0,
            powerUps: presence.powerUps || [...POWER_UPS],
            achievements: presence.achievements || [],
            roomCreatorId: presence.roomCreatorId as string | null | undefined,
            joinTs: typeof presence.joinTs === 'number' ? presence.joinTs : Number.MAX_SAFE_INTEGER,
          } as any;
        });
        
        const onlineIds = playerList.map(p => p.id);
        
        // Prefer an existing, present room creator if announced by any client
        let announcedCreator = playerList.find(p => p.roomCreatorId && onlineIds.includes(p.roomCreatorId));
        let actualRoomCreatorId = announcedCreator?.roomCreatorId || roomCreatorId || null;
        
        const hostPresent = actualRoomCreatorId ? onlineIds.includes(actualRoomCreatorId) : false;
        
        if (!actualRoomCreatorId) {
          // Initial election: pick the earliest joinTs; fallback to smallest id
          const withJoin = playerList.map(p => ({ ...p, joinTs: isFinite((p as any).joinTs) ? (p as any).joinTs : Number.MAX_SAFE_INTEGER }));
          withJoin.sort((a, b) => ((a as any).joinTs - (b as any).joinTs) || a.id.localeCompare(b.id));
          const candidateId = withJoin[0]?.id || playerId;
          actualRoomCreatorId = candidateId;
          setRoomCreatorId(candidateId);
          
          if (candidateId === playerId && channelRef.current) {
            await channelRef.current.track({
              name: playerName,
              isHost: true,
              isReady: currentPlayer?.isReady ?? false,
              score: currentPlayer?.score ?? 0,
              streak: currentPlayer?.streak ?? 0,
              powerUps: currentPlayer?.powerUps ?? [...POWER_UPS],
              achievements: currentPlayer?.achievements ?? [],
              joinTs: joinTsRef.current,
              roomCreatorId: candidateId,
            });
          }
        } else if (!hostPresent) {
          // Host left -> debounce re-election
          if (hostReelectionTimerRef.current) {
            clearTimeout(hostReelectionTimerRef.current);
          }
          hostReelectionTimerRef.current = setTimeout(async () => {
            const withJoin = playerList.map(p => ({ ...p, joinTs: isFinite((p as any).joinTs) ? (p as any).joinTs : Number.MAX_SAFE_INTEGER }));
            withJoin.sort((a, b) => ((a as any).joinTs - (b as any).joinTs) || a.id.localeCompare(b.id));
            const candidateId = withJoin[0]?.id || playerId;
            setRoomCreatorId(candidateId);
            
            if (candidateId === playerId && channelRef.current) {
              await channelRef.current.track({
                name: playerName,
                isHost: true,
                isReady: currentPlayer?.isReady ?? false,
                score: currentPlayer?.score ?? 0,
                streak: currentPlayer?.streak ?? 0,
                powerUps: currentPlayer?.powerUps ?? [...POWER_UPS],
                achievements: currentPlayer?.achievements ?? [],
                joinTs: joinTsRef.current,
                roomCreatorId: candidateId,
              });
            }
          }, 1200);
        } else {
          // Host present; ensure no pending re-election
          if (hostReelectionTimerRef.current) {
            clearTimeout(hostReelectionTimerRef.current);
            hostReelectionTimerRef.current = null;
          }
        }
        
        // Update player list with correct host status - only room creator is host
        const updatedPlayerList = playerList.map(p => ({
          ...p,
          isHost: p.id === actualRoomCreatorId
        }));
        setPlayers(updatedPlayerList as any);
        
        const iAmHost = actualRoomCreatorId === playerId;
        setIsHost(iAmHost);
        const currentPlayerData = updatedPlayerList.find(p => p.id === playerId) as any;
        if (currentPlayerData) {
          setCurrentPlayer(currentPlayerData);
        }
        console.log('Presence sync → host:', { actualRoomCreatorId, iAmHost, online: onlineIds.length });
      })
      .on("broadcast", { event: "game_state" }, ({ payload }) => {
        handleGameStateUpdate(payload);
      })
      .on("broadcast", { event: "chat_message" }, ({ payload }) => {
        setChatMessages(prev => [...prev, payload]);
      })
      .on("broadcast", { event: "vote" }, ({ payload }) => {
        setVotes(prev => ({
          ...prev,
          [payload.key]: [...(prev[payload.key] || []), payload.voterId]
        }));
        playVote();
      })
      .on("broadcast", { event: "player_answers" }, ({ payload }) => {
        setAllPlayersAnswers(prev => ({
          ...prev,
          [payload.playerId]: payload
        }));
      })
      .on("broadcast", { event: "round_results" }, ({ payload }) => {
        setResults(payload.results);
        setVotes(payload.votes || {});
        setShowResults(true);
      })
      .on("broadcast", { event: "final_results" }, ({ payload }) => {
        setFinalSummary(payload.summary);
        setShowFinalResultsState(true);
        playWin();
      })
      .on("broadcast", { event: "stop_round" }, () => {
        endRound();
      })
      .on("broadcast", { event: "early_submit" }, ({ payload }) => {
        toast({ 
          title: "Early Submit", 
          description: `${payload.playerName} submitted early!` 
        });
      })
      .on("broadcast", { event: "force_submit_all" }, ({ payload }) => {
        // All players must submit immediately when host forces
        if (roundData && !roundData.submitted) {
          setRoundData(prev => prev ? { ...prev, submitted: true } : null);
          toast({ 
            title: "Round Ended", 
            description: "Host forced all players to submit!" 
          });
        }
      })
      .on("broadcast", { event: "auto_submit_all" }, ({ payload }) => {
        // Auto-submit all players' current answers
        if (roundData && !roundData.submitted) {
          setRoundData(prev => prev ? { ...prev, submitted: true } : null);
          // Broadcast this player's answers when auto-submitted
          broadcastPlayerAnswers();
          toast({ 
            title: "Round Auto-Submitted", 
            description: "All answers were automatically submitted!" 
          });
        }
      })
      .on("broadcast", { event: "return_to_lobby" }, () => {
        // Return all players to lobby
        setGamePhase("lobby");
        setCurrentRound(0);
        setShowFinalResultsState(false);
        setFinalSummary(null);
        setResults({});
        setVotes({});
        setAllPlayersAnswers({});
        setShowResults(false);
        setPlayers(prev => prev.map(p => ({ ...p, score: 0, isReady: false })));
      })
      .on("broadcast", { event: "rps_choice" }, ({ payload }) => {
        setRpsChoices(prev => ({ ...prev, [payload.playerId]: payload.choice }));
      })
      .on("broadcast", { event: "rps_results" }, ({ payload }) => {
        setRpsResults(payload.winner);
        setTimeout(() => {
          setShowRockPaperScissors(false);
          setRpsChoices({});
          setRpsResults(null);
          // Update final summary with tiebreaker winner
          if (finalSummary) {
            const updatedSummary = {
              ...finalSummary,
              winners: [{ id: payload.winnerId, name: payload.winner, total: finalSummary.winners[0].total }]
            };
            setFinalSummary(updatedSummary);
          }
        }, 3000);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Track initial presence with a stable join timestamp. Host election happens on presence sync.
          await channel.track({
            name: playerName,
            isReady: false,
            score: 0,
            streak: 0,
            powerUps: [...POWER_UPS],
            achievements: [],
            joinTs: joinTsRef.current,
          });
        }
      });
  };

  const handleGameStateUpdate = (payload: any) => {
    if (payload.phase) setGamePhase(payload.phase);
    if (payload.settings) setSettings(payload.settings);
    if (payload.currentRound !== undefined) setCurrentRound(payload.currentRound);
    if (payload.roundData) setRoundData(payload.roundData);
    if (payload.timeLeft !== undefined) setTimeLeft(payload.timeLeft);
    if (payload.votingTimeLeft !== undefined) setVotingTimeLeft(payload.votingTimeLeft);
    if (payload.isPaused !== undefined) setIsPaused(payload.isPaused);
    if (payload.earlySubmitCount !== undefined) setEarlySubmitCount(payload.earlySubmitCount);
    if (payload.showResults !== undefined) setShowResults(payload.showResults);
  };

  const broadcastGameState = (updates: any) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: "broadcast",
      event: "game_state",
      payload: updates
    });
  };

  const sendChatMessage = (text: string) => {
    if (!channelRef.current) return;
    const message: ChatMessage = {
      id: playerId,
      name: playerName,
      text,
      ts: Date.now()
    };
    channelRef.current.send({
      type: "broadcast",
      event: "chat_message",
      payload: message
    });
    setChatMessages(prev => [...prev, message]);
  };

  const toggleReady = async () => {
    if (!channelRef.current || !currentPlayer) return;
    const newReady = !currentPlayer.isReady;
    
    // Update current player state locally first
    setCurrentPlayer(prev => prev ? { ...prev, isReady: newReady } : null);
    
      await channelRef.current.track({
        name: playerName,
        isHost: roomCreatorId === playerId,
        isReady: newReady,
        score: currentPlayer.score || 0,
        streak: currentPlayer.streak || 0,
        powerUps: currentPlayer.powerUps || [...POWER_UPS],
        achievements: currentPlayer.achievements || [],
        joinTs: joinTsRef.current,
        roomCreatorId: roomCreatorId
      });
  };

  const startMatch = () => {
    console.log('startMatch called', { isHost, roomCreatorId, playerId, players });
    
    // For solo play, host should always be able to start
    if (!isMultiplayer) {
      console.log('Starting solo game...');
      startNewRound();
      playRoundStart();
      return;
    }
    
    // For multiplayer, only room creator can start
    if (roomCreatorId !== playerId) {
      toast({
        title: "Not authorized",
        description: "Only the room creator can start the match."
      });
      return;
    }
    
    // Check if players are ready (host doesn't need to be ready)
    const readyPlayers = players.filter(p => p.isReady || p.isHost);
    if (readyPlayers.length < 1) {
      toast({
        title: "Cannot start",
        description: "At least one player must be ready to start."
      });
      return;
    }

    console.log('Starting multiplayer game...');
    startNewRound();
    playRoundStart();
  };

  const startNewRound = () => {
    const categoryList = CATEGORY_LISTS.find(l => l.id === settings.categoryList) || generateRandomList();
    const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    
    const newRoundData: RoundData = {
      letter,
      categories: categoryList.categories.slice(0, 12),
      answers: {},
      submitted: false
    };

    setRoundData(newRoundData);
    setTimeLeft(settings.roundTime);
    setVotingTimeLeft(0);
    setGamePhase("playing");
    setShowResults(false);
    setEarlySubmitCount(0);
    setCanSubmitEarly(settings.allowEarlySubmit);
    setVotes({});
    setResults({});

    if (isMultiplayer) {
      broadcastGameState({
        phase: "playing",
        roundData: newRoundData,
        timeLeft: settings.roundTime,
        votingTimeLeft: 0,
        currentRound: currentRound,
        showResults: false,
        earlySubmitCount: 0
      });
    }

    startTimer();
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const newTime = prev - 1;
        
        // Show results when timer reaches the threshold
        if (newTime === settings.showResultsAt && !showResults) {
          setShowResults(true);
          if (isMultiplayer) {
            broadcastGameState({ showResults: true });
          }
        }
        
        // End round when timer reaches 0
        if (newTime <= 0) {
          if (settings.autoSubmitOnTimeout) {
            autoSubmitAllPlayers();
          }
          endRound();
          return 0;
        }
        
        if (isMultiplayer && isHost) {
          broadcastGameState({ timeLeft: newTime });
        }
        
        return newTime;
      });
    }, 1000);
  };

  // Voting timer
  useEffect(() => {
    if (gamePhase === "results" && votingTimeLeft > 0) {
      const timer = setTimeout(() => {
        setVotingTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (gamePhase === "results" && votingTimeLeft === 0) {
      // Voting time ended, show results
      showRoundResults();
    }
  }, [votingTimeLeft, gamePhase]);

  const pauseTimer = () => {
    if (!isHost) return;
    setIsPaused(true);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (isMultiplayer) {
      broadcastGameState({ isPaused: true });
    }
  };

  const resumeTimer = () => {
    if (!isHost) return;
    setIsPaused(false);
    startTimer();
    if (isMultiplayer) {
      broadcastGameState({ isPaused: false });
    }
  };

  const stopRound = () => {
    if (!isHost) return;
    setShowStopDialog(false);
    
    // Auto-submit if enabled
    if (settings.autoSubmitOnStop) {
      autoSubmitAllPlayers();
    }
    
    // Broadcast stop round to all players
    if (isMultiplayer) {
      channelRef.current?.send({
        type: "broadcast",
        event: "stop_round",
        payload: {}
      });
    }
    
    endRound();
  };

  const broadcastPlayerAnswers = () => {
    if (!isMultiplayer || !channelRef.current || !roundData) return;
    
    const playerAnswers = {
      playerId,
      name: playerName,
      letter: roundData.letter,
      answers: roundData.answers || {}
    };
    
    channelRef.current.send({
      type: "broadcast",
      event: "player_answers",
      payload: playerAnswers
    });
    
    // Also store locally
    setAllPlayersAnswers(prev => ({
      ...prev,
      [playerId]: playerAnswers
    }));
  };

  const submitEarly = () => {
    if (!canSubmitEarly || !roundData) return;
    
    // Mark as submitted for this player first
    setRoundData(prev => prev ? { ...prev, submitted: true } : null);
    
    // Broadcast this player's answers
    broadcastPlayerAnswers();
    
    const newCount = earlySubmitCount + 1;
    setEarlySubmitCount(newCount);
    
    if (isMultiplayer) {
      channelRef.current?.send({
        type: "broadcast",
        event: "early_submit",
        payload: { playerId, playerName }
      });
      broadcastGameState({ earlySubmitCount: newCount });
    }
    
    // If host submits early, force all players to submit immediately
    if (isHost) {
      if (settings.autoSubmitOnEarlySubmit) {
        setTimeout(() => autoSubmitAllPlayers(), 100); // Small delay to ensure answers are broadcast first
      }
      setTimeout(() => endRound(), 200);
    } else {
      // Non-host players can submit early individually
      const totalPlayers = isMultiplayer ? players.length : 1;
      const threshold = Math.ceil(totalPlayers / 2);
      
      if (newCount >= threshold) {
        // Majority submitted early, auto-submit and end the round
        if (settings.autoSubmitOnEarlySubmit) {
          setTimeout(() => autoSubmitAllPlayers(), 100);
        }
        // Only host can end the round
        if (isHost) {
          setTimeout(() => endRound(), 200);
        }
      }
    }
  };

  const autoSubmitAllPlayers = () => {
    // Force all players to broadcast their current answers
    broadcastPlayerAnswers();
    
    if (isMultiplayer) {
      channelRef.current?.send({
        type: "broadcast",
        event: "auto_submit_all",
        payload: { hostId: playerId }
      });
    }
  };

  const endRound = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Ensure all players broadcast their answers before ending
    broadcastPlayerAnswers();

    setShowResults(true);
    setGamePhase("results");
    setVotingTimeLeft(settings.votingTime);
    
    // Wait a moment for all player answers to be received, then collect results
    setTimeout(() => {
      const roundResults: Record<string, any> = {};
      
      if (isMultiplayer) {
        // Use collected answers from all players
        players.forEach(player => {
          const playerAnswers = allPlayersAnswers[player.id];
          roundResults[player.id] = {
            playerId: player.id,
            name: player.name,
            letter: roundData?.letter || null,
            answers: playerAnswers?.answers || {}
          };
        });
        
        if (isHost) {
          // Host broadcasts results to all players
          channelRef.current?.send({
            type: "broadcast",
            event: "round_results",
            payload: { results: roundResults, votes: votes }
          });
        }
      } else {
        // Solo game - just add current player's results
        roundResults[playerId] = {
          playerId,
          name: playerName,
          letter: roundData?.letter || null,
          answers: roundData?.answers || {}
        };
      }
      
      setResults(roundResults);
      setResultsOpen(true);
      
      // Schedule round progression or game end
      setTimeout(() => {
        setResultsOpen(false);
        
        // Check if game should end (currentRound is 0-indexed, so check >= maxRounds - 1)
        if (currentRound >= settings.maxRounds - 1) {
          endGame();
        } else {
          // Move to next round
          if (isHost || !isMultiplayer) {
            nextRound();
          }
        }
      }, settings.votingTime * 1000); // Wait for voting to complete
    }, 300); // Give time for answers to be broadcast and received
  };

  const showRoundResults = () => {
    // Calculate scores and determine round winner
    const scores = calculateRoundScores();
    
    // Check if this was the final round (currentRound is 0-indexed)
    if (currentRound >= settings.maxRounds - 1) {
      // Final round - show final results
      showMatchFinalResults(scores);
    } else {
      // Move to next round after a brief delay
      setTimeout(() => {
        startNextRound();
      }, 3000);
    }
  };

  const calculateRoundScores = () => {
    const scores: Record<string, number> = {};
    
    Object.values(results).forEach(result => {
      const score = scoreFor(result);
      scores[result.playerId] = (scores[result.playerId] || 0) + score;
    });
    
    return scores;
  };

  const scoreFor = (result: any) => {
    // Simple scoring logic - 1 point per valid answer
    const answers = result.answers || {};
    return Object.values(answers).filter((answer: any) => answer && typeof answer === 'string' && answer.length > 0).length;
  };

  const showMatchFinalResults = async (finalScores: Record<string, number>) => {
    setResultsOpen(false); // Stop the results timer loop
    // Find the highest score
    const maxScore = Math.max(...Object.values(finalScores));
    const winners = Object.entries(finalScores)
      .filter(([_, score]) => score === maxScore)
      .map(([playerId, score]) => ({
        id: playerId,
        name: players.find(p => p.id === playerId)?.name || "Player",
        score
      }));

    if (winners.length === 1) {
      // Single winner
      const winner = winners[0];
      setMatchWinner(winner);
      await recordWin(winner.id);
      setGamePhase("final");
    } else {
      // Tie - need rock paper scissors
      setTiedPlayers(winners.map(w => ({ id: w.id, name: w.name })));
      setGamePhase("rps");
    }
  };

  const recordWin = async (winnerId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; // Only record wins for authenticated users
      
      // Check if the winner is the current authenticated user
      const winnerPlayer = players.find(p => p.id === winnerId);
      if (!winnerPlayer || winnerPlayer.id !== playerId) return;
      
      // Record the win in the database
      const { error } = await supabase
        .from('match_wins')
        .insert({
          match_id: `${roomCode}-${Date.now()}`, // Simple match ID
          user_id: user.id
        });
        
      if (error) {
        console.error('Error recording win:', error);
      } else {
        // Note: update_win_streak function would need to be created in Supabase
        // For now, we'll just record the win
      }
    } catch (error) {
      console.error('Error in recordWin:', error);
    }
  };

  const handlePostResults = useCallback(() => {
    // Handle post-results logic here
  }, [gamePhase, finalScoreboardOpen, currentRound, settings.maxRounds]);

  useEffect(() => {
    if (resultsOpen && gamePhase === "results") {
      handlePostResults();
    }
  }, [resultsOpen, gamePhase, handlePostResults]);

  const nextRound = () => {
    if (!isHost) return;
    const newRound = currentRound + 1;
    setCurrentRound(newRound);
    setGamePhase("playing");
    setShowResults(false);
    setResultsOpen(false);
    setVotingTimeLeft(0);
    setResults({});
    setVotes({});
    setAllPlayersAnswers({});
    startNewRound();
  };

  const endGame = () => {
    setGamePhase("final");
    
    // Calculate final scores and create summary
    const playerScores = players.reduce((acc, player) => {
      acc[player.id] = player.score || 0;
      return acc;
    }, {} as Record<string, number>);

    const maxScore = Math.max(...players.map(p => p.score || 0));
    const potentialWinners = players
      .filter(p => p.score === maxScore);

    // Check for ties
    if (potentialWinners.length > 1 && isMultiplayer) {
      // Start rock paper scissors tiebreaker
      setTiedPlayers(potentialWinners);
      setShowRockPaperScissors(true);
      return;
    }

    const winners = potentialWinners
      .filter(p => p.score === Math.max(...players.map(p => p.score || 0)))
      .map(p => ({ id: p.id, name: p.name, total: p.score || 0 }));

    const summary: FinalSummary = {
      totals: playerScores,
      winners,
      players: players.map(p => ({ id: p.id, name: p.name }))
    };

    setFinalSummary(summary);
    setShowFinalResultsState(true);

    if (isMultiplayer && isHost) {
      channelRef.current?.send({
        type: "broadcast",
        event: "final_results",
        payload: { summary }
      });
    }

    playWin();
  };

  const startNextRound = () => {
    setGamePhase("playing");
    setTimeLeft(settings.roundTime);
    setVotingTimeLeft(0);
    setRoundData(null);
    setResults({});
    setVotes({});
    setAllPlayersAnswers({});
    setShowResults(false);
    setResultsOpen(false);
    setEarlySubmitCount(0);
    
    // Generate new round data
    const categoryList = CATEGORY_LISTS.find(l => l.id === settings.categoryList) || generateRandomList();
    const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    
    const newRoundData: RoundData = {
      letter,
      categories: categoryList.categories.slice(0, 12),
      answers: {},
      submitted: false
    };
    
    setRoundData(newRoundData);
    
    if (isMultiplayer) {
      broadcastGameState({
        phase: "playing",
        roundData: newRoundData,
        timeLeft: settings.roundTime,
        votingTimeLeft: 0,
        currentRound: currentRound,
        showResults: false,
        earlySubmitCount: 0
      });
    }
    
    startTimer();
  };

  const usePowerUp = (powerUpId: string) => {
    if (!currentPlayer || !settings.enablePowerUps) return;
    
    const powerUp = currentPlayer.powerUps?.find(p => p.id === powerUpId);
    if (!powerUp || powerUp.uses >= powerUp.maxUses) {
      toast({ 
        title: "Power-up Unavailable", 
        description: "This power-up has no uses remaining.",
        variant: "destructive"
      });
      return;
    }

    // Apply power-up effect
    switch (powerUp.type) {
      case "time_freeze":
        if (timeLeft > 0 && gamePhase === "playing") {
          setIsPaused(true);
          setTimeout(() => setIsPaused(false), 10000);
          toast({ 
            title: "⏸️ Time Freeze!", 
            description: "Timer paused for 10 seconds",
            className: "border-blue-500 bg-blue-50 dark:bg-blue-950"
          });
        }
        break;
      case "peek":
        setPeekMode(true);
        setTimeout(() => setPeekMode(false), 15000);
        toast({ 
          title: "👁️ Peek Mode!", 
          description: "See other players' answers for 15 seconds",
          className: "border-purple-500 bg-purple-50 dark:bg-purple-950"
        });
        break;
      case "lightning":
        if (roundData && gamePhase === "playing") {
          const emptyIndex = roundData.categories.findIndex((_, i) => !roundData.answers[i]);
          if (emptyIndex !== -1) {
            const autoAnswer = generateAutoAnswer(roundData.categories[emptyIndex], roundData.letter);
            setRoundData(prev => prev ? {
              ...prev,
              answers: { ...prev.answers, [emptyIndex]: autoAnswer }
            } : null);
            toast({ 
              title: "⚡ Lightning Strike!", 
              description: `Auto-filled "${autoAnswer}" for ${roundData.categories[emptyIndex]}!`,
              className: "border-yellow-500 bg-yellow-50 dark:bg-yellow-950"
            });
          } else {
            toast({ 
              title: "Lightning Fizzled", 
              description: "All categories already have answers!",
              variant: "destructive"
            });
            return; // Don't consume the power-up
          }
        }
        break;
      case "double_points":
        // Add temporary double points effect
        setActivePowerUps(prev => new Set([...prev, "double_points"]));
        toast({ 
          title: "🔥 Double Points!", 
          description: "Your next valid answers are worth double points!",
          className: "border-orange-500 bg-orange-50 dark:bg-orange-950"
        });
        break;
      case "shield":
        // Add temporary shield effect
        setActivePowerUps(prev => new Set([...prev, "shield"]));
        toast({ 
          title: "🛡️ Shield Active!", 
          description: "Protected from disqualifications this round!",
          className: "border-green-500 bg-green-50 dark:bg-green-950"
        });
        break;
    }

    // Update power-up usage
    const updatedPowerUps = currentPlayer.powerUps?.map(p => 
      p.id === powerUpId ? { ...p, uses: p.uses + 1 } : p
    ) || [];

    setCurrentPlayer(prev => prev ? { ...prev, powerUps: updatedPowerUps } : null);
    
    // Update presence with new power-up state
    if (isMultiplayer && channelRef.current) {
      channelRef.current.track({
        name: playerName,
        isHost: roomCreatorId === playerId,
        isReady: currentPlayer.isReady,
        score: currentPlayer.score || 0,
        streak: currentPlayer.streak || 0,
        powerUps: updatedPowerUps,
        achievements: currentPlayer.achievements || [],
        joinTs: joinTsRef.current,
        roomCreatorId: roomCreatorId
      });
    }
    
    // Visual feedback
    setActivePowerUps(prev => new Set([...prev, powerUpId]));
    setTimeout(() => {
      setActivePowerUps(prev => {
        const newSet = new Set(prev);
        newSet.delete(powerUpId);
        return newSet;
      });
    }, 3000);
  };

  const generateAutoAnswer = (category: string, letter: string): string => {
    // Simple auto-answer generation based on category and letter
    const answers: Record<string, string[]> = {
      "Things you eat": ["Apple", "Banana", "Carrot", "Donut", "Egg"],
      "Animals": ["Ant", "Bear", "Cat", "Dog", "Elephant"],
      "Colors": ["Azure", "Blue", "Crimson", "Dark", "Emerald"],
      // Add more categories as needed
    };
    
    const categoryAnswers = answers[category] || ["Answer"];
    const validAnswers = categoryAnswers.filter(a => a.startsWith(letter));
    return validAnswers[Math.floor(Math.random() * validAnswers.length)] || `${letter}...`;
  };

  const makeRpsChoice = (choice: string) => {
    if (!channelRef.current) return;
    
    channelRef.current.send({
      type: "broadcast",
      event: "rps_choice",
      payload: { playerId, choice }
    });
    
    setRpsChoices(prev => ({ ...prev, [playerId]: choice }));
    
    // Check if all tied players have made choices
    const allChoices = { ...rpsChoices, [playerId]: choice };
    if (Object.keys(allChoices).length === tiedPlayers.length && isHost) {
      // Determine winner
      const choices = Object.entries(allChoices);
      const winner = determineRpsWinner(choices);
      
      channelRef.current.send({
        type: "broadcast",
        event: "rps_results",
        payload: { 
          winner: winner.name,
          winnerId: winner.id
        }
      });
      
      setRpsResults(winner.name);
    }
  };
  
  const determineRpsWinner = (choices: [string, string][]): { id: string; name: string } => {
    // Simple rock paper scissors logic for 2+ players
    const playerChoices = choices.map(([id, choice]) => ({ 
      id, 
      choice, 
      name: players.find(p => p.id === id)?.name || "Player" 
    }));
    
    // For simplicity, if all choices are the same, pick random
    const uniqueChoices = [...new Set(playerChoices.map(p => p.choice))];
    if (uniqueChoices.length === 1) {
      const randomIndex = Math.floor(Math.random() * playerChoices.length);
      return { id: playerChoices[randomIndex].id, name: playerChoices[randomIndex].name };
    }
    
    // Standard RPS logic for 2 players, or pick winner based on choice priority
    if (uniqueChoices.includes("rock") && uniqueChoices.includes("scissors")) {
      const winner = playerChoices.find(p => p.choice === "rock");
      return { id: winner!.id, name: winner!.name };
    }
    if (uniqueChoices.includes("paper") && uniqueChoices.includes("rock")) {
      const winner = playerChoices.find(p => p.choice === "paper");
      return { id: winner!.id, name: winner!.name };
    }
    if (uniqueChoices.includes("scissors") && uniqueChoices.includes("paper")) {
      const winner = playerChoices.find(p => p.choice === "scissors");
      return { id: winner!.id, name: winner!.name };
    }
    
    // Fallback to random
    const randomIndex = Math.floor(Math.random() * playerChoices.length);
    return { id: playerChoices[randomIndex].id, name: playerChoices[randomIndex].name };
  };

  const copyRoomCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Room code copied!", description: "Share it with friends to invite them." });
    } catch {
      toast({ title: "Failed to copy", description: "Please copy the room code manually." });
    }
  };

  const updateAnswer = (categoryIndex: number, value: string) => {
    setRoundData(prev => prev ? {
      ...prev,
      answers: { ...prev.answers, [categoryIndex]: value }
    } : null);
  };

  const vote = (key: string) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: "broadcast",
      event: "vote",
      payload: { key, voterId: playerId }
    });
    playVote();
  };

  // Render functions
  const renderLobby = () => (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        {/* Enhanced Room Info with gradient header */}
        <Card className="glass-panel border overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg">
                    {isMultiplayer ? <Users className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      {isMultiplayer ? `Room ${roomCode}` : "Solo Adventure"}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {isMultiplayer ? `${players.length}/${settings.maxPlayers} warriors assembled` : "Master your skills"}
                    </p>
                  </div>
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {isMultiplayer && (
                    <Button variant="outline" size="sm" onClick={copyRoomCode} className="transition-transform hover:scale-105">
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copied!" : "Share"}
                  </Button>
                )}
                {(isHost || (!isMultiplayer) || (roomCreatorId === playerId)) && (
                  <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} className="transition-transform hover:scale-105">
                    <Settings className="w-4 h-4" />
                    Settings
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Enhanced Players List */}
            <div className="space-y-3">
              {players.map((player, index) => (
                <div key={player.id} className="group relative p-4 rounded-xl border hover:shadow-md transition-all duration-200 animate-fade-in" style={{animationDelay: `${index * 100}ms`}}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar className="w-12 h-12 ring-2 ring-white/20 shadow-lg">
                          <AvatarFallback style={{ backgroundImage: gradientFromString(player.name), color: "white" }} className="text-lg font-bold">
                            {initialsFromName(player.name)}
                          </AvatarFallback>
                        </Avatar>
                        {player.isHost && (
                          <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full p-1 animate-pulse">
                            <Crown className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-lg">{player.name}</span>
                          {player.streak && player.streak > 0 && (
                            <Badge variant="secondary" className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 animate-pulse">
                              <Flame className="w-3 h-3 mr-1" />
                              {player.streak} streak!
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            <span className="font-medium">{player.score || 0} points</span>
                          </div>
                          {player.achievements && player.achievements.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-yellow-500" />
                              <span>{player.achievements.length} achievements</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isMultiplayer && (
                        <Badge 
                          variant={player.isReady ? "default" : "secondary"}
                          className={`transition-all duration-300 ${
                            player.isReady 
                              ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white animate-pulse" 
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            {player.isReady ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {player.isReady ? "Ready!" : "Waiting"}
                          </div>
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Enhanced Ready/Start Controls */}
            <div className="mt-8 flex items-center justify-center">
              {isMultiplayer && !isHost && (
                <Button 
                  onClick={toggleReady} 
                  variant={currentPlayer?.isReady ? "secondary" : "default"} 
                  className="transition-colors hover:scale-105"
                    currentPlayer?.isReady 
                      ? "bg-gradient-to-r from-red-500 to-pink-500 text-white hover:from-red-600 hover:to-pink-600" 
                      : "bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 animate-pulse"
                  }`}
                >
                  {currentPlayer?.isReady ? (
                    <>
                      <StopCircle className="w-5 h-5 mr-2" />
                      Cancel Ready
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      Ready to Battle!
                    </>
                  )}
                </Button>
              )}
              {((!isMultiplayer && isHost) || (isMultiplayer && roomCreatorId === playerId)) && (
                <Button 
                  onClick={startMatch} 
                  className="px-12 py-4 text-xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white hover:scale-110 hover:shadow-2xl transition-all duration-300 animate-pulse border-0"
                >
                  <Play className="w-6 h-6 mr-3" />
                  Begin Adventure!
                  <Sparkles className="w-6 h-6 ml-3" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Game Preview */}
        <Card className="glass-panel border overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-green-400 to-blue-500"></div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-500" />
              Battle Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Timer className="w-3 h-3" />
                  Battle Duration
                </div>
                <div className="text-lg font-bold text-blue-600">{settings.roundTime}s per round</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Trophy className="w-3 h-3" />
                  Total Rounds
                </div>
                <div className="text-lg font-bold text-purple-600">{settings.maxRounds} battles</div>
              </div>
              <div className="space-y-1 col-span-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="w-3 h-3" />
                  Category Pack
                </div>
                <div className="text-lg font-bold text-green-600">
                  {CATEGORY_LISTS.find(l => l.id === settings.categoryList)?.name || "Random Mix"}
                </div>
              </div>
            </div>
            
            {/* Feature indicators */}
            <div className="mt-4 flex flex-wrap gap-2">
              {settings.enablePowerUps && (
                <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0">
                  <Zap className="w-3 h-3 mr-1" />
                  Power-ups Active
                </Badge>
              )}
              {settings.allowEarlySubmit && (
                <Badge className="bg-gradient-to-r from-blue-400 to-cyan-500 text-white border-0">
                  <FastForward className="w-3 h-3 mr-1" />
                  Quick Submit
                </Badge>
              )}
              {settings.enableAchievements && (
                <Badge className="bg-gradient-to-r from-purple-400 to-pink-500 text-white border-0">
                  <Star className="w-3 h-3 mr-1" />
                  Achievements
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chat Panel */}
      {/* Round Transition */}
      {showRoundTransition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-panel p-8 text-center animate-scale-in">
            <h2 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent mb-4">
              {transitionText}
            </h2>
            <div className="w-16 h-16 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      )}

      {isMultiplayer && (
        <div className="space-y-6">
          <ChatPanel
            messages={chatMessages}
            onSend={sendChatMessage}
            currentName={playerName}
            hostId={players.find(p => p.isHost)?.id}
            streaks={players.reduce((acc, p) => ({ ...acc, [p.id]: p.streak || 0 }), {})}
          />
        </div>
      )}
    </div>
  );

  const renderGame = () => {
    if (!roundData) return null;

    const progress = ((settings.roundTime - timeLeft) / settings.roundTime) * 100;
    const isTimeRunningOut = timeLeft <= 30;
    const canShowEarlyResults = timeLeft <= settings.showResultsAt || showResults;

    return (
      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3 space-y-6">
          {/* Game Header */}
          <Card className="glass-panel border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg">
                      {roundData.letter}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">Letter</div>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Round {currentRound + 1}/{settings.maxRounds}</h2>
                    <p className="text-muted-foreground">Find words starting with "{roundData.letter}"</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Timer */}
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${isTimeRunningOut ? 'text-red-500 animate-pulse' : ''}`}>
                      {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </div>
                    <div className="text-sm text-muted-foreground">Time Left</div>
                  </div>
                  
                  {/* Host Controls */}
                  {isHost && gamePhase === "playing" && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={isPaused ? resumeTimer : pauseTimer}
                        className="glass-card"
                      >
                        {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowStopDialog(true)}
                        className="glass-card text-red-600 hover:text-red-700"
                      >
                        <StopCircle className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => endGame()}
                        className="glass-card text-yellow-600 hover:text-yellow-700"
                      >
                        End Game
                      </Button>
                    </div>
                  )}
                  
                  {/* Results Controls */}
                  {gamePhase === "results" && !resultsOpen && votingTimeLeft > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setResultsOpen(true)}
                      className="glass-card text-blue-600 hover:text-blue-700"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Results
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Progress Bar */}
              <Progress value={progress} className="h-2" />
              
              {/* Early Submit Info */}
              {settings.allowEarlySubmit && !roundData.submitted && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {earlySubmitCount > 0 && `${earlySubmitCount} player(s) submitted early`}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={submitEarly}
                    disabled={!canSubmitEarly || roundData.submitted}
                    className="glass-card"
                  >
                    <FastForward className="w-4 h-4 mr-2" />
                    Submit Early
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Power-ups */}
          {settings.enablePowerUps && currentPlayer?.powerUps && (
            <Card className="border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 bg-primary rounded-lg">
                    <Zap className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <span className="font-semibold">
                    Power-ups
                  </span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">Use special abilities to gain an advantage</p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {currentPlayer.powerUps.map((powerUp, index) => {
                    const isActive = activePowerUps.has(powerUp.id);
                    const isAvailable = powerUp.uses < powerUp.maxUses;
                    const remaining = powerUp.maxUses - powerUp.uses;
                    
                    return (
                      <div key={powerUp.id} className="group">
                        <Button
                          variant="outline"
                          onClick={() => usePowerUp(powerUp.id)}
                          disabled={!isAvailable || isActive}
                          className={`w-full p-4 h-auto transition-colors ${
                            isActive 
                              ? 'bg-primary/10 border-primary' 
                              : isAvailable 
                                ? 'hover:bg-muted' 
                                : 'opacity-50 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex flex-col items-center gap-2 w-full">
                            <div className={`p-2 rounded-lg ${
                              isAvailable ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground text-muted'
                            }`}>
                              {powerUp.type === "time_freeze" && <Timer className="w-5 h-5" />}
                              {powerUp.type === "double_points" && <Star className="w-5 h-5" />}
                              {powerUp.type === "peek" && <Eye className="w-5 h-5" />}
                              {powerUp.type === "shield" && <Shield className="w-5 h-5" />}
                              {powerUp.type === "lightning" && <Zap className="w-5 h-5" />}
                            </div>
                            
                            <div className="text-center">
                              <div className="font-semibold text-sm">{powerUp.name}</div>
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {powerUp.description}
                              </div>
                            </div>
                            
                            <Badge 
                              variant={remaining > 0 ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {remaining > 0 ? `${remaining} uses` : 'Depleted'}
                            </Badge>
                          </div>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Categories */}
          <Card className="border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Categories
                </CardTitle>
                {roundData.submitted && (
                  <Badge variant="secondary">
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Submitted
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {roundData.categories.map((category, index) => {
                  const hasAnswer = roundData.answers[index]?.trim();
                  const isComplete = hasAnswer && hasAnswer.toLowerCase().startsWith(roundData.letter.toLowerCase());
                  
                  return (
                    <div key={index} className="group space-y-3">
                      <Label className="text-sm font-bold flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isComplete 
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' 
                            : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
                        }`}>
                          {index + 1}
                        </div>
                        {category}
                      </Label>
                      <div className="relative">
                        <Input
                          value={roundData.answers[index] || ""}
                          onChange={(e) => updateAnswer(index, e.target.value)}
                          placeholder={`${roundData.letter}...`}
                          disabled={roundData.submitted || isPaused}
                          className={`transition-colors ${
                            isComplete 
                              ? 'border-green-500 bg-green-50 dark:bg-green-950/20' 
                              : hasAnswer 
                                ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20' 
                                : ''
                          }`}
                        />
                        {isComplete && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          </div>
                        )}
                        {hasAnswer && !isComplete && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Progress indicator */}
              <div className="mt-6 p-4 bg-muted/30 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progress</span>
                  <span className="text-sm font-semibold">
                    {Object.values(roundData.answers).filter(a => a?.trim()).length}/{roundData.categories.length}
                  </span>
                </div>
                <Progress 
                  value={(Object.values(roundData.answers).filter(a => a?.trim()).length / roundData.categories.length) * 100}
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Players Status */}
          <Card className="border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Players ({players.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {players.map(player => (
                <div key={player.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback style={{ backgroundImage: gradientFromString(player.name), color: "white" }}>
                        {initialsFromName(player.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{player.name}</span>
                    {player.isHost && <Crown className="w-3 h-3 text-yellow-500" />}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {player.score || 0} pts
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
              hostId={players.find(p => p.isHost)?.id}
              streaks={players.reduce((acc, p) => ({ ...acc, [p.id]: p.streak || 0 }), {})}
            />
          )}

          {/* Sound Toggle */}
          <Card className="glass-panel border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  <span className="text-sm">Sound Effects</span>
                </div>
                <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const renderVotingScreen = () => {
    if (!resultsOpen || !roundData) return null;

    return (
      <ResultsOverlay
        open={resultsOpen}
        onClose={() => {
          setResultsOpen(false);
          // Don't change gamePhase - let the game continue showing in background
        }}
        results={results}
        presentCount={players.length}
        votes={votes}
        onVote={vote}
        categories={roundData.categories}
        localPlayerId={playerId}
        voteTimeLeft={votingTimeLeft}
        players={players}
      />
    );
  };

  return (
    <>
      <Helmet>
        <title>
          {gamePhase === "lobby" 
            ? (isMultiplayer ? `Room ${roomCode} | Scattergories Online` : "Solo Game | Scattergories Online")
            : `Round ${currentRound + 1} | Scattergories Online`
          }
        </title>
        <meta name="description" content="Play Scattergories online with friends or solo. Real-time multiplayer word game." />
      </Helmet>

      <div className="relative min-h-screen card-game-bg">
        <Aurora />
        <Particles />
        
        <div className="relative z-10 container py-8">
          {gamePhase === "lobby" && renderLobby()}
          {gamePhase === "playing" && renderGame()}
          {gamePhase === "results" && !resultsOpen && renderGame()}
          {renderVotingScreen()}
        </div>

        {/* Settings Dialog */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent className="glass-panel border-0 max-w-xl">
            <DialogHeader>
              <DialogTitle>Game Settings</DialogTitle>
              <DialogDescription>Customize your game experience</DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="general" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="gameplay">Gameplay</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>
              
              <TabsContent value="general" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Round Time (seconds)</Label>
                    <Select value={settings.roundTime.toString()} onValueChange={(v) => setSettings(prev => ({ ...prev, roundTime: parseInt(v) }))}>
                      <SelectTrigger className="glass-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="60">1 minute</SelectItem>
                        <SelectItem value="90">1.5 minutes</SelectItem>
                        <SelectItem value="120">2 minutes</SelectItem>
                        <SelectItem value="180">3 minutes</SelectItem>
                        <SelectItem value="300">5 minutes</SelectItem>
                        <SelectItem value="30">30 seconds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Max Rounds</Label>
                    <Select value={settings.maxRounds.toString()} onValueChange={(v) => setSettings(prev => ({ ...prev, maxRounds: parseInt(v) }))}>
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
                </div>
                
                <div className="space-y-2">
                  <Label>Category List</Label>
                  <Select value={settings.categoryList} onValueChange={(v) => setSettings(prev => ({ ...prev, categoryList: v }))}>
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
              </TabsContent>
              
              <TabsContent value="gameplay" className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Allow Early Submit</Label>
                      <p className="text-sm text-muted-foreground">Players can submit before timer ends</p>
                    </div>
                    <Switch 
                      checked={settings.allowEarlySubmit}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, allowEarlySubmit: checked }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Show Results At (seconds remaining)</Label>
                    <Select value={settings.showResultsAt.toString()} onValueChange={(v) => setSettings(prev => ({ ...prev, showResultsAt: parseInt(v) }))}>
                      <SelectTrigger className="glass-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">When timer ends</SelectItem>
                        <SelectItem value="30">30 seconds</SelectItem>
                        <SelectItem value="60">60 seconds</SelectItem>
                        <SelectItem value="90">90 seconds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Voting Time (seconds)</Label>
                    <Select value={settings.votingTime.toString()} onValueChange={(v) => setSettings(prev => ({ ...prev, votingTime: parseInt(v) }))}>
                      <SelectTrigger className="glass-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 seconds</SelectItem>
                        <SelectItem value="30">30 seconds</SelectItem>
                        <SelectItem value="45">45 seconds</SelectItem>
                        <SelectItem value="60">60 seconds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="advanced" className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Power-ups</Label>
                      <p className="text-sm text-muted-foreground">Special abilities during gameplay</p>
                    </div>
                    <Switch 
                      checked={settings.enablePowerUps}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enablePowerUps: checked }))}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-submit on Timeout</Label>
                      <p className="text-sm text-muted-foreground">Automatically submit when timer ends</p>
                    </div>
                    <Switch 
                      checked={settings.autoSubmitOnTimeout}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, autoSubmitOnTimeout: checked }))}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-submit on Early Submit</Label>
                      <p className="text-sm text-muted-foreground">Automatically submit when players submit early</p>
                    </div>
                    <Switch 
                      checked={settings.autoSubmitOnEarlySubmit}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, autoSubmitOnEarlySubmit: checked }))}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-submit on Stop</Label>
                      <p className="text-sm text-muted-foreground">Automatically submit when host stops round</p>
                    </div>
                    <Switch 
                      checked={settings.autoSubmitOnStop}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, autoSubmitOnStop: checked }))}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Achievements</Label>
                      <p className="text-sm text-muted-foreground">Unlock rewards for performance</p>
                    </div>
                    <Switch 
                      checked={settings.enableAchievements}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enableAchievements: checked }))}
                    />
                  </div>
                  
                  {isMultiplayer && (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Public Room</Label>
                          <p className="text-sm text-muted-foreground">Others can discover and join</p>
                        </div>
                        <Switch 
                          checked={settings.publicRoom}
                          onCheckedChange={(checked) => setSettings(prev => ({ ...prev, publicRoom: checked }))}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Max Players</Label>
                        <Select value={settings.maxPlayers.toString()} onValueChange={(v) => setSettings(prev => ({ ...prev, maxPlayers: parseInt(v) }))}>
                          <SelectTrigger className="glass-card">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2">2 Players</SelectItem>
                            <SelectItem value="4">4 Players</SelectItem>
                            <SelectItem value="6">6 Players</SelectItem>
                            <SelectItem value="8">8 Players</SelectItem>
                            <SelectItem value="12">12 Players</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>
            </Tabs>
            
            <DialogFooter>
              <Button onClick={() => setShowSettings(false)} className="glass-card">
                Save Settings
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stop Round Confirmation */}
        <AlertDialog open={showStopDialog} onOpenChange={setShowStopDialog}>
          <AlertDialogContent className="glass-panel border-0">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                Stop Current Round?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will immediately end the current round for all players. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="glass-card">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={stopRound} className="glass-card bg-red-600 hover:bg-red-700">
                Stop Round
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Final Results */}
        {finalSummary && (
          <FinalScoreboard
            open={showFinalResultsState}
            onClose={() => {
              // Return to lobby for all players
              if (isHost && isMultiplayer) {
                channelRef.current?.send({
                  type: "broadcast",
                  event: "return_to_lobby",
                  payload: {}
                });
              }
              
              setShowFinalResultsState(false);
              setGamePhase("lobby");
              setCurrentRound(0);
              setFinalSummary(null);
              setResults({});
              setVotes({});
              setShowResults(false);
              // Reset player scores and ready state
              setPlayers(prev => prev.map(p => ({ ...p, score: 0, isReady: false })));
            }}
            summary={finalSummary}
            isHost={isHost}
            onPlayAgain={() => {
              // Reset game for new match
              if (isHost && isMultiplayer) {
                channelRef.current?.send({
                  type: "broadcast",
                  event: "return_to_lobby", 
                  payload: {}
                });
              }
              
              setShowFinalResultsState(false);
              setGamePhase("lobby");
              setCurrentRound(0);
              setFinalSummary(null);
              setResults({});
              setVotes({});
              setShowResults(false);
              // Reset player scores and ready state for new game
              setPlayers(prev => prev.map(p => ({ ...p, score: 0, isReady: false })));
            }}
          />
        )}
      </div>

      {/* Rock Paper Scissors Tiebreaker */}
      <Dialog open={showRockPaperScissors} onOpenChange={() => {}}>
        <DialogContent className="glass-panel border-0 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl text-center mb-4 flex items-center justify-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-500" />
              Tiebreaker!
            </DialogTitle>
            <DialogDescription className="text-center">
              Multiple players tied! Choose your weapon:
            </DialogDescription>
          </DialogHeader>
          
        {rpsResults ? (
          <div className="text-center py-8">
            <div className="text-4xl font-bold text-green-600 mb-2">
              🎉 {rpsResults} Wins! 🎉
            </div>
            <p className="text-muted-foreground">Tiebreaker complete</p>
            <div className="mt-4">
              <Button 
                onClick={() => {
                  setShowRockPaperScissors(false);
                  // Return to lobby after tiebreaker
                  if (isHost && isMultiplayer) {
                    channelRef.current?.send({
                      type: "broadcast",
                      event: "return_to_lobby",
                      payload: {}
                    });
                  }
                  setGamePhase("lobby");
                  setCurrentRound(0);
                  setPlayers(prev => prev.map(p => ({ ...p, score: 0, isReady: false })));
                }}
                className="glass-card"
              >
                Return to Lobby
              </Button>
            </div>
          </div>
        ) : (
            <div className="grid grid-cols-3 gap-4 py-4">
              {["rock", "paper", "scissors"].map(choice => (
                <Button
                  key={choice}
                  variant={rpsChoices[playerId] === choice ? "default" : "outline"}
                  className="h-20 text-2xl glass-card"
                  onClick={() => makeRpsChoice(choice)}
                  disabled={!!rpsChoices[playerId]}
                >
                  {choice === "rock" && "🪨"}
                  {choice === "paper" && "📄"}
                  {choice === "scissors" && "✂️"}
                  <br />
                  <span className="text-sm capitalize">{choice}</span>
                </Button>
              ))}
            </div>
          )}
          
          <div className="text-center text-sm text-muted-foreground">
            {Object.keys(rpsChoices).length}/{tiedPlayers.length} players have chosen
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}