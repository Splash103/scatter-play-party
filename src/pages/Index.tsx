import { useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { gradientFromString, initialsFromName } from "@/lib/gradient";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import Particles from "@/components/Particles";

const Index = () => {
  const [profileOpen, setProfileOpen] = useState(false);
  const [name, setName] = useState<string>(() => localStorage.getItem("profileName") || "");

  const saveProfile = () => {
    const n = name.trim();
    if (!n) return;
    localStorage.setItem("profileName", n);
    setProfileOpen(false);
  };

  return (
    <>
      <Helmet>
        <title>Scattergories — Modern Online Game</title>
        <meta name="description" content="Play Scattergories online with a colorful, glassy UI. Choose Play, Lobby, Leaderboard, and manage your profile." />
        <link rel="canonical" href="/" />
      </Helmet>

      <div className="relative min-h-screen flex items-center justify-center bg-background">
        <Particles />
        <div className="w-full max-w-6xl mx-auto p-6 sm:p-10 rounded-xl bg-card/60 backdrop-blur-xl shadow-xl">
          <header className="text-center mb-8">
            <h1 className="text-4xl font-bold tracking-tight">Play Scattergories</h1>
            <p className="text-lg text-muted-foreground mt-2">Choose a mode or browse rooms. Everything is fast and real‑time.</p>
          </header>

          <main className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="bg-card/60 backdrop-blur-xl hover-scale animate-fade-in">
              <CardHeader>
                <CardTitle>Play</CardTitle>
                <CardDescription>Solo or create a room.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button asChild>
                  <Link to="/play">Open Play</Link>
                </Button>
              </CardFooter>
            </Card>

            <Card className="bg-card/60 backdrop-blur-xl hover-scale animate-fade-in">
              <CardHeader>
                <CardTitle>Lobby</CardTitle>
                <CardDescription>See public rooms.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button asChild>
                  <Link to="/lobby">Open Lobby</Link>
                </Button>
              </CardFooter>
            </Card>

            <Card className="bg-card/60 backdrop-blur-xl hover-scale animate-fade-in">
              <CardHeader>
                <CardTitle>Leaderboard</CardTitle>
                <CardDescription>Top players and recent wins.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button asChild aria-label="Open leaderboard">
                  <Link to="/leaderboard">View Leaderboard</Link>
                </Button>
              </CardFooter>
            </Card>

            <Card className="bg-card/60 backdrop-blur-xl hover-scale animate-fade-in sm:col-span-2 lg:col-span-3">
              <CardHeader className="flex-row items-center gap-2">
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
          </main>

          <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create your profile</DialogTitle>
              </DialogHeader>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback style={{ backgroundImage: gradientFromString(name || "Player"), color: "white" }}>
                    {initialsFromName(name || "P")}
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
