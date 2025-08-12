import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Particles from "@/components/Particles";
import { gradientFromString, initialsFromName } from "@/lib/gradient";

interface PublicRoom {
  code: string;
  host: string;
  players: number;
}

export default function Lobby() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [manual, setManual] = useState("");

  useEffect(() => {
    // Placeholder: this should be powered by Supabase (public rooms table)
    // For now we read from localStorage mock if present
    try {
      const raw = localStorage.getItem("publicRooms");
      if (raw) setRooms(JSON.parse(raw));
    } catch {}
  }, []);

  return (
    <>
      <Helmet>
        <title>Lobby — Public Rooms</title>
        <meta name="description" content="Browse and join public Scattergories rooms in the lobby." />
        <link rel="canonical" href="/lobby" />
      </Helmet>

      <div className="relative min-h-screen bg-background">
        <Particles />
        <div className="container py-8">
          <header className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Lobby</h1>
            <Button variant="secondary" onClick={() => navigate(-1)} aria-label="Go back">Back</Button>
          </header>

          {rooms.length === 0 ? (
            <Card className="bg-card/60 backdrop-blur-xl animate-fade-in">
              <CardHeader>
                <CardTitle>No public rooms yet</CardTitle>
                <CardDescription>Be the first to create one from the Play page, or enter a code below.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Input value={manual} onChange={(e) => setManual(e.target.value.toUpperCase())} placeholder="Enter room code" />
                  <Button onClick={() => manual && navigate(`/game?room=${manual}`)}>Join</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {rooms.map((r) => (
                <Card key={r.code} className="bg-card/60 backdrop-blur-xl hover-scale animate-fade-in">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback style={{ backgroundImage: gradientFromString(r.host), color: "white" }}>
                          {initialsFromName(r.host)}
                        </AvatarFallback>
                      </Avatar>
                      Room {r.code}
                    </CardTitle>
                    <CardDescription>Host: {r.host} • Players: {r.players}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild>
                      <Link to={`/game?room=${r.code}`}>Join Room</Link>
                    </Button>
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
