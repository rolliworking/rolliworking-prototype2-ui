import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Mic, MicOff, Send, X, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { streamChat, type ChatMessage } from "@/lib/ai-stream";

interface AiAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AiAssistant({ open, onOpenChange }: AiAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMsg: ChatMessage = { role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      let assistantSoFar = "";

      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
            );
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      try {
        await streamChat({
          messages: [...messages, userMsg],
          onDelta: upsertAssistant,
          onDone: () => setIsLoading(false),
          signal: controller.signal,
        });
      } catch (e: any) {
        if (e.name === "AbortError") return;
        console.error("AI error:", e);
        toast.error(e.message || "Failed to get response");
        setIsLoading(false);
      }
    },
    [messages, isLoading]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
    setIsLoading(false);
  };

  const clearChat = () => {
    setMessages([]);
    setInput("");
  };

  // ─── Voice Input (Web Speech API) ───
  const toggleVoice = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      toast.error("Voice input not supported in this browser");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => (prev ? prev + " " + transcript : transcript));
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[440px] flex flex-col p-0 gap-0 h-[100dvh] max-h-[100dvh]"
      >
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <SheetTitle className="text-base">AI Assistant</SheetTitle>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button variant="ghost" size="icon" onClick={clearChat} title="Clear chat">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4" ref={scrollRef as any}>
          <div className="py-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12 text-muted-foreground space-y-2">
                <Bot className="h-10 w-10 mx-auto opacity-30" />
                <p className="text-sm font-medium">How can I help?</p>
                <div className="text-xs space-y-1">
                  <p>"Look up estimate 12345"</p>
                  <p>"Show inspection photos for EST-001"</p>
                  <p>"Add parts to job…"</p>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown
                        components={{
                          img: ({ src, alt }) => (
                            <img
                              src={src}
                              alt={alt || "Inspection photo"}
                              className="rounded-lg max-w-full mt-2 mb-2 border"
                              loading="lazy"
                            />
                          ),
                          a: ({ href, children }) => (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline"
                            >
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-xl px-3.5 py-2.5 text-sm">
                  <div className="flex gap-1">
                    <span className="animate-bounce [animation-delay:0ms]">·</span>
                    <span className="animate-bounce [animation-delay:150ms]">·</span>
                    <span className="animate-bounce [animation-delay:300ms]">·</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t px-4 py-3 shrink-0 pb-[max(env(safe-area-inset-bottom,12px),2rem)]">
          <div className="flex items-end gap-2">
            <Button
              variant={isListening ? "destructive" : "outline"}
              size="icon"
              className="shrink-0 h-10 w-10"
              onClick={toggleVoice}
              title={isListening ? "Stop listening" : "Voice input"}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about jobs, photos, parts..."
              className="min-h-[44px] max-h-[120px] resize-none text-sm"
              rows={2}
            />
            {isLoading ? (
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 h-10 w-10"
                onClick={stopGeneration}
                title="Stop"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                className="shrink-0 h-10 w-10"
                onClick={() => send(input)}
                disabled={!input.trim()}
                title="Send"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
