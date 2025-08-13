import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AdvertiserOptions {
  enabled: boolean;
  roomCode: string;
  payload: {
    name: string;
    hostName?: string;
    maxPlayers?: number;
    createdAtISO: string; // ISO string
  };
  players: number;
  inMatch: boolean;
}

// Host-side presence advertiser for the public lobby
export function usePublicRoomAdvertiser({ enabled, roomCode, payload, players, inMatch }: AdvertiserOptions) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Subscribe/unsubscribe when enabled changes
  useEffect(() => {
    if (!enabled || !roomCode) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const channel = supabase.channel("public_rooms", { config: { presence: { key: roomCode } } });
    channelRef.current = channel;

    channel.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      try {
        await channel.track({
          roomCode,
          name: payload.name,
          hostName: payload.hostName,
          maxPlayers: payload.maxPlayers ?? 8,
          createdAtISO: payload.createdAtISO,
          players,
          inMatch,
          updatedAtISO: new Date().toISOString(),
        });
      } catch {}
    });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, roomCode]);

  // Update dynamic fields
  useEffect(() => {
    const ch = channelRef.current;
    if (!ch) return;
    try {
      ch.track({
        roomCode,
        name: payload.name,
        hostName: payload.hostName,
        maxPlayers: payload.maxPlayers ?? 8,
        createdAtISO: payload.createdAtISO,
        players,
        inMatch,
        updatedAtISO: new Date().toISOString(),
      });
    } catch {}
  }, [players, inMatch, payload.name, payload.hostName, payload.maxPlayers, payload.createdAtISO, roomCode]);
}
