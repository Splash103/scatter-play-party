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
    console.log(`[Room Advertiser] Effect triggered - enabled: ${enabled}, roomCode: ${roomCode}`);
    if (!enabled || !roomCode) {
      console.log(`[Room Advertiser] Disabling advertiser - enabled: ${enabled}, roomCode: ${roomCode}`);
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
      console.log(`[Room Advertiser] Subscribed to public_rooms channel for room ${roomCode}`);
      
      // Small delay to ensure presence state is properly initialized
      setTimeout(async () => {
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
          console.log(`[Room Advertiser] Successfully tracking room ${roomCode} with ${players} players`);
        } catch (error) {
          console.error(`[Room Advertiser] Failed to track room ${roomCode}:`, error);
        }
      }, 100);
    });

    return () => {
      if (channelRef.current) {
        console.log(`[Room Advertiser] Cleaning up room ${roomCode} advertising`);
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, roomCode]);

  // Update dynamic fields
  useEffect(() => {
    const ch = channelRef.current;
    if (!ch) return;
    console.log(`[Room Advertiser] Updating room ${roomCode} presence: ${players} players, inMatch: ${inMatch}`);
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
    } catch (error) {
      console.error(`[Room Advertiser] Failed to update room ${roomCode}:`, error);
    }
  }, [players, inMatch, payload.name, payload.hostName, payload.maxPlayers, payload.createdAtISO, roomCode]);
}
