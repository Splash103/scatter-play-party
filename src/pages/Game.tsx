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
  categoryList: "classic-1"
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
  const { playRoundStart, playVote, playWin } = useGameSounds(soundEnabled);
  const playerName = localStorage.getItem("profileName") || "Player";
  const playerId = useMemo(() => `player_${Date.now()}_${Math.random().toString(36).slice(2)}`, []);

  // Room advertising for public rooms
  usePublicRoomAdvertiser({
    enabled: isMultiplayer && isHost && settings.publicRoom,
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
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const playerList = Object.entries(state).map(([id, presences]) => {
          const presence = presences[0] as any;
          return {
            id,
            name: presence.name || "Player",
            isHost: presence.isHost || false,
            isReady: presence.isReady || false,
            score: presence.score || 0,
            streak: presence.streak || 0,
            powerUps: presence.powerUps || [...POWER_UPS],
            achievements: presence.achievements || []
          };
        });
        setPlayers(playerList);
        
        // Store room creator to ensure only they are host
        if (!roomCreatorId) {
          const hostPlayer = playerList.find(p => p.isHost);
          if (hostPlayer) {
            setRoomCreatorId(hostPlayer.id);
          } else if (playerList.length === 1) {
            // First player becomes room creator and host
            setRoomCreatorId(playerId);
            setIsHost(true);
          }
        }
        
        const currentPlayerData = playerList.find(p => p.id === playerId);
        if (currentPlayerData) {
          setCurrentPlayer(currentPlayerData);
          // Only room creator is host
          setIsHost(roomCreatorId === playerId);
        }
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
      .on("broadcast", { event: "return_to_lobby" }, () => {
        // Return all players to lobby
        setGamePhase("lobby");
        setCurrentRound(0);
        setShowFinalResultsState(false);
        setFinalSummary(null);
        setResults({});
        setVotes({});
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
          // Determine if this player should be host
          const shouldBeHost = !roomCreatorId || roomCreatorId === playerId;
          if (shouldBeHost && !roomCreatorId) {
            setRoomCreatorId(playerId);
          }
          
          await channel.track({
            name: playerName,
            isHost: shouldBeHost,
            isReady: false,
            score: 0,
            streak: 0,
            powerUps: [...POWER_UPS],
            achievements: []
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
    await channelRef.current.track({
      ...currentPlayer,
      isReady: newReady
    });
  };

  const startMatch = () => {
    if (!isHost) return;
    
    const readyPlayers = players.filter(p => p.isReady || p.isHost);
    if (readyPlayers.length < 1) {
      toast({
        title: "Cannot start",
        description: "At least one player must be ready."
      });
      return;
    }

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

  const submitEarly = () => {
    if (!canSubmitEarly || !roundData) return;
    
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
    
    // Mark as submitted for this player
    setRoundData(prev => prev ? { ...prev, submitted: true } : null);
    
    // If host submits early, force all players to submit immediately
    if (isHost) {
      forceSubmitAll();
    } else {
      // Non-host players can submit early individually
      const totalPlayers = isMultiplayer ? players.length : 1;
      const threshold = Math.ceil(totalPlayers / 2);
      
      if (newCount >= threshold) {
        // Majority submitted early, end the round
        endRound();
      }
    }
  };

  const forceSubmitAll = () => {
    if (!isHost) return;
    
    if (isMultiplayer) {
      channelRef.current?.send({
        type: "broadcast",
        event: "force_submit_all",
        payload: { hostId: playerId }
      });
    }
    
    // Collect all current answers (even if incomplete)
    if (roundData) {
      const allResults: Record<string, any> = {};
      
      // Add host's answers
      allResults[playerId] = {
        playerId,
        playerName,
        letter: roundData.letter,
        answers: roundData.answers,
        categories: roundData.categories
      };
      
      // In multiplayer, other players' results will be handled via broadcast
      if (!isMultiplayer) {
        setResults(allResults);
        setVotingTimeLeft(settings.votingTime);
        setGamePhase("voting");
      }
    }
  };

  const endRound = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setShowResults(true);
    setGamePhase("results");
    setVotingTimeLeft(settings.votingTime); // Use configured voting time
    
    if (isMultiplayer && isHost) {
      // Collect all results and broadcast
      const roundResults = {
        results: Object.fromEntries(
          players.map(p => [p.id, {
            playerId: p.id,
            name: p.name,
            letter: roundData?.letter || null,
            answers: roundData?.answers || {}
          }])
        ),
        votes: votes
      };
      
      channelRef.current?.send({
        type: "broadcast",
        event: "round_results",
        payload: roundResults
      });
    }

    // Check if game should end (currentRound is 0-indexed, so check >= maxRounds - 1)
    if (currentRound >= settings.maxRounds - 1) {
      setTimeout(() => endGame(), 3000);
    } else {
      // Move to next round after voting
      setTimeout(() => {
        if (isHost) {
          nextRound();
        }
      }, settings.votingTime * 1000); // Wait for voting to complete
    }
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
    setVotingTimeLeft(0);
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
    const nextRound = currentRound + 1;
    setCurrentRound(nextRound);
    setGamePhase("playing");
    setTimeLeft(settings.roundTime);
    setVotingTimeLeft(0);
    setRoundData(null);
    setResults({});
    setVotes({});
    setShowResults(false);
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
        currentRound: nextRound,
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
        achievements: currentPlayer.achievements || []
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
        {/* Room Info */}
        <Card className="glass-panel border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {isMultiplayer ? <Users className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  {isMultiplayer ? `Room ${roomCode}` : "Solo Game"}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {isMultiplayer ? `${players.length}/${settings.maxPlayers} players` : "Practice mode"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isMultiplayer && (
                  <Button variant="outline" size="sm" onClick={copyRoomCode} className="glass-card">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                )}
                {isHost && (
                  <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} className="glass-card">
                    <Settings className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Players List */}
            <div className="space-y-3">
              {players.map(player => (
                <div key={player.id} className="flex items-center justify-between p-3 rounded-lg glass-card border">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback style={{ backgroundImage: gradientFromString(player.name), color: "white" }}>
                        {initialsFromName(player.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{player.name}</span>
                        {player.isHost && <Crown className="w-4 h-4 text-yellow-500" />}
                        {player.streak && player.streak > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            <Flame className="w-3 h-3 mr-1" />
                            {player.streak}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Score: {player.score || 0}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isMultiplayer && (
                      <Badge variant={player.isReady ? "default" : "secondary"}>
                        {player.isReady ? "Ready" : "Not Ready"}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Ready/Start Controls */}
            <div className="mt-6 flex items-center justify-between">
              {isMultiplayer && !isHost && (
                <Button onClick={toggleReady} variant={currentPlayer?.isReady ? "secondary" : "default"} className="glass-card">
                  {currentPlayer?.isReady ? "Not Ready" : "Ready Up"}
                </Button>
              )}
              {isHost && (
                <Button onClick={startMatch} className="glass-card hover:scale-105">
                  <Play className="w-4 h-4 mr-2" />
                  Start Match
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Game Preview */}
        <Card className="glass-panel border">
          <CardHeader>
            <CardTitle>Game Settings</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Round Time:</span>
              <span className="ml-2 font-medium">{settings.roundTime}s</span>
            </div>
            <div>
              <span className="text-muted-foreground">Max Rounds:</span>
              <span className="ml-2 font-medium">{settings.maxRounds}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Category List:</span>
              <span className="ml-2 font-medium">
                {CATEGORY_LISTS.find(l => l.id === settings.categoryList)?.name || "Random"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Power-ups:</span>
              <span className="ml-2 font-medium">{settings.enablePowerUps ? "Enabled" : "Disabled"}</span>
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
                  {isHost && (
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
            <Card className="glass-panel border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  Power-ups
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  {currentPlayer.powerUps.map(powerUp => (
                    <Button
                      key={powerUp.id}
                      variant="outline"
                      size="sm"
                      onClick={() => usePowerUp(powerUp.id)}
                      disabled={powerUp.uses >= powerUp.maxUses || activePowerUps.has(powerUp.id)}
                      className={`glass-card ${activePowerUps.has(powerUp.id) ? 'animate-pulse bg-yellow-100' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        {powerUp.type === "time_freeze" && <Timer className="w-4 h-4" />}
                        {powerUp.type === "double_points" && <Star className="w-4 h-4" />}
                        {powerUp.type === "peek" && <Eye className="w-4 h-4" />}
                        {powerUp.type === "shield" && <Shield className="w-4 h-4" />}
                        {powerUp.type === "lightning" && <Zap className="w-4 h-4" />}
                        <span>{powerUp.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {powerUp.maxUses - powerUp.uses}
                        </Badge>
                      </div>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Categories */}
          <Card className="glass-panel border">
            <CardHeader>
              <CardTitle>Categories</CardTitle>
              {roundData.submitted && (
                <Badge variant="secondary" className="w-fit">
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Submitted
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {roundData.categories.map((category, index) => (
                  <div key={index} className="space-y-2">
                    <Label className="text-sm font-medium">
                      {index + 1}. {category}
                    </Label>
                    <Input
                      value={roundData.answers[index] || ""}
                      onChange={(e) => updateAnswer(index, e.target.value)}
                      placeholder={`${roundData.letter}...`}
                      disabled={roundData.submitted || isPaused}
                      className="glass-card"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Players Status */}
          <Card className="glass-panel border">
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
    if (!showResults || !roundData) return null;

    // Create mock results for all players with their current answers
    const mockResults = Object.fromEntries(
      players.map(p => [p.id, {
        playerId: p.id,
        name: p.name,
        letter: roundData.letter,
        answers: p.id === playerId ? roundData.answers : {} // Only show current player's answers for now
      }])
    );

    return (
      <ResultsOverlay
        open={showResults}
        onClose={(skipEarlyReturn) => {
          if (!skipEarlyReturn) {
            setShowResults(false);
            // Allow viewing results even if closing early
            setTimeout(() => setShowResults(true), 100);
          } else {
            setShowResults(false);
          }
        }}
        results={mockResults}
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