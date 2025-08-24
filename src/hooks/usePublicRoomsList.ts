import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PublicRoom {
  code: string;
  name: string;
  players: number;
  maxPlayers: number;
  inMatch?: boolean;
  hostName?: string;
  createdAtISO: string;
}

// Subscribe to the public_rooms presence channel and return a live list
export function usePublicRoomsList() {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [rooms, setRooms] = useState<PublicRoom[]>([]);

  const syncNow = () => {
    const ch = channelRef.current;
    if (!ch) return;
    const state = ch.presenceState() as Record<string, any[]>;
    console.log(`[Public Rooms] Syncing presence state:`, state);
    const list: PublicRoom[] = Object.entries(state).map(([key, presences]) => {
      const p = presences?.[0] || {};
      const code = p.roomCode || key;
      return {
        code,
        name: p.name || `${code} Room` || "Room",
        players: Number(p.players) || 0,
        maxPlayers: Number(p.maxPlayers) || 8,
        inMatch: !!p.inMatch,
        hostName: p.hostName || undefined,
        createdAtISO: p.createdAtISO || new Date().toISOString(),
      } as PublicRoom;
    });
    // Sort: by players desc, then createdAt asc
    list.sort((a, b) => (b.players - a.players) || (new Date(a.createdAtISO).getTime() - new Date(b.createdAtISO).getTime()));
    console.log(`[Public Rooms] Found ${list.length} rooms:`, list);
    setRooms(list);
  };

  useEffect(() => {
    const channel = supabase.channel("public_rooms");
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        console.log('[Public Rooms] Presence sync event triggered');
        syncNow();
      })
      .on("presence", { event: "join" }, (payload) => {
        console.log('[Public Rooms] Presence join event triggered', payload);
        syncNow();
      })
      .on("presence", { event: "leave" }, (payload) => {
        console.log('[Public Rooms] Presence leave event triggered', payload);
        syncNow();
      })
      .subscribe((status) => {
        console.log('[Public Rooms] Channel subscription status:', status);
        if (status === 'SUBSCRIBED') {
          // Sync immediately when subscribed
          setTimeout(syncNow, 50);
        }
      });

    // Initial sync in case there are already users
    setTimeout(syncNow, 100);

    return () => {
      console.log('[Public Rooms] Cleaning up public rooms listener');
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };
  }, []);

  return { rooms, syncNow } as const;
}
