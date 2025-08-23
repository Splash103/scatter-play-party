import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Star, Flame, Target, Zap, Crown, Award, Sparkles } from 'lucide-react';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string;
}

interface AchievementToastProps {
  achievement: Achievement;
  isVisible: boolean;
  onClose: () => void;
}

export const AchievementToast: React.FC<AchievementToastProps> = ({
  achievement,
  isVisible,
  onClose
}) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, 5000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  const getIcon = (iconName: string) => {
    const icons: Record<string, React.ReactNode> = {
      trophy: <Trophy className="w-6 h-6" />,
      star: <Star className="w-6 h-6" />,
      flame: <Flame className="w-6 h-6" />,
      target: <Target className="w-6 h-6" />,
      zap: <Zap className="w-6 h-6" />,
      crown: <Crown className="w-6 h-6" />,
      award: <Award className="w-6 h-6" />,
    };
    return icons[iconName] || <Star className="w-6 h-6" />;
  };

  return (
    <div className="fixed top-4 right-4 z-50 animate-scale-in">
      <Card className="bg-primary text-primary-foreground shadow-lg max-w-sm border">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-foreground/20 rounded-lg">
              {getIcon(achievement.icon)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-semibold uppercase tracking-wide">
                  Achievement Unlocked!
                </span>
              </div>
              <h3 className="font-bold text-lg leading-tight">
                {achievement.name}
              </h3>
              <p className="text-primary-foreground/80 text-sm mt-1">
                {achievement.description}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Achievement system hook
export const useAchievements = () => {
  const [unlockedAchievements, setUnlockedAchievements] = useState<Achievement[]>([]);
  const [currentToast, setCurrentToast] = useState<Achievement | null>(null);

  const checkAchievements = (gameData: {
    score: number;
    streak: number;
    answers: Record<string, string>;
    timeLeft: number;
    powerUpsUsed: number;
  }) => {
    const newAchievements: Achievement[] = [];

    // Score-based achievements
    if (gameData.score >= 10 && !unlockedAchievements.find(a => a.id === 'double_digits')) {
      newAchievements.push({
        id: 'double_digits',
        name: 'Double Digits',
        description: 'Score 10 or more points in a single round',
        icon: 'star',
        unlockedAt: new Date().toISOString()
      });
    }

    if (gameData.score >= 20 && !unlockedAchievements.find(a => a.id === 'score_master')) {
      newAchievements.push({
        id: 'score_master',
        name: 'Score Master',
        description: 'Achieve a perfect score of 20+ points',
        icon: 'trophy',
        unlockedAt: new Date().toISOString()
      });
    }

    // Speed achievements
    if (gameData.timeLeft > 60 && gameData.score >= 8 && !unlockedAchievements.find(a => a.id === 'lightning_fast')) {
      newAchievements.push({
        id: 'lightning_fast',
        name: 'Lightning Fast',
        description: 'Complete with high score in under a minute',
        icon: 'zap',
        unlockedAt: new Date().toISOString()
      });
    }

    // Streak achievements
    if (gameData.streak >= 3 && !unlockedAchievements.find(a => a.id === 'on_fire')) {
      newAchievements.push({
        id: 'on_fire',
        name: 'On Fire!',
        description: 'Win 3 rounds in a row',
        icon: 'flame',
        unlockedAt: new Date().toISOString()
      });
    }

    // Power-up achievements
    if (gameData.powerUpsUsed >= 3 && !unlockedAchievements.find(a => a.id === 'power_user')) {
      newAchievements.push({
        id: 'power_user',
        name: 'Power User',
        description: 'Use 3 power-ups in a single round',
        icon: 'zap',
        unlockedAt: new Date().toISOString()
      });
    }

    // Add new achievements
    if (newAchievements.length > 0) {
      setUnlockedAchievements(prev => [...prev, ...newAchievements]);
      setCurrentToast(newAchievements[0]); // Show first achievement
    }
  };

  return {
    unlockedAchievements,
    currentToast,
    checkAchievements,
    clearToast: () => setCurrentToast(null)
  };
};