import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";
import { Crown, Flame } from "lucide-react";

export type ChatMessage = {
  id: string; // sender id
  name: string;
  text: string;
  ts: number; // epoch ms
};

export function ChatPanel({
  messages,
  onSend,
  currentName,
  hostId,
  leaderId,
  streaks = {},
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  currentName: string;
  hostId?: string | null;
  leaderId?: string | null;
  streaks?: Record<string, number>;
}) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Room Chat</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <ScrollArea className="h-56 sm:h-64 rounded-md border">
          <div className="p-3 space-y-2">
            {messages.length === 0 && (
              <div className="text-sm text-muted-foreground">No messages yet. Say hi 👋</div>
            )}
            {messages.map((m, i) => {
              const isYou = m.name === currentName;
              const isHost = hostId && m.id === hostId;
              const s = streaks[m.id] ?? 0;
              const isLeader = leaderId && m.id === leaderId && s > 0;
              return (
                <div key={i} className="text-sm flex items-center gap-1">
                  <span className="font-medium flex items-center gap-1">
                    {isHost ? <Crown className="h-3.5 w-3.5 text-primary" aria-label="Host" /> : null}
                    {isYou ? "You" : m.name}
                    {isLeader ? (
                      <span className="inline-flex items-center gap-0.5 text-xs text-primary">
                        <Flame className="h-3.5 w-3.5" aria-label="Win streak" />
                        ×{s}
                      </span>
                    ) : null}
                    :
                  </span>
                  <span className="text-muted-foreground">{m.text}</span>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        </ScrollArea>
        <div className="flex items-center gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message and press Enter"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button onClick={send} variant="secondary">Send</Button>
        </div>
      </CardContent>
    </Card>
  );
}
