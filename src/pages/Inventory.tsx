import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import Aurora from "@/components/Aurora";
import Particles from "@/components/Particles";
import { Package, Sparkles, Waves, Tag, Check } from "lucide-react";

interface OwnedCosmetic {
  id: string;
  type: 'water_skin' | 'wave_effect' | 'name_tag';
  key: string;
  name: string;
  price: number;
}

interface Profile {
  equipped_skin?: string;
  equipped_wave?: string;
  equipped_tag?: string;
}

const Inventory = () => {
  const [selectedTab, setSelectedTab] = useState("water_skin");
  const queryClient = useQueryClient();

  // Fetch user profile
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("equipped_skin, equipped_wave, equipped_tag")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });

  // Fetch owned cosmetics
  const { data: ownedCosmetics = [], isLoading } = useQuery({
    queryKey: ["owned-cosmetics"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("inventory")
        .select(`
          cosmetic_id,
          cosmetics (
            id,
            type,
            key,
            name,
            price
          )
        `)
        .eq("user_id", user.id);
      
      if (error) throw error;
      return data.map(item => item.cosmetics).filter(Boolean) as OwnedCosmetic[];
    },
  });

  // Equip mutation
  const equipMutation = useMutation({
    mutationFn: async ({ cosmetic, action }: { cosmetic: OwnedCosmetic; action: 'equip' | 'unequip' }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const updateData: Record<string, string | null> = {};
      
      if (cosmetic.type === 'water_skin') {
        updateData.equipped_skin = action === 'equip' ? cosmetic.key : null;
      } else if (cosmetic.type === 'wave_effect') {
        updateData.equipped_wave = action === 'equip' ? cosmetic.key : null;
      } else if (cosmetic.type === 'name_tag') {
        updateData.equipped_tag = action === 'equip' ? cosmetic.key : null;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", user.id);

      if (error) throw error;
      return { cosmetic, action };
    },
    onSuccess: ({ cosmetic, action }) => {
      toast({
        title: action === 'equip' ? "Item equipped!" : "Item unequipped!",
        description: `${cosmetic.name} has been ${action}ped.`,
      });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Action failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'water_skin': return <Sparkles className="w-5 h-5" />;
      case 'wave_effect': return <Waves className="w-5 h-5" />;
      case 'name_tag': return <Tag className="w-5 h-5" />;
      default: return <Package className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'water_skin': return 'from-blue-500 to-cyan-500';
      case 'wave_effect': return 'from-purple-500 to-pink-500';
      case 'name_tag': return 'from-yellow-500 to-orange-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const isEquipped = (cosmetic: OwnedCosmetic) => {
    if (!profile) return false;
    
    switch (cosmetic.type) {
      case 'water_skin': return profile.equipped_skin === cosmetic.key;
      case 'wave_effect': return profile.equipped_wave === cosmetic.key;
      case 'name_tag': return profile.equipped_tag === cosmetic.key;
      default: return false;
    }
  };

  const filteredCosmetics = ownedCosmetics.filter(c => c.type === selectedTab);

  return (
    <>
      <Helmet>
        <title>Inventory — Scattergories Online</title>
        <meta name="description" content="Manage your cosmetic items and customize your profile in Scattergories Online." />
        <link rel="canonical" href="/inventory" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="relative min-h-screen card-game-bg">
          <Aurora />
          <Particles />
          <div className="relative z-10 container py-8">
            <header className="mb-8 text-center">
              <h1 className="text-4xl font-bold tracking-tight text-black dark:text-white mb-4">
                My Inventory
              </h1>
              <p className="text-lg text-muted-foreground">
                Manage your cosmetic items and customize your appearance
              </p>
            </header>

            <div className="max-w-6xl mx-auto">
              <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 glass-panel">
                  <TabsTrigger value="water_skin" className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Avatar Skins ({ownedCosmetics.filter(c => c.type === 'water_skin').length})
                  </TabsTrigger>
                  <TabsTrigger value="wave_effect" className="flex items-center gap-2">
                    <Waves className="w-4 h-4" />
                    Wave Effects ({ownedCosmetics.filter(c => c.type === 'wave_effect').length})
                  </TabsTrigger>
                  <TabsTrigger value="name_tag" className="flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Name Tags ({ownedCosmetics.filter(c => c.type === 'name_tag').length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value={selectedTab} className="mt-6">
                  {isLoading ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {[...Array(4)].map((_, i) => (
                        <Card key={i} className="glass-card animate-pulse">
                          <CardHeader>
                            <div className="w-16 h-16 mx-auto bg-muted rounded-2xl" />
                            <div className="h-4 bg-muted rounded w-3/4 mx-auto" />
                          </CardHeader>
                          <CardContent>
                            <div className="h-8 bg-muted rounded" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {filteredCosmetics.map((cosmetic) => {
                        const equipped = isEquipped(cosmetic);
                        
                        return (
                          <Card key={cosmetic.id} className="glass-card floating-card group">
                            <CardHeader className="text-center pb-4">
                              <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${getTypeColor(cosmetic.type)} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 relative`}>
                                {getTypeIcon(cosmetic.type)}
                                {equipped && (
                                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3 text-white" />
                                  </div>
                                )}
                              </div>
                              <CardTitle className="text-lg">{cosmetic.name}</CardTitle>
                              <CardDescription>
                                {equipped && (
                                  <Badge variant="default" className="mt-2">
                                    Currently Equipped
                                  </Badge>
                                )}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <Button
                                onClick={() => equipMutation.mutate({ 
                                  cosmetic, 
                                  action: equipped ? 'unequip' : 'equip' 
                                })}
                                disabled={equipMutation.isPending}
                                className="w-full glass-card hover:scale-105"
                                variant={equipped ? "secondary" : "default"}
                              >
                                {equipMutation.isPending ? "Processing..." : 
                                 equipped ? "Unequip" : "Equip"}
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}

                  {filteredCosmetics.length === 0 && !isLoading && (
                    <div className="text-center py-12">
                      <Package className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-medium text-muted-foreground mb-2">
                        No {selectedTab.replace('_', ' ')} items
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Visit the shop to purchase cosmetic items!
                      </p>
                      <Button 
                        onClick={() => window.location.href = '/shop'}
                        variant="outline" 
                        className="glass-card hover:scale-105"
                      >
                        Visit Shop
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Inventory;