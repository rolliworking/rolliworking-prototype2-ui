import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { 
  FileText, 
  Download, 
  Search, 
  ChevronRight,
  BookOpen,
  Package,
  Truck,
  ShoppingCart,
  Printer,
  BarChart3,
  Settings,
  Database,
  GitBranch,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { DOCUMENTATION_SECTIONS } from '@/lib/documentation-content';
import { AISearchDialog } from '@/components/help/AISearchDialog';

const SECTION_ICONS: Record<string, React.ElementType> = {
  overview: BookOpen,
  estimates: FileText,
  intake: Package,
  inventory: Package,
  purchasing: Truck,
  sales: ShoppingCart,
  labels: Printer,
  reports: BarChart3,
  setup: Settings,
  database: Database,
  workflows: GitBranch,
  troubleshooting: AlertCircle,
};

export default function DocumentationPage() {
  const [activeSection, setActiveSection] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [aiSearchOpen, setAiSearchOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const filteredSections = searchQuery
    ? DOCUMENTATION_SECTIONS.filter(
        (section) =>
          section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          section.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : DOCUMENTATION_SECTIONS;

  const currentSection = DOCUMENTATION_SECTIONS.find((s) => s.id === activeSection);

  // Simple markdown-to-JSX renderer
  const renderMarkdown = (content: string) => {
    const lines = content.split('\n');
    const elements: JSX.Element[] = [];
    let inList = false;
    let listItems: string[] = [];

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 mb-4 text-muted-foreground">
            {listItems.map((item, i) => (
              <li key={i}>{renderInlineMarkdown(item)}</li>
            ))}
          </ul>
        );
        listItems = [];
      }
      inList = false;
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Headers
      if (trimmed.startsWith('### ')) {
        flushList();
        elements.push(
          <h3 key={index} className="text-lg font-semibold mt-6 mb-2">
            {renderInlineMarkdown(trimmed.slice(4))}
          </h3>
        );
      } else if (trimmed.startsWith('## ')) {
        flushList();
        elements.push(
          <h2 key={index} className="text-xl font-bold mt-8 mb-3 border-b pb-2">
            {renderInlineMarkdown(trimmed.slice(3))}
          </h2>
        );
      } else if (trimmed.startsWith('# ')) {
        flushList();
        elements.push(
          <h1 key={index} className="text-2xl font-bold mt-6 mb-4">
            {renderInlineMarkdown(trimmed.slice(2))}
          </h1>
        );
      }
      // List items
      else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        inList = true;
        listItems.push(trimmed.slice(2));
      }
      // Numbered list
      else if (/^\d+\.\s/.test(trimmed)) {
        flushList();
        const text = trimmed.replace(/^\d+\.\s/, '');
        elements.push(
          <div key={index} className="flex gap-2 mb-2 text-muted-foreground">
            <span className="text-primary font-medium">{trimmed.match(/^\d+/)?.[0]}.</span>
            <span>{renderInlineMarkdown(text)}</span>
          </div>
        );
      }
      // Empty line
      else if (!trimmed) {
        flushList();
      }
      // Regular paragraph
      else {
        flushList();
        elements.push(
          <p key={index} className="mb-3 text-muted-foreground leading-relaxed">
            {renderInlineMarkdown(trimmed)}
          </p>
        );
      }
    });

    flushList();
    return elements;
  };

  const renderInlineMarkdown = (text: string) => {
    // Bold
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { font-size: 12pt; }
          h1 { font-size: 24pt; }
          h2 { font-size: 18pt; page-break-before: always; }
          h3 { font-size: 14pt; }
        }
        .print-only { display: none; }
      `}</style>

      {/* Header */}
      <div className="border-b bg-card no-print">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">RolliSuite Documentation</h1>
                <p className="text-sm text-muted-foreground">
                  Complete guide for administrators and developers
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setAiSearchOpen(true)}>
                <Sparkles className="h-4 w-4 mr-2" />
                AI Search
              </Button>
              <Button variant="outline" onClick={handlePrint}>
                <Download className="h-4 w-4 mr-2" />
                Print / Save PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-64 shrink-0 no-print">
            <div className="sticky top-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search docs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="space-y-1 pr-4">
                  {filteredSections.map((section) => {
                    const Icon = SECTION_ICONS[section.id] || FileText;
                    return (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                          activeSection === section.id
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 text-left">{section.title}</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <Card>
              <CardContent className="p-8" ref={contentRef}>
                {/* Print header */}
                <div className="print-only mb-8 text-center">
                  <h1 className="text-3xl font-bold">RolliSuite Documentation</h1>
                  <p className="text-muted-foreground">Version 1.0</p>
                  <Separator className="my-4" />
                </div>

                {/* Active section content */}
                {currentSection && (
                  <div className="prose prose-slate dark:prose-invert max-w-none">
                    {renderMarkdown(currentSection.content)}
                  </div>
                )}

                {/* Print all sections */}
                <div className="print-only">
                  {DOCUMENTATION_SECTIONS.map((section) => (
                    <div key={section.id} className="mb-8">
                      {renderMarkdown(section.content)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AISearchDialog open={aiSearchOpen} onOpenChange={setAiSearchOpen} />
    </div>
  );
}
