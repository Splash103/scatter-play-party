import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { gradientFromString, initialsFromName } from "@/lib/gradient";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
      const { data, error } = await supabase
        .from("v_leaderboard")
        .select("display_name, total_wins, current_streak, best_streak")
        .order("total_wins", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []).map((row, index) => ({
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
        <div className="container py-8">
          <header className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
          </header>

          {isLoading ? (
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle>Loading…</CardTitle>
                <CardDescription>Fetching top players.</CardDescription>
              </CardHeader>
            </Card>
          ) : list.length === 0 ? (
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle>No scores yet</CardTitle>
                <CardDescription>Play some rounds and your stats will appear here.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-4">
              {list.map((e, idx) => (
                <Card key={`${e.name}-${idx}`} className="hover-scale animate-fade-in">
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="w-10 text-center font-semibold text-muted-foreground">#{idx + 1}</div>
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
    </>
  );
}
