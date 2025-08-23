import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Star, Flame, Target, Zap, Crown } from 'lucide-react';

interface ScoreAnimationProps {
  score: number;
  previousScore: number;
  playerName: string;
  achievements?: Array<{ name: string; icon: string }>;
  isWinner?: boolean;
  showAnimation?: boolean;
}

export const ScoreAnimation: React.FC<ScoreAnimationProps> = ({
  score,
  previousScore,
  playerName,
  achievements = [],
  isWinner = false,
  showAnimation = false
}) => {
  const [animatedScore, setAnimatedScore] = useState(previousScore);
  const [showScoreUp, setShowScoreUp] = useState(false);
  
  const scoreDiff = score - previousScore;

  useEffect(() => {
    if (showAnimation && scoreDiff > 0) {
      setShowScoreUp(true);
      
      // Animate score counting up
      const duration = 1000;
      const steps = 30;
      const increment = scoreDiff / steps;
      let currentStep = 0;
      
      const timer = setInterval(() => {
        currentStep++;
        setAnimatedScore(prev => Math.min(prev + increment, score));
        
        if (currentStep >= steps) {
          clearInterval(timer);
          setAnimatedScore(score);
          setTimeout(() => setShowScoreUp(false), 2000);
        }
      }, duration / steps);
      
      return () => clearInterval(timer);
    }
  }, [showAnimation, scoreDiff, score]);

  return (
    <div className="relative">
      <Card className={`border transition-all duration-300 ${
        isWinner ? 'ring-2 ring-primary shadow-lg' : ''
      }`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isWinner 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary text-secondary-foreground'
              }`}>
                {isWinner ? <Crown className="w-5 h-5" /> : <Trophy className="w-5 h-5" />}
              </div>
              <div>
                <div className="font-semibold text-lg">{playerName}</div>
                <div className="text-sm text-muted-foreground">
                  {achievements.length > 0 && `${achievements.length} achievements`}
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {Math.round(animatedScore)}
              </div>
              <div className="text-sm text-muted-foreground">points</div>
            </div>
          </div>
          
          {/* Achievements */}
          {achievements.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {achievements.slice(0, 3).map((achievement, index) => (
                <Badge 
                  key={index}
                  variant="secondary"
                  className="text-xs"
                >
                  <Star className="w-3 h-3 mr-1" />
                  {achievement.name}
                </Badge>
              ))}
              {achievements.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{achievements.length - 3} more
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Score increase animation */}
      {showScoreUp && scoreDiff > 0 && (
        <div className="absolute -top-6 right-4 animate-fade-in">
          <div className="bg-primary text-primary-foreground px-2 py-1 rounded text-sm font-medium shadow">
            +{scoreDiff}
          </div>
        </div>
      )}
    </div>
  );
};