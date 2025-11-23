import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Languages, BookOpen, X } from "lucide-react";
import { toast } from "sonner";

export default function VersionComparison({ book, chapter, onClose }) {
  const [selectedVersions, setSelectedVersions] = useState(['en-kjv', 'en-web']);
  const [availableTranslations, setAvailableTranslations] = useState([]);
  const [comparisonData, setComparisonData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadAvailableTranslations();
  }, []);

  useEffect(() => {
    if (selectedVersions.length > 0) {
      loadComparisonData();
    }
  }, [selectedVersions, book, chapter]);

  const loadAvailableTranslations = async () => {
    try {
      const response = await base44.functions.invoke('listAvailableTranslations');
      if (response.data?.translations) {
        // Show all translations, not just available ones
        setAvailableTranslations(response.data.translations);
      }
    } catch (error) {
      console.error('Failed to load translations:', error);
    }
  };

  const loadComparisonData = async () => {
    setIsLoading(true);
    try {
      const { BOOK_NAME_TO_OSIS } = await import("../bible/bibleSources");
      const bookCode = BOOK_NAME_TO_OSIS[book];
      
      if (!bookCode) {
        toast.error('Invalid book name');
        setIsLoading(false);
        return;
      }

      const dataPromises = selectedVersions.map(async (translationId) => {
        const response = await base44.functions.invoke('biblePassage', {
          translationId,
          bookCode,
          chapter
        });
        return {
          translationId,
          translation: availableTranslations.find(t => t.id === translationId),
          verses: response.data?.verses || []
        };
      });

      const results = await Promise.all(dataPromises);
      setComparisonData(results);
    } catch (error) {
      console.error('Error loading comparison:', error);
      toast.error('Failed to load comparison data');
    } finally {
      setIsLoading(false);
    }
  };

  const addVersion = (translationId) => {
    if (!selectedVersions.includes(translationId) && selectedVersions.length < 4) {
      setSelectedVersions([...selectedVersions, translationId]);
    } else if (selectedVersions.length >= 4) {
      toast.error('Maximum 4 versions for comparison');
    }
  };

  const removeVersion = (translationId) => {
    if (selectedVersions.length > 1) {
      setSelectedVersions(selectedVersions.filter(v => v !== translationId));
    } else {
      toast.error('At least one version must be selected');
    }
  };

  // Group translations by language/type
  const groupedTranslations = availableTranslations.reduce((acc, t) => {
    let group = 'Other';
    if (t.language === 'en') group = 'English';
    else if (t.language === 'he') group = 'Hebrew (Original)';
    else if (t.language === 'el') group = 'Greek (Original)';
    else if (t.language === 'arc') group = 'Aramaic (Original)';
    else if (['es', 'fr', 'de', 'it', 'pt'].includes(t.language)) group = 'European';
    else if (['zh', 'ja', 'ko', 'vi', 'th'].includes(t.language)) group = 'Asian';
    else if (['ar', 'hi', 'bn'].includes(t.language)) group = 'Middle East & South Asian';
    else if (['ru', 'uk'].includes(t.language)) group = 'Slavic';

    if (!acc[group]) acc[group] = [];
    acc[group].push(t);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Languages className="w-6 h-6 text-blue-500" />
              Compare Translations - {book} {chapter}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex gap-2 mt-4 flex-wrap">
            {selectedVersions.map((versionId) => {
              const translation = availableTranslations.find(t => t.id === versionId);
              return (
                <Badge key={versionId} variant="secondary" className="flex items-center gap-1 pl-3 pr-1 py-1">
                  <span>{translation?.name || versionId}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => removeVersion(versionId)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </Badge>
              );
            })}
            {selectedVersions.length < 4 && (
              <Select onValueChange={addVersion}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="+ Add Version" />
                </SelectTrigger>
                <SelectContent className="max-h-96">
                  {Object.entries(groupedTranslations).map(([group, translations]) => (
                    <React.Fragment key={group}>
                      <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
                        {group}
                      </div>
                      {translations.map((translation) => (
                        <SelectItem 
                          key={translation.id} 
                          value={translation.id}
                          disabled={selectedVersions.includes(translation.id)}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>{translation.name}</span>
                            {(translation.language === 'he' || translation.language === 'el' || translation.language === 'arc') && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Original
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="ml-3">Loading translations...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {comparisonData.length > 0 && comparisonData[0].verses.map((_, verseIndex) => {
                const verseNumber = verseIndex + 1;
                return (
                  <div key={verseIndex} className="border-l-4 border-blue-500 pl-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="text-sm">
                        Verse {verseNumber}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {comparisonData.map((data) => {
                        const verse = data.verses[verseIndex];
                        if (!verse) return null;

                        const isOriginalLanguage = ['he', 'el', 'arc'].includes(data.translation?.language);

                        return (
                          <Card key={data.translationId} className="border-2">
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <div className="font-semibold text-sm">{data.translation?.name}</div>
                                {isOriginalLanguage && (
                                  <Badge variant="secondary" className="text-xs">
                                    <BookOpen className="w-3 h-3 mr-1" />
                                    Original
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                {data.translation?.year} • {data.translation?.language.toUpperCase()}
                              </div>
                            </CardHeader>
                            <CardContent>
                              <p className={`text-sm leading-relaxed ${isOriginalLanguage ? 'text-lg' : ''}`}>
                                {verse.text}
                              </p>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}