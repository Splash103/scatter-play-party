import { Helmet } from "react-helmet-async";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Particles from "@/components/Particles";
import Aurora from "@/components/Aurora";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { gradientFromString, initialsFromName } from "@/lib/gradient";
import { Users, RefreshCw, Clock, Crown, Play, UserPlus, Search, Filter } from "lucide-react";
import { usePublicRoomsList } from "@/hooks/usePublicRoomsList";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const Lobby = () => {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "in-match">("all");
  const { rooms, syncNow } = usePublicRoomsList();

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          room.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (room.hostName || "").toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = filterStatus === "all" || 
                          (filterStatus === "open" && !room.inMatch) ||
                          (filterStatus === "in-match" && room.inMatch);
      
      return matchesSearch && matchesFilter;
    });
  }, [rooms, searchTerm, filterStatus]);

  const join = (code: string) => {
    const c = code.trim().toUpperCase();
    if (!c) {
      toast({ title: "Room code required", description: "Please enter a valid room code." });
      return;
    }
    navigate(`/game?room=${c}`);
  };

  const formatTimeAgo = (isoString: string) => {
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="relative min-h-screen card-game-bg">
      <Aurora />
      <Particles />
      <Helmet>
        <title>Lobby — Public Rooms | Scattergories Online</title>
        <meta
          name="description"
          content="Browse public Scattergories rooms or join with a room code. Find active games and connect with players worldwide."
        />
        <link rel="canonical" href="/lobby" />
      </Helmet>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8">
        <header className="mb-8 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-black dark:text-white">
            Game Lobby
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Discover active rooms • Join the fun • Make new friends
          </p>
          <div className="mt-4 flex justify-center items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              {rooms.length} rooms online
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {rooms.reduce((acc, room) => acc + room.players, 0)} players active
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* Main Rooms Section */}
          <div className="lg:col-span-3">
            <Card className="glass-panel animate-fade-in border">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      Public Rooms
                    </CardTitle>
                    <CardDescription>Join instantly or browse by activity</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={syncNow} className="glass-card hover:scale-105">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                </div>
                
                {/* Search and Filter Controls */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search rooms, codes, or hosts..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 glass-card"
                    />
                  </div>
                  <Select value={filterStatus} onValueChange={(value: "all" | "open" | "in-match") => setFilterStatus(value)}>
                    <SelectTrigger className="w-48 glass-card">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Rooms</SelectItem>
                      <SelectItem value="open">Open to Join</SelectItem>
                      <SelectItem value="in-match">In Progress</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                {filteredRooms.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium text-muted-foreground mb-2">
                      {searchTerm || filterStatus !== "all" ? "No rooms match your search" : "No public rooms yet"}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {searchTerm || filterStatus !== "all" 
                        ? "Try adjusting your search or filter settings"
                        : "Be the first to create a public room!"
                      }
                    </p>
                    {!searchTerm && filterStatus === "all" && (
                      <Button onClick={() => navigate("/")} variant="outline" className="glass-card hover:scale-105">
                        <Play className="w-4 h-4 mr-2" />
                        Create Room
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {filteredRooms.map((room) => (
                      <Card
                        key={room.code}
                        className="group glass-card card-stack transition-all duration-300 hover:shadow-lg hover:border-primary/20 border"
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono">
                                {room.code}
                              </Badge>
                              {room.inMatch ? (
                                <Badge variant="secondary" className="text-xs">
                                  <Clock className="w-3 h-3 mr-1" />
                                  In Progress
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                  <UserPlus className="w-3 h-3 mr-1" />
                                  Open
                                </Badge>
                              )}
                            </div>
                            <div className="text-right text-xs text-muted-foreground">
                              {formatTimeAgo(room.createdAtISO)}
                            </div>
                          </div>
                          
                          <div className="mb-3">
                            <h3 className="font-medium text-base mb-1 group-hover:text-primary transition-colors">
                              {room.name}
                            </h3>
                            {room.hostName && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Crown className="w-3 h-3" />
                                <span>Hosted by {room.hostName}</span>
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" title="Online"></div>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Avatar className="w-6 h-6 border">
                                <AvatarFallback 
                                  style={{ 
                                    backgroundImage: gradientFromString(room.hostName || room.code), 
                                    color: "white",
                                    fontSize: "10px"
                                  }}
                                >
                                  {initialsFromName(room.hostName || room.code)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm text-muted-foreground">
                                {room.players}/{room.maxPlayers} players
                              </span>
                            </div>
                            <Button 
                              size="sm" 
                              onClick={() => join(room.code)}
                              disabled={room.players >= room.maxPlayers}
                              className="glass-card hover:scale-105"
                            >
                              {room.players >= room.maxPlayers ? "Full" : "Join"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Join */}
            <Card className="glass-panel animate-fade-in border">
              <CardHeader>
                <CardTitle className="text-lg">Quick Join</CardTitle>
                <CardDescription>Enter a room code to join directly</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ABCD"
                  className="font-mono text-center text-lg glass-card"
                  maxLength={6}
                />
                <Button 
                  onClick={() => join(joinCode)} 
                  className="w-full glass-card hover:scale-105"
                  disabled={!joinCode.trim()}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Join Room
                </Button>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="glass-panel animate-fade-in border">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={() => navigate("/")} 
                  variant="outline" 
                  className="w-full glass-card hover:scale-105"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Create Room
                </Button>
                <Button 
                  onClick={() => navigate("/game")} 
                  variant="outline" 
                  className="w-full glass-card hover:scale-105"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Solo Play
                </Button>
                <Button 
                  onClick={() => navigate("/leaderboard")} 
                  variant="outline" 
                  className="w-full glass-card hover:scale-105"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Leaderboard
                </Button>
              </CardContent>
            </Card>

            {/* Stats */}
            <Card className="glass-panel animate-fade-in border">
              <CardHeader>
                <CardTitle className="text-lg">Lobby Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active Rooms</span>
                  <span className="font-medium">{rooms.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Players Online</span>
                  <span className="font-medium">{rooms.reduce((acc, room) => acc + room.players, 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Games in Progress</span>
                  <span className="font-medium">{rooms.filter(r => r.inMatch).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Open to Join</span>
                  <span className="font-medium">{rooms.filter(r => !r.inMatch && r.players < r.maxPlayers).length}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
