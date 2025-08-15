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
import { Coins, ShoppingBag, Sparkles, Waves, Tag } from "lucide-react";

interface Cosmetic {
  id: string;
  type: 'water_skin' | 'wave_effect' | 'name_tag';
  key: string;
  name: string;
  price: number;
  active: boolean;
}

interface Profile {
  coins: number;
  equipped_skin?: string;
  equipped_wave?: string;
  equipped_tag?: string;
}

const Shop = () => {
  const [selectedTab, setSelectedTab] = useState("water_skin");
  const queryClient = useQueryClient();

  // Fetch cosmetics
  const { data: cosmetics = [], isLoading: cosmeticsLoading } = useQuery({
    queryKey: ["cosmetics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cosmetics")
        .select("*")
        .eq("active", true)
        .order("price");
      if (error) throw error;
      return data as Cosmetic[];
    },
  });

  // Fetch user profile
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("coins, equipped_skin, equipped_wave, equipped_tag")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });

  // Fetch user inventory
  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("inventory")
        .select("cosmetic_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return data.map(item => item.cosmetic_id);
    },
  });

  // Purchase mutation
  const purchaseMutation = useMutation({
    mutationFn: async (cosmetic: Cosmetic) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if user has enough coins
      if (!profile || profile.coins < cosmetic.price) {
        throw new Error("Insufficient coins");
      }

      // Check if already owned
      if (inventory.includes(cosmetic.id)) {
        throw new Error("Already owned");
      }

      // Create coin transaction (negative amount for purchase)
      const { error: transactionError } = await supabase
        .from("coin_transactions")
        .insert({
          user_id: user.id,
          amount: -cosmetic.price,
          reason: `Purchased ${cosmetic.name}`,
        });

      if (transactionError) throw transactionError;

      // Add to inventory
      const { error: inventoryError } = await supabase
        .from("inventory")
        .insert({
          user_id: user.id,
          cosmetic_id: cosmetic.id,
        });

      if (inventoryError) throw inventoryError;

      return cosmetic;
    },
    onSuccess: (cosmetic) => {
      toast({
        title: "Purchase successful!",
        description: `You bought ${cosmetic.name} for ${cosmetic.price} coins.`,
      });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Purchase failed",
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
      default: return <ShoppingBag className="w-5 h-5" />;
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

  const filteredCosmetics = cosmetics.filter(c => c.type === selectedTab);

  return (
    <>
      <Helmet>
        <title>Shop — Scattergories Online</title>
        <meta name="description" content="Spend your coins on cosmetic items to customize your profile in Scattergories Online." />
        <link rel="canonical" href="/shop" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="relative min-h-screen card-game-bg">
          <Aurora />
          <Particles />
          <div className="relative z-10 container py-8">
            <header className="mb-8 text-center">
              <h1 className="text-4xl font-bold tracking-tight text-black dark:text-white mb-4">
                Cosmetic Shop
              </h1>
              <p className="text-lg text-muted-foreground mb-4">
                Customize your profile with unique cosmetic items
              </p>
              {profile && (
                <div className="flex items-center justify-center gap-2 text-lg font-semibold">
                  <Coins className="w-6 h-6 text-yellow-500" />
                  <span>{profile.coins} coins</span>
                </div>
              )}
            </header>

            <div className="max-w-6xl mx-auto">
              <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 glass-panel">
                  <TabsTrigger value="water_skin" className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Avatar Skins
                  </TabsTrigger>
                  <TabsTrigger value="wave_effect" className="flex items-center gap-2">
                    <Waves className="w-4 h-4" />
                    Wave Effects
                  </TabsTrigger>
                  <TabsTrigger value="name_tag" className="flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Name Tags
                  </TabsTrigger>
                </TabsList>

                <TabsContent value={selectedTab} className="mt-6">
                  {cosmeticsLoading ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {[...Array(8)].map((_, i) => (
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
                        const isOwned = inventory.includes(cosmetic.id);
                        const canAfford = profile && profile.coins >= cosmetic.price;
                        
                        return (
                          <Card key={cosmetic.id} className="glass-card floating-card group">
                            <CardHeader className="text-center pb-4">
                              <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${getTypeColor(cosmetic.type)} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                                {getTypeIcon(cosmetic.type)}
                              </div>
                              <CardTitle className="text-lg">{cosmetic.name}</CardTitle>
                              <CardDescription className="flex items-center justify-center gap-2">
                                <Coins className="w-4 h-4 text-yellow-500" />
                                <span className="font-semibold">{cosmetic.price}</span>
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                              {isOwned ? (
                                <Badge variant="secondary" className="w-full justify-center">
                                  <ShoppingBag className="w-4 h-4 mr-2" />
                                  Owned
                                </Badge>
                              ) : (
                                <Button
                                  onClick={() => purchaseMutation.mutate(cosmetic)}
                                  disabled={!canAfford || purchaseMutation.isPending}
                                  className="w-full glass-card hover:scale-105"
                                  variant={canAfford ? "default" : "secondary"}
                                >
                                  {purchaseMutation.isPending ? "Purchasing..." : 
                                   canAfford ? "Purchase" : "Insufficient Coins"}
                                </Button>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}

                  {filteredCosmetics.length === 0 && !cosmeticsLoading && (
                    <div className="text-center py-12">
                      <ShoppingBag className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-medium text-muted-foreground mb-2">
                        No items available
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Check back later for new cosmetic items!
                      </p>
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

export default Shop;