import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { logError } from '@/lib/logError';
import { LARRY_SYSTEM_PROMPT } from '@/ai/personas';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Languages, BookOpen, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BOOK_NAME_TO_OSIS } from "../bible/bibleSources";

export default function VersionComparison({ book, chapter, onClose }) {
  const [selectedVersions, setSelectedVersions] = useState(['en-kjv', 'en-web']);
  const [availableTranslations, setAvailableTranslations] = useState([]);
  const [comparisonData, setComparisonData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [aiComparison, setAiComparison] = useState(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [selectedVerseForAI, setSelectedVerseForAI] = useState(null);

  useEffect(() => {
    loadAvailableTranslations();
  }, []);

  useEffect(() => {
    // Guard: don't try to fetch passages until we have the bare minimum
    // inputs. Otherwise we hit /biblePassage with empty body and rack up
    // a string of "Bible API returned 400" failures every render.
    if (selectedVersions.length > 0 && book && chapter) {
      loadComparisonData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy effect intentionally keeps existing trigger behavior.
  }, [selectedVersions, book, chapter]);

  const loadAvailableTranslations = async () => {
    try {
      const payload = await api.functions.invoke('listAvailableTranslations');
      if (payload?.translations) {
        setAvailableTranslations(payload.translations);
      }
    } catch (error) {
      const msg = logError('Failed to load translations', error, {
        endpoint: 'listAvailableTranslations',
        component: 'VersionComparison',
      });
      toast.error(`Translation list unavailable: ${msg}`);
    }
  };

  const loadComparisonData = async () => {
    setIsLoading(true);
    try {
      const bookCode = BOOK_NAME_TO_OSIS[book];
      
      if (!bookCode) {
        toast.error('Invalid book name');
        setIsLoading(false);
        return;
      }

      const dataPromises = selectedVersions.map(async (translationId) => {
        try {
          const result = await api.functions.invoke('biblePassage', {
            translationId,
            bookCode,
            chapter
          });
          return {
            translationId,
            translation: availableTranslations.find(t => t.id === translationId),
            verses: result?.verses || []
          };
        } catch (error) {
          logError('Error fetching passages for translation', error, {
            endpoint: 'biblePassage',
            translationId,
            bookCode,
            chapter
          });
          toast.error(`Failed to fetch passages for ${translationId}`);
          return {
            translationId,
            translation: availableTranslations.find(t => t.id === translationId),
            verses: []
          };
        }
      });

      const results = await Promise.all(dataPromises);
      setComparisonData(results);
    } catch (error) {
      const msg = logError('Error loading comparison', error, {
        endpoint: 'biblePassage',
        book,
        chapter,
        selectedVersions,
        component: 'VersionComparison',
      });
      toast.error(`Couldn't load comparison: ${msg}`);
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

  const generateAIComparison = async (verseIndex) => {
    setIsGeneratingAI(true);
    setSelectedVerseForAI(verseIndex);
    
    try {
      const verseNumber = verseIndex + 1;
      const versesText = comparisonData.map(data => {
        const verse = data.verses[verseIndex];
        return `**${data.translation?.name}** (${data.translation?.year}): "${verse?.text}"`;
      }).join('\n\n');

      const prompt = `Compare and contrast these Bible translations of ${book} ${chapter}:${verseNumber}

${versesText}

Provide:
1. **Key Differences**: What are the main translation differences and why?
2. **Linguistic Analysis**: Which words or phrases differ most significantly?
3. **Theological Implications**: Do these differences affect meaning or interpretation?
4. **Original Language Caveat**: Note whether the app has supplied enough source material for Hebrew/Greek/Aramaic claims. If not, say pastoral review and a lexicon/source check are required instead of inventing details.
5. **Recommendation**: Which translation captures the meaning best for general readers?

Be scholarly yet accessible. Do not fabricate original-language claims or citations. About 300-350 words.`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        feature: 'reader_insight',
        response_json_schema: {
          type: "object",
          properties: {
            key_differences: { type: "string" },
            linguistic_analysis: { type: "string" },
            theological_implications: { type: "string" },
            original_language: { type: "string" },
            recommendation: { type: "string" }
          }
        }
      });

      setAiComparison({ verseIndex, analysis: response });
    } catch (error) {
      console.error("Error generating AI comparison:", error);
      toast.error("Failed to generate AI comparison");
    } finally {
      setIsGeneratingAI(false);
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
                  <div key={verseIndex} className="border-l-4 border-blue-500 pl-4 space-y-4">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="outline" className="text-sm">
                        Verse {verseNumber}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateAIComparison(verseIndex)}
                        disabled={isGeneratingAI || selectedVersions.length < 2}
                        className="gap-2"
                      >
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        {isGeneratingAI && selectedVerseForAI === verseIndex ? "Analyzing..." : "AI Compare"}
                      </Button>
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
                                {data.translation?.year} • {data.translation?.language?.toUpperCase()}
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

                    {aiComparison && aiComparison.verseIndex === verseIndex && (
                      <Alert className="bg-purple-50 dark:bg-purple-900/20 border-purple-200">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <AlertDescription>
                          <div className="space-y-3 mt-2">
                            <div>
                              <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">
                                🔍 Key Differences
                              </h4>
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                {aiComparison.analysis.key_differences}
                              </p>
                            </div>
                            
                            <div>
                              <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">
                                📖 Linguistic Analysis
                              </h4>
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                {aiComparison.analysis.linguistic_analysis}
                              </p>
                            </div>

                            <div>
                              <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">
                                ⛪ Theological Implications
                              </h4>
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                {aiComparison.analysis.theological_implications}
                              </p>
                            </div>

                            <div>
                              <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">
                                🌍 Original Language Insight
                              </h4>
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                {aiComparison.analysis.original_language}
                              </p>
                            </div>

                            <div>
                              <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">
                                ✅ Recommendation
                              </h4>
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                {aiComparison.analysis.recommendation}
                              </p>
                            </div>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
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
