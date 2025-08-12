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
import { PlusCircle, KeyRound, UserCircle2, Trophy, Gamepad2 } from "lucide-react";
const ROOM_ALPHABET = "ABCDEFGHJKMNPQRSTWXYZ";
function generateRoomCode(len = 4) {
  let out = "";
  for (let i = 0; i < len; i++) out += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
  return out;
}

const Index = () => {
  const [joinCode, setJoinCode] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [name, setName] = useState<string>(() => localStorage.getItem("profileName") || "");
  const navigate = useNavigate();

  const createRoom = () => {
    const code = generateRoomCode();
    toast({ title: "Room created", description: `Share code ${code} to invite friends.` });
    navigate(`/game?room=${code}`);
  };

  const joinRoom = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code || code.length < 3) {
      toast({ title: "Invalid code", description: "Please enter a valid room code." });
      return;
    }
    toast({ title: "Joining room", description: `Room ${code}` });
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div
          className="w-full max-w-5xl mx-auto p-6 sm:p-10 rounded-lg"
          style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}
        >
          <header className="text-center mb-8">
            <h1 className="text-4xl font-bold tracking-tight">Play Scattergories Online</h1>
            <p className="text-lg text-muted-foreground mt-2">Create or join rooms, practice solo, and check the leaderboard.</p>
          </header>

          <main className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="hover-scale animate-fade-in">
              <CardHeader className="flex-row items-center gap-2">
                <PlusCircle className="text-primary" />
                <CardTitle>Create Room</CardTitle>
                <CardDescription>Generate a code and invite friends.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button onClick={createRoom} aria-label="Create room">Create</Button>
              </CardFooter>
            </Card>

            <Card className="hover-scale animate-fade-in">
              <CardHeader className="flex-row items-center gap-2">
                <KeyRound className="text-primary" />
                <CardTitle>Join Room</CardTitle>
                <CardDescription>Enter a room code to join.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                  <Input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="Room code"
                    aria-label="Room code"
                  />
                  <Button variant="secondary" onClick={joinRoom} aria-label="Join room">Join</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-scale animate-fade-in">
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

            <Card className="hover-scale animate-fade-in">
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

            <Card className="hover-scale animate-fade-in">
              <CardHeader className="flex-row items-center gap-2">
                <Gamepad2 className="text-primary" />
                <CardTitle>Solo Round</CardTitle>
                <CardDescription>Practice on your own.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button asChild aria-label="Start solo round">
                  <Link to="/game">Start Solo</Link>
                </Button>
              </CardFooter>
            </Card>
          </main>

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
