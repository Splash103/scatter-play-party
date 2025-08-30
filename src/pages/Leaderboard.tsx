import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { gradientFromString, initialsFromName } from "@/lib/gradient";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Aurora from "@/components/Aurora";
import Particles from "@/components/Particles";

interface Row {
  user_id: string | null;
  name: string | null;
  avatar_url: string | null;
  wins: number | null;
  best_streak: number | null;
  current_streak: number | null;
}

export default function Leaderboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_leaderboard', { limit_count: 50 });
      if (error) throw error;
      return (data || []).map((row: any, index: number) => ({
        user_id: `user_${index}`,
        name: row.display_name || 'Player',
        avatar_url: null,
        wins: row.total_wins || 0,
        current_streak: row.current_streak || 0,
        best_streak: row.best_streak || 0,
      })) as Row[];
    },
  });

  let list: { name: string; wins: number; best_streak?: number; current_streak?: number }[] = [];
  if (data && data.length > 0) {
    list = data.map((r) => ({
      name: r.name || "Player",
      wins: r.wins || 0,
      best_streak: r.best_streak || 0,
      current_streak: r.current_streak || 0,
    })).slice(0, 10);
  } else {
    // Fallback to local storage if no Supabase data
    try {
      const raw = localStorage.getItem("leaderboard");
      const entries = raw ? JSON.parse(raw) as { name: string; wins: number }[] : [];
      const map = new Map<string, { name: string; wins: number }>();
      for (const e of entries) map.set(e.name, e);
      list = Array.from(map.values()).sort((a, b) => b.wins - a.wins).slice(0, 10);
    } catch {
      list = [];
    }
  }

  return (
    <>
      <Helmet>
        <title>Leaderboard — Scattergories Online</title>
        <meta name="description" content="View the Scattergories leaderboard with top players and recent wins." />
        <link rel="canonical" href="/leaderboard" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="relative min-h-screen card-game-bg">
          <Aurora />
          <Particles />
          <div className="relative z-10 container py-8">
          <header className="mb-6 flex items-center justify-between">
            <h1 className="text-4xl font-bold tracking-tight text-black dark:text-white">
              Leaderboard
            </h1>
          </header>

          {isLoading ? (
            <Card className="glass-panel animate-fade-in">
              <CardHeader>
                <CardTitle>Loading…</CardTitle>
                <CardDescription>Fetching top players.</CardDescription>
              </CardHeader>
            </Card>
          ) : list.length === 0 ? (
            <Card className="glass-panel animate-fade-in">
              <CardHeader>
                <CardTitle>No scores yet</CardTitle>
                <CardDescription>Play some rounds and your stats will appear here.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-4">
              {list.map((e, idx) => (
                <Card key={`${e.name}-${idx}`} className="glass-card floating-card animate-fade-in" style={{ animationDelay: `${idx * 0.1}s` }}>
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 dark:from-yellow-300 dark:to-orange-400 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                      #{idx + 1}
                    </div>
                    <Avatar>
                      <AvatarFallback style={{ backgroundImage: gradientFromString(e.name), color: "white" }}>
                        {initialsFromName(e.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium">{e.name}</div>
                      <div className="text-sm text-muted-foreground flex gap-3">
                        <span>Wins: {e.wins}</span>
                        {typeof e.current_streak === "number" && <span>Streak: {e.current_streak}</span>}
                        {typeof e.best_streak === "number" && <span>Best: {e.best_streak}</span>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>
    </>
  );
}
