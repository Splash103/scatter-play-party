import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { gradientFromString, initialsFromName } from "@/lib/gradient";
import Particles from "@/components/Particles";
import { Gamepad2, PlusCircle, Users } from "lucide-react";

function generateRoomCode(len = 4) {
  const alphabet = "ABCDEFGHJKMNPQRSTWXYZ";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export default function Play() {
  const navigate = useNavigate();
  const [profileName] = useState<string>(() => localStorage.getItem("profileName") || "");
  const [showJoin, setShowJoin] = useState(false);
  const [code, setCode] = useState("");

  const createRoom = () => {
    const code = generateRoomCode();
    navigate(`/game?room=${code}`);
  };
  const startSolo = () => navigate("/game");

  return (
    <>
      <Helmet>
        <title>Play — Scattergories Online</title>
        <meta name="description" content="Choose solo or create a room to play Scattergories with friends." />
        <link rel="canonical" href="/play" />
      </Helmet>

      <div className="relative min-h-screen bg-background">
        <Particles />
        <div className="container py-8">
          <header className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Play</h1>
              <p className="text-muted-foreground mt-1">Welcome{profileName ? `, ${profileName}` : ""}! Choose how you want to play.</p>
            </div>
            <Button variant="secondary" onClick={() => navigate(-1)} aria-label="Go back">Back</Button>
          </header>

          <main className="grid gap-6 sm:grid-cols-2">
            <Card className="bg-card/60 backdrop-blur-xl hover-scale animate-fade-in">
              <CardHeader className="flex-row items-center gap-2">
                <Gamepad2 className="text-primary" />
                <CardTitle>Solo</CardTitle>
                <CardDescription>Practice and improve your speed.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button onClick={startSolo}>Start Solo</Button>
              </CardFooter>
            </Card>

            <Card className="bg-card/60 backdrop-blur-xl hover-scale animate-fade-in">
              <CardHeader className="flex-row items-center gap-2">
                <PlusCircle className="text-primary" />
                <CardTitle>Create Room</CardTitle>
                <CardDescription>Invite friends with a code.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button onClick={createRoom}>Create</Button>
              </CardFooter>
            </Card>

            <Card className="bg-card/60 backdrop-blur-xl hover-scale animate-fade-in sm:col-span-2">
              <CardHeader className="flex-row items-center gap-2">
                <Users className="text-primary" />
                <CardTitle>Join by Code</CardTitle>
                <CardDescription>Have a code? Enter it below.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                  <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Room code" aria-label="Room code" />
                  <Button variant="secondary" onClick={() => code && navigate(`/game?room=${code}`)}>Join</Button>
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </>
  );
}
