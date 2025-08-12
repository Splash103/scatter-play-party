import { Helmet } from "react-helmet-async";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Particles from "@/components/Particles";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, RefreshCw } from "lucide-react";

interface Room {
  id: string;
  code: string;
  name: string;
  players: number;
  maxPlayers: number;
}

const mockRooms: Room[] = [
  { id: "1", code: "ABCD", name: "Friday Night Fun", players: 3, maxPlayers: 8 },
  { id: "2", code: "QWER", name: "Speed Round", players: 2, maxPlayers: 6 },
  { id: "3", code: "ZXCV", name: "Casual Lobby", players: 5, maxPlayers: 8 },
];

const Lobby = () => {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const rooms = useMemo(() => mockRooms, []);

  const join = (code: string) => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    navigate(`/game?room=${c}`);
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-primary/10 via-accent/10 to-background">
      <Particles />
      <Helmet>
        <title>Lobby — Public Rooms | Scattergories Online</title>
        <meta
          name="description"
          content="Browse public Scattergories rooms or join with a room code."
        />
        <link rel="canonical" href="/lobby" />
      </Helmet>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Lobby</h1>
          <p className="mt-2 text-muted-foreground">Join a public room or enter a code.</p>
        </header>

        <main className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2 bg-background/60 backdrop-blur-xl border">
            <CardHeader className="flex-row items-center gap-2">
              <Users className="text-primary" />
              <CardTitle>Public Rooms</CardTitle>
              <CardDescription>Pick a room to join instantly.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-3 sm:grid-cols-2">
                {rooms.map((r) => (
                  <div
                    key={r.id}
                    className="group rounded-lg border bg-card/70 p-4 backdrop-blur transition-transform duration-200 hover:scale-[1.02]"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-muted-foreground">Code {r.code}</div>
                        <div className="text-base font-medium">{r.name}</div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {r.players}/{r.maxPlayers}
                      </div>
                    </div>
                    <div className="mt-3">
                      <Button className="w-full" onClick={() => join(r.code)} aria-label={`Join room ${r.code}`}>
                        Join
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="secondary" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
            </CardFooter>
          </Card>

          <Card className="bg-background/60 backdrop-blur-xl border">
            <CardHeader>
              <CardTitle>Join by Code</CardTitle>
              <CardDescription>Enter a 3–6 letter code.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-2">
                <Input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Room code"
                  aria-label="Room code"
                />
                <Button variant="secondary" onClick={() => join(joinCode)} aria-label="Join room">
                  Join
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default Lobby;
