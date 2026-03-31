import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Save, X, BookOpen, ChevronRight, Printer, Settings2, Barcode } from "lucide-react";
import InspectionRulesEditor from "@/components/wiki/InspectionRulesEditor";
import ServiceCodeEditor from "@/components/wiki/ServiceCodeEditor";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useHasPermission } from "@/hooks/use-permissions";
import { toast } from "sonner";

interface WikiArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: "inspection_rules", label: "Inspection Rules", color: "bg-teal-100 text-teal-800" },
  { value: "email", label: "Email", color: "bg-blue-100 text-blue-800" },
  { value: "workflow", label: "Workflow", color: "bg-purple-100 text-purple-800" },
  { value: "integrations", label: "Integrations", color: "bg-amber-100 text-amber-800" },
  { value: "general", label: "General", color: "bg-stone-100 text-stone-800" },
];

function getCategoryStyle(cat: string) {
  return CATEGORIES.find((c) => c.value === cat) || CATEGORIES[CATEGORIES.length - 1];
}

/** Simple markdown-like renderer for wiki content */
function renderContent(content: string) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("# ")) {
      elements.push(<h2 key={i} className="text-base font-bold mt-4 mb-2 text-foreground">{line.slice(2)}</h2>);
    } else if (line.startsWith("## ")) {
      elements.push(<h3 key={i} className="text-sm font-semibold mt-3 mb-1.5 text-foreground">{line.slice(3)}</h3>);
    } else if (line.startsWith("- ")) {
      elements.push(
        <div key={i} className="flex gap-2 text-xs text-muted-foreground leading-relaxed ml-2">
          <span className="text-muted-foreground/50 shrink-0">•</span>
          <span dangerouslySetInnerHTML={{ __html: formatInline(line.slice(2)) }} />
        </div>
      );
    } else if (line.match(/^\d+\.\s/)) {
      const text = line.replace(/^\d+\.\s/, "");
      elements.push(
        <div key={i} className="flex gap-2 text-xs text-muted-foreground leading-relaxed ml-2">
          <span className="text-muted-foreground/50 shrink-0 tabular-nums">{line.match(/^\d+/)?.[0]}.</span>
          <span dangerouslySetInnerHTML={{ __html: formatInline(text) }} />
        </div>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-1.5" />);
    } else {
      elements.push(
        <p key={i} className="text-xs text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
      );
    }
  }

  return <div className="space-y-0.5">{elements}</div>;
}

function formatInline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-muted rounded text-[11px] font-mono text-foreground">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
}

export default function Wiki() {
  usePageMeta({ title: "Documentation • WatchFlow" });
  const queryClient = useQueryClient();
  const canEdit = useHasPermission("inspections.view"); // owners/managers
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("general");
  const [isCreating, setIsCreating] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"docs" | "rules" | "codes">("docs");

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["wiki_articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wiki_articles")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true });
      if (error) throw error;
      return data as WikiArticle[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, title, content, category }: { id?: string; title: string; content: string; category: string }) => {
      if (id) {
        const { error } = await supabase.from("wiki_articles").update({ title, content, category }).eq("id", id);
        if (error) throw error;
      } else {
        const maxOrder = articles.reduce((max, a) => Math.max(max, a.sort_order), 0);
        const { data, error } = await supabase.from("wiki_articles").insert({ title, content, category, sort_order: maxOrder + 1 }).select().single();
        if (error) throw error;
        setSelectedId(data.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wiki_articles"] });
      setEditingId(null);
      setIsCreating(false);
      toast.success("Article saved");
    },
    onError: (err: any) => toast.error(err.message || "Failed to save"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wiki_articles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wiki_articles"] });
      setSelectedId(null);
      toast.success("Article deleted");
    },
  });

  const startEdit = (article: WikiArticle) => {
    setEditingId(article.id);
    setEditTitle(article.title);
    setEditContent(article.content);
    setEditCategory(article.category);
  };

  const startCreate = () => {
    setIsCreating(true);
    setEditingId("new");
    setEditTitle("");
    setEditContent("");
    setEditCategory("general");
    setSelectedId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
  };

  const handleSave = () => {
    if (!editTitle.trim()) return toast.error("Title is required");
    saveMutation.mutate({
      id: editingId === "new" ? undefined : editingId!,
      title: editTitle.trim(),
      content: editContent,
      category: editCategory,
    });
  };

  const filtered = filterCategory ? articles.filter((a) => a.category === filterCategory) : articles;
  const selected = articles.find((a) => a.id === selectedId);

  return (
    <div className="space-y-3 overflow-x-hidden min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Documentation</h1>
          <Badge variant="secondary" className="text-[10px]">{articles.length} articles</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden">
            <button
              onClick={() => setActiveTab("docs")}
              className={`px-3 py-1 text-[11px] font-medium transition-colors ${
                activeTab === "docs" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              Articles
            </button>
            <button
              onClick={() => setActiveTab("codes")}
              className={`px-3 py-1 text-[11px] font-medium transition-colors ${
                activeTab === "codes" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <Barcode className="h-3 w-3 inline mr-1" />
              Codes
            </button>
            <button
              onClick={() => setActiveTab("rules")}
              className={`px-3 py-1 text-[11px] font-medium transition-colors ${
                activeTab === "rules" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <Settings2 className="h-3 w-3 inline mr-1" />
              Rules
            </button>
          </div>
          {canEdit && activeTab === "docs" && (
            <Button size="sm" className="h-7 text-xs" onClick={startCreate}>
              <Plus className="h-3 w-3 mr-1" /> New Article
            </Button>
          )}
        </div>
      </div>

      {activeTab === "codes" ? (
        <ServiceCodeEditor />
      ) : activeTab === "rules" ? (
        <InspectionRulesEditor />
      ) : (
        <>

      {/* Category Filter */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => setFilterCategory(null)}
          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
            !filterCategory ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setFilterCategory(filterCategory === cat.value ? null : cat.value)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              filterCategory === cat.value ? "bg-primary text-primary-foreground" : `${cat.color} hover:opacity-80`
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3" style={{ minHeight: "60vh" }}>
        {/* Article List */}
        <div className="md:col-span-1 space-y-1.5 overflow-y-auto" style={{ maxHeight: "70vh" }}>
          {isLoading ? (
            <p className="text-xs text-muted-foreground p-4">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4">No articles found.</p>
          ) : (
            filtered.map((article) => {
              const catStyle = getCategoryStyle(article.category);
              const isActive = selectedId === article.id;
              return (
                <button
                  key={article.id}
                  onClick={() => { setSelectedId(article.id); setEditingId(null); setIsCreating(false); }}
                  className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                    isActive
                      ? "bg-primary/5 border-primary/30"
                      : "bg-card border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${isActive ? "text-primary" : "text-foreground"}`}>
                        {article.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`px-1.5 py-0 rounded text-[9px] font-medium ${catStyle.color}`}>
                          {catStyle.label}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${isActive ? "text-primary" : "text-muted-foreground/30"}`} />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Article Content / Editor */}
        <div className="md:col-span-2">
          {editingId ? (
            <Card className="border-primary/30">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Article title"
                    className="h-8 text-sm font-semibold"
                  />
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="h-8 text-xs border rounded px-2 bg-background"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Write documentation using markdown-style formatting...&#10;&#10;# Heading&#10;## Subheading&#10;- Bullet point&#10;**bold** `code`"
                  className="min-h-[50vh] text-xs font-mono leading-relaxed"
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={cancelEdit}>
                    <X className="h-3 w-3 mr-1" /> Cancel
                  </Button>
                  <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saveMutation.isPending}>
                    <Save className="h-3 w-3 mr-1" /> Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : selected ? (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-sm font-bold text-foreground">{selected.title}</h2>
                    <span className={`px-1.5 py-0 rounded text-[9px] font-medium ${getCategoryStyle(selected.category).color}`}>
                      {getCategoryStyle(selected.category).label}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      title="Print article"
                      onClick={() => {
                        const printArea = document.getElementById("wiki-print-area");
                        if (!printArea) return;
                        const win = window.open("", "_blank");
                        if (!win) return;
                        win.document.write(`<!DOCTYPE html><html><head><title>${selected.title}</title><style>
                          body { font-family: system-ui, sans-serif; padding: 40px; color: #111; max-width: 700px; margin: 0 auto; }
                          h1 { font-size: 18px; margin-bottom: 4px; } h2 { font-size: 15px; margin-top: 16px; } h3 { font-size: 13px; margin-top: 12px; }
                          p, li, span { font-size: 12px; line-height: 1.6; } code { background: #eee; padding: 1px 4px; border-radius: 3px; font-size: 11px; }
                          .cat { font-size: 10px; color: #666; margin-bottom: 16px; display: block; } .footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 10px; color: #999; }
                        </style></head><body>
                          <h1>${selected.title}</h1>
                          <span class="cat">${getCategoryStyle(selected.category).label}</span>
                          ${printArea.innerHTML}
                          <div class="footer">Last updated: ${new Date(selected.updated_at).toLocaleDateString()} · Printed: ${new Date().toLocaleDateString()}</div>
                        </body></html>`);
                        win.document.close();
                        win.print();
                      }}
                    >
                      <Printer className="h-3 w-3" />
                    </Button>
                    {canEdit && (
                      <>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(selected)}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => {
                            if (confirm("Delete this article?")) deleteMutation.mutate(selected.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div id="wiki-print-area" className="border-t pt-3">
                  {renderContent(selected.content)}
                </div>
                <p className="text-[10px] text-muted-foreground mt-4 pt-2 border-t">
                  Last updated: {new Date(selected.updated_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Select an article to view</p>
              </div>
            </div>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
}
