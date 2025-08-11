import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

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
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  currentName: string;
}) {
  const [text, setText] = useState("");

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
        <ScrollArea className="h-64 rounded-md border">
          <div className="p-3 space-y-2">
            {messages.length === 0 && (
              <div className="text-sm text-muted-foreground">No messages yet. Say hi 👋</div>
            )}
            {messages.map((m, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium">{m.name === currentName ? "You" : m.name}:</span>{" "}
                <span className="text-muted-foreground">{m.text}</span>
              </div>
            ))}
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
