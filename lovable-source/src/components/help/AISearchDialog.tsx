import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, Send, BookOpen, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AISearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AISearchDialog({ open, onOpenChange }: AISearchDialogProps) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isLoading) return;

    const userMessage = question.trim();
    setQuestion('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('docs-qa', {
        body: { question: userMessage },
      });

      if (error) throw error;

      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (error) {
      console.error('AI search error:', error);
      toast({
        title: 'Error',
        description: 'Failed to get an answer. Please try again.',
        variant: 'destructive',
      });
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestedQuestions = [
    "How do I create an estimate?",
    "How do I receive a watch?",
    "What are the user roles?",
    "How do I sync with QuickBooks?",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Documentation Search
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {messages.length === 0 ? (
            <div className="space-y-6 py-4">
              <div className="text-center space-y-2">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground" />
                <h3 className="font-medium">Ask anything about RolliSuite</h3>
                <p className="text-sm text-muted-foreground">
                  Get instant answers about features, workflows, and troubleshooting
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Try asking:</p>
                <div className="grid gap-2">
                  {suggestedQuestions.map((q) => (
                    <Button
                      key={q}
                      variant="outline"
                      className="justify-start h-auto py-2 px-3 text-left"
                      onClick={() => {
                        setQuestion(q);
                      }}
                    >
                      <Search className="h-4 w-4 mr-2 shrink-0" />
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-2 ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {msg.content.split('\n').map((line, i) => (
                          <p key={i} className="mb-1 last:mb-0">
                            {line || <br />}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <form onSubmit={handleSubmit} className="flex gap-2 pt-4 border-t">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about RolliSuite..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !question.trim()}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
