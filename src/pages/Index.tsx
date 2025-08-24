import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6">
          <header className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Scattergories Online</h1>
            <p className="text-xl text-muted-foreground">The classic game with modern design</p>
          </header>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            <Card className="group cursor-pointer transition-all hover:shadow-lg">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Gamepad2 className="text-primary-foreground w-8 h-8" />
                </div>
                <CardTitle className="text-xl">Quick Play</CardTitle>
                <CardDescription>Jump into a game instantly</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button onClick={() => setPlayOpen(true)} className="w-full">
                  Start Playing
                </Button>
              </CardFooter>
            </Card>

            <Card className="group cursor-pointer transition-all hover:shadow-lg">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-secondary flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Users className="text-secondary-foreground w-8 h-8" />
                </div>
                <CardTitle className="text-xl">Game Lobby</CardTitle>
                <CardDescription>Join active multiplayer rooms</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button asChild variant="secondary" className="w-full">
                  <Link to="/lobby">Browse Rooms</Link>
                </Button>
              </CardFooter>
            </Card>

            <Card className="group cursor-pointer transition-all hover:shadow-lg">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-accent flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <UserCircle2 className="text-accent-foreground w-8 h-8" />
                </div>
                <CardTitle className="text-xl">Player Profile</CardTitle>
                <CardDescription>Customize your gaming identity</CardDescription>
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
                <Button variant="outline" onClick={() => setProfileOpen(true)} className="w-full">
                  {name ? "Edit Profile" : "Set Name"}
                </Button>
              </CardFooter>
            </Card>

            <Card className="group cursor-pointer transition-all hover:shadow-lg">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Trophy className="text-muted-foreground w-8 h-8" />
                </div>
                <CardTitle className="text-xl">Champions</CardTitle>
                <CardDescription>View top players and stats</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/leaderboard">View Rankings</Link>
                </Button>
              </CardFooter>
            </Card>
          </div>

          <div className="absolute right-6 top-6 flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            >
              {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/auth">Account</Link>
            </Button>
          </div>

          <Dialog open={playOpen} onOpenChange={setPlayOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-2xl text-center mb-4">Choose Your Adventure</DialogTitle>
                <DialogDescription className="text-center">Choose your game mode and start playing immediately</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <Button 
                  variant="secondary" 
                  onClick={() => { setPlayOpen(false); navigate('/game'); }} 
                  className="h-16 text-lg"
                >
                  <Gamepad2 className="mr-3 h-5 w-5" />
                  Solo Play
                </Button>
                <Button 
                  onClick={() => { setPlayOpen(false); createRoom(); }} 
                  className="h-16 text-lg"
                >
                  <PlusCircle className="mr-3 h-5 w-5" />
                  Create Room
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-2xl text-center mb-6">Player Profile</DialogTitle>
                <DialogDescription className="text-center">Customize your player name and gaming identity</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-6">
                <Avatar className="w-20 h-20">
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
                    className="text-center text-lg h-12"
                  />
                  <Button onClick={saveProfile} className="w-full h-12 text-lg">
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
