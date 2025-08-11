import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { gradientFromString, initialsFromName } from "@/lib/gradient";
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
          className="w-full max-w-3xl mx-auto text-center p-10 rounded-lg"
          style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}
        >
          <h1 className="text-4xl font-bold mb-3">Play Scattergories Online</h1>
          <p className="text-lg text-muted-foreground mb-8">Fast rounds, random letters, and a beautiful experience. Multiplayer coming live with rooms.</p>

<div className="flex flex-col gap-3 sm:flex-row sm:justify-center sm:items-center mb-6">
            <Button onClick={createRoom}>Create Room</Button>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter room code"
                className="w-48"
              />
              <Button variant="secondary" onClick={joinRoom}>Join</Button>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-center">
            {name ? (
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback
                    style={{ backgroundImage: gradientFromString(name), color: "white" }}
                  >
                    {initialsFromName(name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">Playing as <span className="font-medium">{name}</span></span>
                <Button variant="secondary" onClick={() => setProfileOpen(true)}>Edit profile</Button>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setProfileOpen(true)}>Create your profile</Button>
            )}
          </div>

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

          <div className="opacity-90">
            <Button asChild>
              <Link to="/game">Start a Solo Round</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Index;
