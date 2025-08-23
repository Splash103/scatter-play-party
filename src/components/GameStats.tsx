import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, Target, Zap, Clock, Star, Flame, Award } from 'lucide-react';

interface GameStatsProps {
  currentScore: number;
  bestScore: number;
  gamesPlayed: number;
  winRate: number;
  averageTime: number;
  streak: number;
  achievements: number;
  powerUpsUsed: number;
}

export const GameStats: React.FC<GameStatsProps> = ({
  currentScore,
  bestScore,
  gamesPlayed,
  winRate,
  averageTime,
  streak,
  achievements,
  powerUpsUsed
}) => {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getStreakColor = (streak: number) => {
    if (streak >= 5) return 'from-red-500 to-orange-500';
    if (streak >= 3) return 'from-orange-500 to-yellow-500';
    if (streak >= 1) return 'from-yellow-500 to-green-500';
    return 'from-gray-400 to-gray-500';
  };

  const getPerformanceRating = () => {
    const rating = (winRate + (currentScore / bestScore || 0) * 100) / 2;
    if (rating >= 80) return { label: 'Legendary', color: 'from-purple-500 to-pink-500' };
    if (rating >= 60) return { label: 'Expert', color: 'from-blue-500 to-cyan-500' };
    if (rating >= 40) return { label: 'Skilled', color: 'from-green-500 to-emerald-500' };
    if (rating >= 20) return { label: 'Apprentice', color: 'from-yellow-500 to-orange-500' };
    return { label: 'Novice', color: 'from-gray-400 to-gray-600' };
  };

  const performance = getPerformanceRating();

  return (
    <Card className="border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="w-5 h-5 text-primary" />
          Player Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Performance Rating */}
        <div className="text-center p-4 bg-muted/30 rounded-lg">
          <div className="text-xl font-bold text-primary">
            {performance.label}
          </div>
          <div className="text-sm text-muted-foreground">Current Rating</div>
        </div>

        {/* Key Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Current Score */}
          <div className="p-3 rounded-lg bg-muted/30 border">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Current Score</span>
            </div>
            <div className="text-xl font-bold">
              {currentScore}
            </div>
          </div>

          {/* Best Score */}
          <div className="p-3 rounded-lg bg-muted/30 border">
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Best Score</span>
            </div>
            <div className="text-xl font-bold">
              {bestScore}
            </div>
          </div>

          {/* Win Rate */}
          <div className="p-3 rounded-lg bg-muted/30 border">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Win Rate</span>
            </div>
            <div className="text-xl font-bold">
              {winRate}%
            </div>
          </div>

          {/* Average Time */}
          <div className="p-3 rounded-lg bg-muted/30 border">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Avg Time</span>
            </div>
            <div className="text-xl font-bold">
              {formatTime(averageTime)}
            </div>
          </div>
        </div>

        {/* Streak Indicator */}
        <div className="p-4 rounded-lg bg-muted/30 border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Win Streak</span>
            </div>
            <Badge variant="secondary">
              {streak > 0 ? `${streak} wins!` : 'No streak'}
            </Badge>
          </div>
          <Progress 
            value={Math.min((streak / 5) * 100, 100)} 
            className="h-2"
          />
          <div className="text-xs text-muted-foreground mt-1">
            {streak < 5 ? `${5 - streak} more wins for fire streak!` : 'You\'re on fire! 🔥'}
          </div>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-2 rounded-lg bg-muted/30">
            <div className="text-lg font-bold">{gamesPlayed}</div>
            <div className="text-xs text-muted-foreground">Games</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/30">
            <div className="text-lg font-bold">{achievements}</div>
            <div className="text-xs text-muted-foreground">Achievements</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/30">
            <div className="text-lg font-bold">{powerUpsUsed}</div>
            <div className="text-xs text-muted-foreground">Power-ups</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};