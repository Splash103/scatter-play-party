import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { gradientFromString, initialsFromName } from "@/lib/gradient";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import Particles from "@/components/Particles";
import { PlusCircle, Users, UserCircle2, Trophy, Gamepad2, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
const ROOM_ALPHABET = "ABCDEFGHJKMNPQRSTWXYZ";
function generateRoomCode(len = 4) {
  let out = "";
  for (let i = 0; i < len; i++) out += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
  return out;
}

const Index = () => {
  
  const [profileOpen, setProfileOpen] = useState(false);
  const [name, setName] = useState<string>(() => localStorage.getItem("profileName") || "");
  const navigate = useNavigate();
  const [playOpen, setPlayOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  const createRoom = () => {
    const code = generateRoomCode();
    toast({ title: "Room created", description: `Share code ${code} to invite friends.` });
    navigate(`/game?room=${code}`);
  };


  const saveProfile = () => {
    const n = name.trim();
    if (!n) {
      toast({ title: "Name required", description: "Please enter your display name." });
      return;
    }
    localStorage.setItem("profileName", n);
    toast({ title: "Profile saved", description: `Welcome, ${n}!` });
    setProfileOpen(false);
  };
  return (
    <>
      <Helmet>
        <title>Scattergories Online — Play Free</title>
        <meta name="description" content="Play Scattergories online with modern UI. Create or join rooms to play with friends, or start a solo round instantly." />
        <link rel="canonical" href="/" />
      </Helmet>
      <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-accent/10 to-background overflow-hidden">
        <Particles />
        <div className="relative z-10 w-full max-w-5xl mx-auto p-6 sm:p-10 rounded-lg border bg-background/60 backdrop-blur-xl shadow-[var(--shadow-elegant)]">
          <div className="absolute right-4 top-4">
            <Button variant="secondary" size="icon" aria-label="Toggle theme" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
              {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
          <header className="text-center mb-8">
            <h1 className="text-4xl font-bold tracking-tight">Play Scattergories Online</h1>
            <p className="text-lg text-muted-foreground mt-2">Choose how you want to play, explore the lobby, and check the leaderboard.</p>
          </header>

          <main className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="hover-scale animate-fade-in bg-background/60 backdrop-blur-xl border">
              <CardHeader className="flex-row items-center gap-2">
                <Gamepad2 className="text-primary" />
                <CardTitle>Play</CardTitle>
                <CardDescription>Solo or create a private room.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button onClick={() => setPlayOpen(true)} aria-label="Open play options">Start</Button>
              </CardFooter>
            </Card>

            <Card className="hover-scale animate-fade-in bg-background/60 backdrop-blur-xl border">
              <CardHeader className="flex-row items-center gap-2">
                <Users className="text-primary" />
                <CardTitle>Lobby</CardTitle>
                <CardDescription>Browse and join public rooms.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button asChild aria-label="Open lobby">
                  <Link to="/lobby">Open Lobby</Link>
                </Button>
              </CardFooter>
            </Card>

            <Card className="hover-scale animate-fade-in bg-background/60 backdrop-blur-xl border">
              <CardHeader className="flex-row items-center gap-2">
                <UserCircle2 className="text-primary" />
                <CardTitle>Your Profile</CardTitle>
                <CardDescription>Set your display name and avatar.</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback style={{ backgroundImage: gradientFromString(name || "Player"), color: "white" }}>
                    {initialsFromName(name || "P")}
                  </AvatarFallback>
                </Avatar>
                <div className="text-sm">
                  {name ? (
                    <span>Playing as <span className="font-medium">{name}</span></span>
                  ) : (
                    <span className="text-muted-foreground">No name set</span>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="secondary" onClick={() => setProfileOpen(true)} aria-label="Edit profile">
                  {name ? "Edit profile" : "Create profile"}
                </Button>
              </CardFooter>
            </Card>

            <Card className="hover-scale animate-fade-in bg-background/60 backdrop-blur-xl border">
              <CardHeader className="flex-row items-center gap-2">
                <Trophy className="text-primary" />
                <CardTitle>Leaderboard</CardTitle>
                <CardDescription>Top players and recent wins.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button asChild aria-label="Open leaderboard">
                  <Link to="/leaderboard">View Leaderboard</Link>
                </Button>
              </CardFooter>
            </Card>
          </main>

          <Dialog open={playOpen} onOpenChange={setPlayOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Choose how to play</DialogTitle>
              </DialogHeader>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => { setPlayOpen(false); navigate('/game'); }} aria-label="Start solo">
                  Solo
                </Button>
                <Button onClick={() => { setPlayOpen(false); createRoom(); }} aria-label="Create room">
                  <PlusCircle className="mr-2 h-4 w-4" /> Create Room
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create your profile</DialogTitle>
              </DialogHeader>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback
                    style={{ backgroundImage: gradientFromString(name || 'Player'), color: "white" }}
                  >
                    {initialsFromName(name || 'P')}
                  </AvatarFallback>
                </Avatar>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your display name" />
                <Button onClick={saveProfile}>Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </>
  );
};

export default Index;
