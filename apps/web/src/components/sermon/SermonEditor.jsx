import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FileText, Save, AlertCircle, Crown, BookOpen, Lightbulb, Sparkles, Loader2, Wand2, Presentation, GraduationCap, Search, Download } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router";
import { createPageUrl } from "@/utils";
import SermonAdaptation from "./SermonAdaptation";
import PresentationMode from "./PresentationMode";
import TheologicalExplorer from "./TheologicalExplorer";
import ExegesisHelper from "./ExegesisHelper";

export default function SermonEditor({
  sermonData,
  onSave,
  user,
  onEnhanceIllustration,
  onSuggestScriptures,
  isEnhancing,
  enhancementType
}) {
  const [currentSermon, setCurrentSermon] = useState(sermonData);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(sermonData?.title || "");
  const [showAdaptation, setShowAdaptation] = useState(false);
  const [showPresentation, setShowPresentation] = useState(false);
  const [showTheologyExplorer, setShowTheologyExplorer] = useState(false);
  const [showExegesisHelper, setShowExegesisHelper] = useState(false);
  const [exegesisPassage, setExegesisPassage] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Update internal state when sermonData prop changes
  useEffect(() => {
    if (sermonData) {
      setCurrentSermon(sermonData);
      setEditedTitle(sermonData.title || "");
    }
  }, [sermonData]);

  const isPremium = user && (
    user.subscription_tier === 'premium' ||
    user.premium_override === true ||
    (user.premium_until && new Date(user.premium_until) > new Date()) ||
    user.role === 'admin'
  );

  const handleExport = async (format) => {
    if (!isPremium) {
      toast.error("Export is a Premium feature", {
        description: "Upgrade to export your sermons to PDF and PPTX"
      });
      return;
    }

    if (!sermonData?.id) {
      toast.error("Please save your sermon first", {
        description: "You need to save the sermon before exporting it"
      });
      return;
    }

    setIsExporting(true);
    try {
      // Built in the browser from the sermon currently on screen, so the export
      // reflects unsaved edits and works without a round trip.
      const current = {
        ...currentSermon,
        title: editedTitle || currentSermon?.title,
      };
      let filename;
      if (format === 'pptx') {
        const { exportSermonToPptx } = await import('@/lib/sermonPptx');
        filename = await exportSermonToPptx(current);
      } else {
        const { exportSermonToPdf } = await import('@/lib/sermonPdf');
        filename = await exportSermonToPdf(current);
      }
      toast.success(`Sermon exported to ${format.toUpperCase()}`, { description: filename });
    } catch (error) {
      console.error(`Error exporting to ${format}:`, error);
      toast.error(`Failed to export to ${String(format).toUpperCase()}`, {
        description: error.message
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleAdaptedSermon = (adaptedData) => {
    setCurrentSermon({
      ...currentSermon,
      ...adaptedData
    });
  };

  const handleExegesis = (passage) => {
    setExegesisPassage(passage || currentSermon.anchor_passage || "");
    setShowExegesisHelper(true);
  };

  if (!sermonData || !currentSermon) {
    return (
      <Alert>
        <AlertCircle className="w-4 h-4" />
        <AlertDescription>No sermon data available</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Larry's AI Tools Card */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            Larry's Advanced AI Tools
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => setShowTheologyExplorer(true)}
              className="justify-start h-auto py-4 border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30"
            >
              <GraduationCap className="w-5 h-5 mr-3 text-purple-600" />
              <div className="text-left">
                <div className="font-semibold">Theological Explorer</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Related concepts, denominational views, counter-arguments
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => handleExegesis()}
              className="justify-start h-auto py-4 border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
            >
              <Search className="w-5 h-5 mr-3 text-blue-600" />
              <div className="text-left">
                <div className="font-semibold">Deep Exegesis</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Original languages, context, cross-references
                </div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Title and Metadata */}
      <Card className="border-l-4 border-indigo-500">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {isEditing ? (
                <Input
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onBlur={() => {
                    setIsEditing(false);
                    setCurrentSermon(prev => ({ ...prev, title: editedTitle }));
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      setIsEditing(false);
                      setCurrentSermon(prev => ({ ...prev, title: editedTitle }));
                    }
                  }}
                  autoFocus
                  className="text-2xl font-bold"
                />
              ) : (
                <CardTitle
                  className="text-2xl cursor-pointer hover:text-indigo-600 transition-colors"
                  onClick={() => setIsEditing(true)}
                >
                  {currentSermon.title}
                </CardTitle>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge>{currentSermon.topic}</Badge>
                {currentSermon.tone && <Badge variant="outline">{currentSermon.tone}</Badge>}
                {currentSermon.audience && <Badge variant="outline">{currentSermon.audience.replace('_', ' ')}</Badge>}
                {currentSermon.anchor_passage && (
                  <Badge variant="secondary">
                    <BookOpen className="w-3 h-3 mr-1" />
                    {currentSermon.anchor_passage}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowPresentation(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                <Presentation className="w-4 h-4 mr-2" />
                Present Live
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdaptation(true)}
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Adapt Sermon
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Big Idea */}
      {currentSermon.big_idea && (
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <CardHeader>
            <CardTitle className="text-lg">💡 Big Idea</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium text-gray-800 dark:text-gray-200 leading-relaxed">
              {currentSermon.big_idea}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Theological Notes */}
      {currentSermon.theological_notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Denominational Perspective</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {currentSermon.theological_notes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sermon Points */}
      {currentSermon.points && currentSermon.points.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sermon Points</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="space-y-2">
              {currentSermon.points.map((point, index) => (
                <AccordionItem key={index} value={`point-${index}`} className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <Badge className="bg-indigo-600">{index + 1}</Badge>
                      <span className="font-semibold text-lg">{point.title}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    {/* Exegesis */}
                    {point.exegesis && (
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-blue-600" />
                          Exegesis
                        </h4>
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {point.exegesis}
                        </p>
                      </div>
                    )}

                    {/* Illustration with Enhancement */}
                    {point.illustration && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border-l-4 border-yellow-500">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 flex items-center gap-2">
                            <Lightbulb className="w-4 h-4" />
                            Illustration
                          </h4>
                          {onEnhanceIllustration && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEnhanceIllustration(index)}
                              disabled={isEnhancing}
                              className="text-yellow-700 hover:text-yellow-800"
                            >
                              {isEnhancing && enhancementType === `illustration-${index}` ? (
                                <>
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  Larry is enhancing...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3 h-3 mr-1" />
                                  Enhance with Larry
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {point.illustration}
                        </p>
                      </div>
                    )}

                    {/* Application */}
                    {point.application && (
                      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-l-4 border-green-500">
                        <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                          ✨ Application
                        </h4>
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                          {point.application}
                        </p>
                      </div>
                    )}

                    {/* Supporting Scriptures with Enhancement + Exegesis */}
                    {point.supporting_scriptures && point.supporting_scriptures.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-purple-600" />
                            Supporting Scriptures
                          </h4>
                          <div className="flex gap-2">
                            {onSuggestScriptures && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onSuggestScriptures(index)}
                                disabled={isEnhancing}
                                className="text-purple-600 hover:text-purple-700"
                              >
                                {isEnhancing && enhancementType === `scriptures-${index}` ? (
                                  <>
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    Larry is finding...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3 h-3 mr-1" />
                                    Add More
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {point.supporting_scriptures.map((scripture, sIndex) => (
                            <Badge
                              key={sIndex}
                              variant="outline"
                              className="text-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30"
                              onClick={() => handleExegesis(scripture)}
                              title="Click for deep exegesis"
                            >
                              {scripture}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          💡 Click any scripture for deep exegesis with Larry
                        </p>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Conclusion */}
      {currentSermon.conclusion && (
        <Card className="border-l-4 border-green-500">
          <CardHeader>
            <CardTitle>Conclusion</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {currentSermon.conclusion}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Automatic Scripture-reference results. Saving and presenting remain
          user-controlled; only an invalid public publish/share is blocked. */}
      {(() => {
        const refs = Array.isArray(currentSermon.scripture_validation) ? currentSermon.scripture_validation : [];
        const invalid = refs.filter((r) => r.status === 'invalid_book' || r.status === 'out_of_range' || r.status === 'unparseable');
        const deutero = refs.filter((r) => r.status === 'chapter_checked' || r.status === 'unsupported_canon');

        return (
          <Alert className={invalid.length ? 'border-amber-300' : 'border-green-300'}>
            <AlertDescription>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Editable AI-assisted draft</Badge>
                {invalid.length > 0 && (
                  <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {invalid.length} reference{invalid.length > 1 ? 's need' : ' needs'} attention
                  </Badge>
                )}
                {deutero.length > 0 && (
                  <Badge variant="outline">
                    Deuterocanon reference recognised — exact text source still needed
                  </Badge>
                )}
                {refs.length > 0 && invalid.length === 0 && deutero.length === 0 && (
                  <Badge variant="outline">{refs.length} reference{refs.length > 1 ? 's' : ''} checked</Badge>
                )}
              </div>
              {invalid.length > 0 && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                  {invalid.map((r) => `${r.ref} (${r.status === 'invalid_book' ? 'unknown book' : 'out of range'})`).join(' · ')}
                  {' — '}open the Reader to inspect the cited passage and correct the reference.
                </p>
              )}
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                You choose when to save, present, publish, or share this draft.
              </p>
            </AlertDescription>
          </Alert>
        );
      })()}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={() => onSave(currentSermon)} className="flex-1" size="lg">
          <Save className="w-4 h-4 mr-2" />
          Save Sermon
        </Button>
        {isPremium ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                disabled={isExporting || !sermonData?.id}
                className="flex-1"
                size="lg"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Export {!sermonData?.id && "(Save First)"}
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                <FileText className="w-4 h-4 mr-2" />
                Export to PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pptx')}>
                <FileText className="w-4 h-4 mr-2" />
                Export to PPTX
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="outline"
            disabled
            className="flex-1"
            size="lg"
          >
            <Crown className="w-4 h-4 mr-2" />
            Export (Premium)
          </Button>
        )}
      </div>

      {!isPremium && (
        <Alert className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-purple-200">
          <Crown className="w-4 h-4 text-purple-600" />
          <AlertDescription className="flex items-center justify-between">
            <span>Upgrade to Premium to export sermons and access all features</span>
            <Link to={createPageUrl("Pricing")}>
              <Button size="sm" className="ml-4 bg-purple-600 hover:bg-purple-700">
                Upgrade
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* AI Disclaimer */}
      <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200">
        <AlertCircle className="w-4 h-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <strong>Note:</strong> This sermon was generated by Larry, our AI sermon assistant. While Larry is trained on
          biblical content and denominational theology, always review for theological accuracy and consult with leadership
          before preaching.
        </AlertDescription>
      </Alert>

      <SermonAdaptation
        open={showAdaptation}
        onClose={() => setShowAdaptation(false)}
        sermon={currentSermon}
        onAdaptedSermon={handleAdaptedSermon}
      />

      <TheologicalExplorer
        open={showTheologyExplorer}
        onClose={() => setShowTheologyExplorer(false)}
        topic={currentSermon.topic}
        passage={currentSermon.anchor_passage}
        denomination={user?.denomination}
      />

      <ExegesisHelper
        open={showExegesisHelper}
        onClose={() => setShowExegesisHelper(false)}
        initialPassage={exegesisPassage}
        denomination={user?.denomination}
      />

      {showPresentation && (
        <PresentationMode
          sermon={currentSermon}
          onClose={() => setShowPresentation(false)}
        />
      )}
    </div>
  );
}
