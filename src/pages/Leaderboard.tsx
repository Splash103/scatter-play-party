import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { gradientFromString, initialsFromName } from "@/lib/gradient";

interface Entry {
  name: string;
  wins: number;
}

export default function Leaderboard() {
  const profileName = localStorage.getItem("profileName") || "";
  let entries: Entry[] = [];

  try {
    const raw = localStorage.getItem("leaderboard");
    if (raw) entries = JSON.parse(raw) as Entry[];
  } catch (_) {
    entries = [];
  }

  // Ensure unique by name and sort desc
  const map = new Map<string, Entry>();
  for (const e of entries) map.set(e.name, e);
  if (profileName && !map.has(profileName)) map.set(profileName, { name: profileName, wins: 0 });
  const list = Array.from(map.values()).sort((a, b) => b.wins - a.wins).slice(0, 10);

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
            <Button asChild variant="secondary" aria-label="Back to home">
              <Link to="/">Back to Home</Link>
            </Button>
          </header>

          {list.length === 0 ? (
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle>No scores yet</CardTitle>
                <CardDescription>Play some rounds and your stats will appear here.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-4">
              {list.map((e, idx) => (
                <Card key={e.name} className="hover-scale animate-fade-in">
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="w-10 text-center font-semibold text-muted-foreground">#{idx + 1}</div>
                    <Avatar>
                      <AvatarFallback style={{ backgroundImage: gradientFromString(e.name), color: "white" }}>
                        {initialsFromName(e.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium">{e.name}</div>
                      <div className="text-sm text-muted-foreground">Wins: {e.wins}</div>
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
