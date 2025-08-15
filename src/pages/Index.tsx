import { useEffect, useState } from "react";
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
import Aurora from "@/components/Aurora";
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
  useEffect(() => { /* keep types happy */ }, []);

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
      <div className="relative min-h-screen flex items-center justify-center card-game-bg overflow-hidden">
        <Aurora />
        <Particles />
        <div className="relative z-10 w-full max-w-6xl mx-auto p-6 sm:p-10 rounded-2xl glass-panel">
          <div className="absolute right-6 top-6 flex items-center gap-3">
            <Button variant="secondary" size="icon" aria-label="Toggle theme" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} className="glass-card hover:scale-105">
              {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button asChild variant="outline" size="sm" aria-label="Sign in or manage account" className="glass-card hover:scale-105">
              <Link to="/auth">Account</Link>
            </Button>
          </div>
          <header className="text-center mb-12 mt-8">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-normal w-fit mx-auto bg-gradient-to-r from-blue-600 via-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
              Scattergories Online
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              The classic game, but it looks better
            </p>
          </header>

          <main className="grid gap-8 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 mb-8">
            <Card className="glass-card floating-card group cursor-pointer" style={{ animationDelay: '0s' }}>
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Gamepad2 className="text-white w-8 h-8" />
                </div>
                <CardTitle className="text-xl">Quick Play</CardTitle>
                <CardDescription className="text-sm opacity-80">Jump into a game instantly</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button onClick={() => setPlayOpen(true)} aria-label="Open play options" className="w-full glass-card hover:scale-105">
                  Start Playing
                </Button>
              </CardFooter>
            </Card>

            <Card className="glass-card floating-card group cursor-pointer" style={{ animationDelay: '0.2s' }}>
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Users className="text-white w-8 h-8" />
                </div>
                <CardTitle className="text-xl">Game Lobby</CardTitle>
                <CardDescription className="text-sm opacity-80">Join active multiplayer rooms</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button asChild aria-label="Open lobby" className="w-full glass-card hover:scale-105">
                  <Link to="/lobby">Browse Rooms</Link>
                </Button>
              </CardFooter>
            </Card>

            <Card className="glass-card floating-card group cursor-pointer" style={{ animationDelay: '0.4s' }}>
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <UserCircle2 className="text-white w-8 h-8" />
                </div>
                <CardTitle className="text-xl">Player Profile</CardTitle>
                <CardDescription className="text-sm opacity-80">Customize your gaming identity</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center gap-3 py-4">
                <Avatar>
                  <AvatarFallback style={{ backgroundImage: gradientFromString(name || "Player"), color: "white" }}>
                    {initialsFromName(name || "P")}
                  </AvatarFallback>
                </Avatar>
                <div className="text-sm text-center">
                  {name ? (
                    <span className="font-medium">{name}</span>
                  ) : (
                    <span className="text-muted-foreground">Anonymous</span>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="secondary" onClick={() => setProfileOpen(true)} aria-label="Edit profile" className="w-full glass-card hover:scale-105">
                  {name ? "Edit Profile" : "Set Name"}
                </Button>
              </CardFooter>
            </Card>

            <Card className="glass-card floating-card group cursor-pointer" style={{ animationDelay: '0.6s' }}>
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Trophy className="text-white w-8 h-8" />
                </div>
                <CardTitle className="text-xl">Champions</CardTitle>
                <CardDescription className="text-sm opacity-80">View top players and stats</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button asChild aria-label="Open leaderboard" className="w-full glass-card hover:scale-105">
                  <Link to="/leaderboard">View Rankings</Link>
                </Button>
              </CardFooter>
            </Card>
          </main>

          <Dialog open={playOpen} onOpenChange={setPlayOpen}>
            <DialogContent className="glass-panel border-0">
              <DialogHeader>
                <DialogTitle className="text-2xl text-center mb-4">Choose Your Adventure</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <Button 
                  variant="secondary" 
                  onClick={() => { setPlayOpen(false); navigate('/game'); }} 
                  aria-label="Start solo"
                  className="glass-card hover:scale-105 h-16 text-lg"
                >
                  <Gamepad2 className="mr-3 h-5 w-5" />
                  Solo Play
                </Button>
                <Button 
                  onClick={() => { setPlayOpen(false); createRoom(); }} 
                  aria-label="Create room"
                  className="glass-card hover:scale-105 h-16 text-lg"
                >
                  <PlusCircle className="mr-3 h-5 w-5" />
                  Create Room
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
            <DialogContent className="glass-panel border-0">
              <DialogHeader>
                <DialogTitle className="text-2xl text-center mb-6">Player Profile</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center gap-6">
                <Avatar className="w-20 h-20 border-4 border-white/20">
                  <AvatarFallback
                    style={{ backgroundImage: gradientFromString(name || 'Player'), color: "white" }}
                    className="text-2xl font-bold"
                  >
                    {initialsFromName(name || 'P')}
                  </AvatarFallback>
                </Avatar>
                <div className="w-full space-y-4">
                  <Input 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="Enter your display name" 
                    className="glass-card text-center text-lg h-12"
                  />
                  <Button onClick={saveProfile} className="w-full glass-card hover:scale-105 h-12 text-lg">
                    Save Profile
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </>
  );
};

export default Index;
