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
    setRooms(list);
  };

  useEffect(() => {
    const channel = supabase.channel("public_rooms");
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        syncNow();
      })
      .on("presence", { event: "join" }, () => {
        syncNow();
      })
      .on("presence", { event: "leave" }, () => {
        syncNow();
      })
      .subscribe();

    // Initial sync in case there are already users
    setTimeout(syncNow, 0);

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };
  }, []);

  return { rooms, syncNow } as const;
}
