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
    <Card className="glass-panel border overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="w-5 h-5 text-purple-500" />
          Player Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Performance Rating */}
        <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg">
          <div className={`text-2xl font-black bg-gradient-to-r ${performance.color} bg-clip-text text-transparent`}>
            {performance.label}
          </div>
          <div className="text-sm text-muted-foreground">Current Rating</div>
        </div>

        {/* Key Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Current Score */}
          <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Current Score</span>
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {currentScore}
            </div>
          </div>

          {/* Best Score */}
          <div className="p-3 rounded-lg bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Best Score</span>
            </div>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {bestScore}
            </div>
          </div>

          {/* Win Rate */}
          <div className="p-3 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">Win Rate</span>
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {winRate}%
            </div>
          </div>

          {/* Average Time */}
          <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Avg Time</span>
            </div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {formatTime(averageTime)}
            </div>
          </div>
        </div>

        {/* Streak Indicator */}
        <div className="p-4 rounded-lg bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 border border-orange-200 dark:border-orange-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium">Win Streak</span>
            </div>
            <Badge className={`bg-gradient-to-r ${getStreakColor(streak)} text-white border-0`}>
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