import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { logError } from '@/lib/logError';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Globe, Search, Lock, Check, BookOpen, Loader2, Languages, Crown, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

// Region icons/colors for visual appeal
const regionConfig = {
  europe: { icon: "🏰", color: "bg-blue-500", lightColor: "bg-blue-100 text-blue-800" },
  middle_east: { icon: "🕌", color: "bg-amber-500", lightColor: "bg-amber-100 text-amber-800" },
  asia: { icon: "🏯", color: "bg-red-500", lightColor: "bg-red-100 text-red-800" },
  africa: { icon: "🌍", color: "bg-green-500", lightColor: "bg-green-100 text-green-800" },
  americas: { icon: "🗽", color: "bg-purple-500", lightColor: "bg-purple-100 text-purple-800" },
  oceania: { icon: "🏝️", color: "bg-cyan-500", lightColor: "bg-cyan-100 text-cyan-800" },
  other: { icon: "📚", color: "bg-gray-500", lightColor: "bg-gray-100 text-gray-800" }
};

export default function TranslationBrowser({ 
  open, 
  onClose, 
  currentTranslation, 
  onTranslationChange 
}) {
  const [translations, setTranslations] = useState([]);
  const [byRegion, setByRegion] = useState({});
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [isPremium, setIsPremium] = useState(false);
  const [, setIsDeveloper] = useState(false);
  const [externalEnabled, setExternalEnabled] = useState(false);
  const [catalogDegraded, setCatalogDegraded] = useState(false);
  const [catalogStale, setCatalogStale] = useState(false);

  useEffect(() => {
    if (open) {
      // Reset filter state each time the modal opens. Without this, a prior
      // search term (and region tab) persisted across closes, so reopening
      // could show a stale "No translations found" list.
      setSearchQuery("");
      setSelectedRegion("all");
      loadTranslations();
    }
  }, [open]);

  const loadTranslations = async () => {
    setIsLoading(true);
    try {
      const result = await api.functions.invoke('listAvailableTranslations');

      if (!result || result.ok === false) {
        throw new Error(result?.error || 'Failed to load translations');
      }

      const data = result.data || result;
      
      setTranslations(data.translations || []);
      setByRegion(data.byRegion || {});
      setStats(data.stats || null);
      setIsPremium(data.is_premium || false);
      setIsDeveloper(data.is_developer || false);
      setExternalEnabled(!!data.external_enabled);
      setCatalogDegraded(!!data.premium_catalog_degraded);
      setCatalogStale(!!data.premium_catalog_stale);
    } catch (error) {
      const msg = logError('Failed to load translations', error, {
        endpoint: 'listAvailableTranslations',
        component: 'TranslationBrowser',
      });
      toast.error(`Failed to load translations: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTranslation = (translation) => {
    if (!translation.available) {
      toast.error("Premium Required", {
        description: "Upgrade to Premium to unlock this translation and the full multilingual library."
      });
      return;
    }
    
    onTranslationChange(translation.id);
    toast.success(`Switched to ${translation.name}`, {
      description: `${translation.language} translation`
    });
    onClose();
  };

  // Filter translations
  const filteredTranslations = translations.filter(t => {
    const matchesSearch = searchQuery === "" || 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.language.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.nativeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(t.id).toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRegion = selectedRegion === "all" || t.region === selectedRegion;
    
    return matchesSearch && matchesRegion;
  });

  // Honest premium-upsell figures: how many translations / languages are locked
  // behind premium, computed from the real catalogue rather than hardcoded.
  const lockedTranslations = translations.filter((t) => !t.available);
  const lockedCount = lockedTranslations.length;
  const lockedLanguages = new Set(lockedTranslations.map((t) => t.languageCode || t.language)).size;

  // Group filtered translations by language
  const groupedByLanguage = {};
  filteredTranslations.forEach(t => {
    const lang = t.language || "Unknown";
    if (!groupedByLanguage[lang]) {
      groupedByLanguage[lang] = [];
    }
    groupedByLanguage[lang].push(t);
  });

  const TranslationCard = ({ translation }) => {
    const isSelected = translation.id === currentTranslation;
    const config = regionConfig[translation.region] || regionConfig.other;
    
    return (
      <Card 
        className={`cursor-pointer transition-all hover:shadow-md ${
          isSelected ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : ''
        } ${!translation.available ? 'opacity-60' : ''}`}
        onClick={() => handleSelectTranslation(translation)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{translation.shortName}</span>
                {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                {!translation.available && <Lock className="w-4 h-4 text-gray-400" />}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{translation.name}</p>
              {translation.nativeName !== translation.name && (
                <p className="text-xs text-gray-500 truncate">{translation.nativeName}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge className={config.lightColor}>
                {config.icon} {translation.language}
              </Badge>
              {/* Show the REAL canon scope from the backend catalogue. Don't
                  print "66 Books" for NT-only / OT-only editions (e.g. "Reina
                  Valera NT 1858" used to claim 66 books impossibly). */}
              {translation.scope === 'nt' ? (
                <Badge variant="outline" className="text-xs">
                  <BookOpen className="w-3 h-3 mr-1" />
                  New Testament
                </Badge>
              ) : translation.scope === 'ot' ? (
                <Badge variant="outline" className="text-xs">
                  <BookOpen className="w-3 h-3 mr-1" />
                  Old Testament
                </Badge>
              ) : translation.isComplete ? (
                <Badge variant="outline" className="text-xs">
                  <BookOpen className="w-3 h-3 mr-1" />
                  66 Books
                </Badge>
              ) : null}
            </div>
          </div>
          {translation.textDirection === 'rtl' && (
            <Badge variant="secondary" className="mt-2 text-xs">
              Right-to-Left
            </Badge>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Globe className="w-7 h-7 text-indigo-600" />
            World Bible Translations
          </DialogTitle>
          <DialogDescription>
            Explore the Word of God in languages from around the globe
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading translations...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Banner */}
            {stats && (
              <div className="grid grid-cols-4 gap-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg">
                <div className="text-center">
                  <div className="text-3xl font-bold text-indigo-600">{stats.total}</div>
                  <div className="text-xs text-gray-600">Translations</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">{stats.languages}</div>
                  <div className="text-xs text-gray-600">Languages</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{stats.complete}</div>
                  <div className="text-xs text-gray-600">Complete Bibles</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-amber-600">{stats.available}</div>
                  <div className="text-xs text-gray-600">
                    {isPremium ? "All Unlocked!" : "Available Free"}
                  </div>
                </div>
              </div>
            )}

            {/* Non-blocking catalogue health notices from the API. */}
            {catalogDegraded && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Premium translation catalogue is temporarily unavailable — showing free translations.
              </p>
            )}
            {!catalogDegraded && catalogStale && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Premium catalogue may be out of date (provider temporarily unreachable).
              </p>
            )}

            {/* Premium Upsell — shown only when there is actually a premium
                catalogue to unlock, with real counts (no hardcoded claims). */}
            {!isPremium && externalEnabled && lockedCount > 0 && (
              <div className="p-4 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-lg border border-yellow-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Crown className="w-8 h-8 text-yellow-600" />
                    <div>
                      <h3 className="font-semibold text-yellow-800">Unlock All Translations</h3>
                      <p className="text-sm text-yellow-700">
                        Get Premium to unlock {lockedCount.toLocaleString()} translations across {lockedLanguages} languages!
                      </p>
                    </div>
                  </div>
                  <Link to={createPageUrl('Pricing')}>
                    <Button className="bg-yellow-500 hover:bg-yellow-600 text-white">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Upgrade Now
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Search and Filters */}
            <div className="flex gap-4 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by language, translation name, or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Region Tabs */}
            <Tabs value={selectedRegion} onValueChange={setSelectedRegion} className="flex-1 flex flex-col min-h-0">
              <TabsList className="w-full justify-start overflow-x-auto flex-shrink-0">
                <TabsTrigger value="all" className="flex items-center gap-1">
                  <Globe className="w-4 h-4" />
                  All
                </TabsTrigger>
                {Object.entries(byRegion).map(([key, region]) => (
                  <TabsTrigger key={key} value={key} className="flex items-center gap-1">
                    <span>{regionConfig[key]?.icon || "📚"}</span>
                    {region.name}
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {region.translations.length}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value={selectedRegion} className="flex-1 mt-4 min-h-0">
                <ScrollArea className="h-[400px]">
                  {Object.keys(groupedByLanguage).length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Languages className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No translations found matching your search</p>
                    </div>
                  ) : (
                    <div className="space-y-6 pr-4">
                      {Object.entries(groupedByLanguage)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([language, langTranslations]) => (
                          <div key={language}>
                            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2 sticky top-0 bg-white dark:bg-gray-900 py-2 z-10">
                              <Languages className="w-5 h-5 text-indigo-600" />
                              {language}
                              <Badge variant="outline">{langTranslations.length}</Badge>
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {langTranslations.map(translation => (
                                <TranslationCard key={translation.id} translation={translation} />
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>

            {/* Current Selection */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-gray-600">
                Currently reading: <strong>{currentTranslation}</strong>
              </div>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}