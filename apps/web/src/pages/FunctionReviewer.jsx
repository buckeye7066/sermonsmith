import React, { useState, useEffect, useMemo } from "react";
import { api } from '@/api/apiClient';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Code, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Copy, 
  Check, 
  FileCode, 
  FolderTree,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Github
} from "lucide-react";
import { toast } from "sonner";

// Lightweight single-pass JS syntax highlighter.
//
// The previous version ran a series of regex .replace() passes over text that
// ALREADY contained the HTML it had just inserted — so the later "numbers" and
// "strings" passes matched the digits/quotes inside class names like
// `text-purple-600` and corrupted the markup (the QA report saw garbage like
// `500 italic">// ...`). This tokenizes the source ONCE and escapes each
// segment, so inserted markup is never re-processed.
const HL_KEYWORDS = new Set([
  'import', 'export', 'from', 'const', 'let', 'var', 'function', 'async', 'await',
  'return', 'if', 'else', 'for', 'while', 'try', 'catch', 'throw', 'new', 'class',
  'extends', 'switch', 'case', 'break', 'default', 'continue', 'typeof', 'instanceof',
]);

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightCode(code) {
  if (!code) return "";
  // One scanner for comments | strings | numbers | identifiers; everything
  // else (whitespace, punctuation) is escaped as-is between matches.
  const tokenRe = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][A-Za-z0-9_$]*)/g;
  let out = "";
  let last = 0;
  let m;
  while ((m = tokenRe.exec(code)) !== null) {
    out += escapeHtml(code.slice(last, m.index));
    if (m[1]) {
      out += `<span class="text-gray-500 italic">${escapeHtml(m[1])}</span>`;
    } else if (m[2]) {
      out += `<span class="text-green-600 dark:text-green-400">${escapeHtml(m[2])}</span>`;
    } else if (m[3]) {
      out += `<span class="text-orange-500">${escapeHtml(m[3])}</span>`;
    } else if (m[4]) {
      out += HL_KEYWORDS.has(m[4])
        ? `<span class="text-purple-600 dark:text-purple-400 font-semibold">${escapeHtml(m[4])}</span>`
        : escapeHtml(m[4]);
    }
    last = tokenRe.lastIndex;
  }
  out += escapeHtml(code.slice(last));
  return out;
}

function CodeBlock({ code, title, filePath, defaultOpen = true }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Code copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };
  
  const lineCount = code ? code.split('\n').length : 0;
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg overflow-hidden">
      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-blue-500" />
          <span className="font-medium">{title || filePath}</span>
          <Badge variant="outline" className="text-xs">{lineCount} lines</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
            className="h-7 px-2"
          >
            {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
          </Button>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ScrollArea className="max-h-[500px]">
          <pre className="p-4 bg-gray-50 dark:bg-gray-900 text-sm font-mono overflow-x-auto">
            <code dangerouslySetInnerHTML={{ __html: highlightCode(code) }} />
          </pre>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function FunctionReviewer() {
  const [functions, setFunctions] = useState([]);
  const [selectedFunction, setSelectedFunction] = useState(null);
  const [functionDetails, setFunctionDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeTab, setActiveTab] = useState("code");
  const [syncing, setSyncing] = useState(false);
  
  const categories = useMemo(() => {
    const cats = [...new Set(functions.map(f => f.category))];
    return ["all", ...cats.sort()];
  }, [functions]);

  // Auto-discover functions on mount
  useEffect(() => {
    discoverFunctions();
  }, []);

  const [allFiles, setAllFiles] = useState({ functions: [], pages: [], components: [], entities: [], other: [] });
  const [viewMode, setViewMode] = useState('functions'); // functions, pages, components, entities, all

  const discoverFunctions = async () => {
    setDiscovering(true);
    try {
      const result = await api.functions.invoke('discoverFunctions', { scope: 'all' });
      if (result?.ok) {
        const data = result.data || result;
        setAllFiles({
          functions: data.functions || [],
          pages: data.pages || [],
          components: data.components || [],
          entities: data.entities || [],
          other: data.other || []
        });
        setFunctions(data.functions || []);
        toast.success(`Discovered ${data.totals?.all || 0} files`);
      } else {
        toast.error(result?.error || 'Discovery failed');
      }
    } catch (err) {
      console.error('Error: ', err);
      toast.error('Discovery failed. Please try again later.');
    } finally {
      setDiscovering(false);
    }
  };

  // Get current file list based on view mode
  const currentFiles = useMemo(() => {
    switch (viewMode) {
      case 'functions': return allFiles.functions;
      case 'pages': return allFiles.pages;
      case 'components': return allFiles.components;
      case 'entities': return allFiles.entities;
      case 'all': return [...allFiles.functions, ...allFiles.pages, ...allFiles.components, ...allFiles.entities, ...allFiles.other];
      default: return allFiles.functions;
    }
  }, [viewMode, allFiles]);
  
  const filteredFunctions = useMemo(() => {
    let filtered = currentFiles;
    
    if (viewMode === 'functions' && selectedCategory !== "all") {
      filtered = filtered.filter(f => f.category === selectedCategory);
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(f => 
        (f.id || '').toLowerCase().includes(q) ||
        (f.name || '').toLowerCase().includes(q) ||
        (f.description || '').toLowerCase().includes(q) ||
        (f.path || '').toLowerCase().includes(q)
      );
    }
    
    return filtered;
  }, [currentFiles, viewMode, selectedCategory, searchQuery]);
  
  const currentIndex = useMemo(() => {
    if (!selectedFunction) return -1;
    const sel = selectedFunction.functionId || selectedFunction.id;
    return filteredFunctions.findIndex(f => (f.functionId || f.id) === sel);
  }, [filteredFunctions, selectedFunction]);
  
  const loadFunctionDetails = async (func) => {
    setLoading(true);
    setError(null);
    setSelectedFunction(func);
    
    try {
      const result = await api.functions.invoke('getFunctionDetails', {
        // Discovery returns objects keyed by `id`; older shapes used
        // `functionId`. Accept either so the detail view never sends undefined
        // (which the backend rejects with "functionId is required").
        functionId: func.functionId || func.id
      });
      
      if (result?.ok) {
        setFunctionDetails(result.data || result);
      } else {
        setError(result?.error || 'Failed to load function details');
        setFunctionDetails(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to load function details');
      setFunctionDetails(null);
    } finally {
      setLoading(false);
    }
  };
  
  const navigateFunction = (direction) => {
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'prev' 
      ? Math.max(0, currentIndex - 1)
      : Math.min(filteredFunctions.length - 1, currentIndex + 1);
    
    if (newIndex !== currentIndex) {
      loadFunctionDetails(filteredFunctions[newIndex]);
    }
  };
  
  const getCategoryColor = (category) => {
    const colors = {
      bible: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      export: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      payment: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      content: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      import: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      system: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
    };
    return colors[category] || colors.system;
  };

  const [syncProgress, setSyncProgress] = useState(null);

  const syncAllToGitHub = async () => {
    setSyncing(true);
    setSyncProgress({ phase: 'collecting', collected: 0, total: 0 });
    
    try {
      const filesToSync = [];
      const allDiscoveredFiles = [
        ...allFiles.functions,
        ...allFiles.pages,
        ...allFiles.components,
        ...allFiles.entities,
        ...allFiles.other
      ];
      
      setSyncProgress({ phase: 'fetching', collected: 0, total: allDiscoveredFiles.length });

      // Fetch content for all files in parallel batches
      const BATCH_SIZE = 10;
      for (let i = 0; i < allDiscoveredFiles.length; i += BATCH_SIZE) {
        const batch = allDiscoveredFiles.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (file) => {
          try {
            if (file.type === 'function') {
              const r = await api.functions.invoke('getFunctionDetails', { functionId: file.id });
              const rd = r?.data || r;
              if (r?.ok && rd?.sourceCode) {
                return { path: file.path, content: rd.sourceCode };
              }
            }
            // For non-functions, content should already be available from discovery if includeContent was true
            // Otherwise we skip them (they're already on GitHub)
            return null;
          } catch {
            return null;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        const validResults = batchResults.filter(r => r !== null);
        filesToSync.push(...validResults);
        
        setSyncProgress({ phase: 'fetching', collected: filesToSync.length, total: allDiscoveredFiles.length });
      }

      if (filesToSync.length === 0) {
        toast.error("No files to sync");
        setSyncing(false);
        setSyncProgress(null);
        return;
      }

      setSyncProgress({ phase: 'uploading', collected: filesToSync.length, total: filesToSync.length });

      const syncResult = await api.functions.invoke('syncToGitHub', {
        files: filesToSync,
        message: `Auto-sync ${filesToSync.length} files from server`
      });

      if (syncResult?.ok) {
        const { success, failed } = syncResult.data || syncResult;
        if (failed > 0) {
          toast.warning(`Synced ${success} files, ${failed} failed`);
        } else {
          toast.success(`Synced ${success} files to GitHub (parallel mode)`);
        }
      } else {
        toast.error(syncResult?.error || "Sync failed");
      }
    } catch (err) {
      toast.error(err.message || "Sync failed");
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Code className="w-8 h-8 text-blue-600" />
              Function Reviewer
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Browse and review all backend functions in this app
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={discoverFunctions}
              disabled={discovering}
              variant="outline"
            >
              {discovering ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {discovering ? "Discovering..." : "Refresh"}
            </Button>
            <Button
              onClick={syncAllToGitHub}
              disabled={syncing}
              className="bg-gray-900 hover:bg-gray-800"
            >
              {syncing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Github className="w-4 h-4 mr-2" />
              )}
              {syncing 
                ? syncProgress 
                  ? `${syncProgress.phase}: ${syncProgress.collected}/${syncProgress.total}`
                  : "Syncing..." 
                : "Sync All to GitHub"}
              </Button>
              </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Function List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FolderTree className="w-5 h-5" />
                  Files ({currentFiles.length})
                  {discovering && <Loader2 className="w-4 h-4 animate-spin" />}
                </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                {/* View Mode Selector */}
                <div className="flex flex-wrap gap-1 pb-2 border-b">
                  {[
                    { key: 'functions', label: 'Functions', count: allFiles.functions.length },
                    { key: 'pages', label: 'Pages', count: allFiles.pages.length },
                    { key: 'components', label: 'Components', count: allFiles.components.length },
                    { key: 'entities', label: 'Entities', count: allFiles.entities.length }
                  ].map(mode => (
                    <Badge
                      key={mode.key}
                      variant={viewMode === mode.key ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => setViewMode(mode.key)}
                    >
                      {mode.label} ({mode.count})
                    </Badge>
                  ))}
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder={`Search ${viewMode}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Category Filter (only for functions) */}
                {viewMode === 'functions' && (
                  <div className="flex flex-wrap gap-1">
                    {categories.map(cat => (
                      <Badge
                        key={cat}
                        variant={selectedCategory === cat ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() => setSelectedCategory(cat)}
                      >
                        {cat}
                      </Badge>
                    ))}
                  </div>
                )}
                
                {/* File List */}
                <ScrollArea className="h-[500px]">
                  <div className="space-y-1">
                    {filteredFunctions.map((file, idx) => (
                      <button
                        key={file.path || file.id}
                        onClick={() => viewMode === 'functions' ? loadFunctionDetails(file) : setSelectedFunction(file)}
                        className={`w-full text-left p-2 rounded-lg transition-colors ${
                          selectedFunction?.id === file.id || selectedFunction?.path === file.path
                            ? 'bg-blue-100 dark:bg-blue-900 border-l-4 border-blue-500'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm truncate">{file.id || file.name}</span>
                          {file.category && (
                            <Badge className={`text-[10px] ${getCategoryColor(file.category)}`}>
                              {file.category}
                            </Badge>
                          )}
                          {file.type && file.type !== 'function' && (
                            <Badge variant="outline" className="text-[10px]">
                              {file.type}
                            </Badge>
                          )}
                        </div>
                        {file.description && (
                          <p className="text-xs text-gray-500 mt-1 truncate">{file.description}</p>
                        )}
                        {file.path && !file.description && (
                          <p className="text-xs text-gray-400 mt-1 truncate">{file.path}</p>
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
          
          {/* Main Content */}
          <div className="lg:col-span-3">
            {!selectedFunction ? (
              <Card className="h-full flex items-center justify-center">
                <CardContent className="text-center py-12">
                  <FileCode className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-xl font-medium text-gray-600">Select a Function</h3>
                  <p className="text-gray-500 mt-2">
                    Choose a function from the sidebar to view its source code and details
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileCode className="w-5 h-5 text-blue-500" />
                        {selectedFunction.functionId || selectedFunction.id || selectedFunction.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {selectedFunction.filePath || selectedFunction.path}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigateFunction('prev')}
                        disabled={currentIndex <= 0}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Prev
                      </Button>
                      <span className="text-sm text-gray-500">
                        {currentIndex + 1} / {filteredFunctions.length}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigateFunction('next')}
                        disabled={currentIndex >= filteredFunctions.length - 1}
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Metadata Badges */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge className={getCategoryColor(selectedFunction.category)}>
                      {selectedFunction.category}
                    </Badge>
                    <Badge variant="outline">
                      Export: {selectedFunction.exportType}
                    </Badge>
                    {selectedFunction.dependencyPaths?.length > 0 && (
                      <Badge variant="outline">
                        {selectedFunction.dependencyPaths.length} dependencies
                      </Badge>
                    )}
                  </div>
                  
                  {selectedFunction.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      {selectedFunction.description}
                    </p>
                  )}
                </CardHeader>
                
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                      <span className="ml-3 text-gray-600">Loading function details...</span>
                    </div>
                  ) : error ? (
                    <Alert variant="destructive">
                      <AlertCircle className="w-4 h-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : (
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                      <TabsList className="mb-4">
                        <TabsTrigger value="code">Source Code</TabsTrigger>
                        <TabsTrigger value="dependencies">
                          Dependencies ({functionDetails?.dependencies?.length || 0})
                        </TabsTrigger>
                        <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="code" className="space-y-4">
                        {(functionDetails?.sourceCode || functionDetails?.code) ? (
                          <CodeBlock
                            code={functionDetails.sourceCode || functionDetails.code}
                            title={`${selectedFunction.functionId || selectedFunction.id}.js`}
                            filePath={selectedFunction.filePath || selectedFunction.path}
                            defaultOpen={true}
                          />
                        ) : (
                          <Alert>
                            <AlertCircle className="w-4 h-4" />
                            <AlertDescription>
                              Source code not available in runtime cache. 
                              View in the API dashboard to manage functions.
                            </AlertDescription>
                          </Alert>
                        )}
                      </TabsContent>
                      
                      <TabsContent value="dependencies" className="space-y-4">
                        {functionDetails?.dependencies?.length > 0 ? (
                          functionDetails.dependencies.map((dep, idx) => (
                            <CodeBlock
                              key={dep.filePath}
                              code={dep.code}
                              title={dep.filePath.split('/').pop()}
                              filePath={dep.filePath}
                              defaultOpen={idx === 0}
                            />
                          ))
                        ) : (
                          <Alert>
                            <AlertDescription>
                              This function has no dependencies.
                            </AlertDescription>
                          </Alert>
                        )}
                      </TabsContent>
                      
                      <TabsContent value="raw">
                        <CodeBlock
                          code={JSON.stringify(functionDetails, null, 2)}
                          title="Raw JSON Response"
                          defaultOpen={true}
                        />
                      </TabsContent>
                    </Tabs>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}