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
      <Card className={`glass-panel border transition-all duration-500 ${
        isWinner ? 'ring-2 ring-yellow-400 shadow-xl animate-pulse' : ''
      }`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${
                isWinner 
                  ? 'bg-gradient-to-br from-yellow-400 to-orange-500 animate-pulse' 
                  : 'bg-gradient-to-br from-blue-500 to-purple-600'
              }`}>
                {isWinner ? <Crown className="w-6 h-6" /> : <Trophy className="w-6 h-6" />}
              </div>
              <div>
                <div className="font-bold text-lg">{playerName}</div>
                <div className="text-sm text-muted-foreground">
                  {achievements.length > 0 && `${achievements.length} achievements`}
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className={`text-3xl font-black ${
                isWinner ? 'text-yellow-500' : 'text-blue-600'
              }`}>
                {Math.round(animatedScore)}
              </div>
              <div className="text-sm text-muted-foreground">points</div>
            </div>
          </div>
          
          {/* Achievements */}
          {achievements.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1">
              {achievements.slice(0, 3).map((achievement, index) => (
                <Badge 
                  key={index}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 text-xs animate-fade-in"
                  style={{ animationDelay: `${index * 200}ms` }}
                >
                  <Star className="w-3 h-3 mr-1" />
                  {achievement.name}
                </Badge>
              ))}
              {achievements.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{achievements.length - 3} more
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Score increase animation */}
      {showScoreUp && scoreDiff > 0 && (
        <div className="absolute -top-8 right-4 animate-fade-in">
          <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg animate-bounce">
            +{scoreDiff}
          </div>
        </div>
      )}
      
      {/* Winner celebration effects */}
      {isWinner && (
        <>
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-2 left-2 animate-ping">
              <Star className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="absolute top-2 right-2 animate-ping" style={{ animationDelay: '0.5s' }}>
              <Star className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="absolute bottom-2 left-2 animate-ping" style={{ animationDelay: '1s' }}>
              <Star className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="absolute bottom-2 right-2 animate-ping" style={{ animationDelay: '1.5s' }}>
              <Star className="w-4 h-4 text-yellow-400" />
            </div>
          </div>
        </>
      )}
    </div>
  );
};