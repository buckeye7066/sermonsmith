import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BookOpen, Save, AlertCircle, FileText, Crown, MessageCircle, Sparkles, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router";
import { createPageUrl } from "@/utils";
import PrintButton from "@/components/common/PrintButton";

export default function StudyGuideViewer({ studyData, onSave, user, onEnhanceQuestions, isEnhancing, enhancementType, viewOnly = false }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(studyData?.title || "");
  const [isExporting, setIsExporting] = useState(false);

  const isPremium = user && (
    user.subscription_tier === 'premium' ||
    user.premium_override === true ||
    (user.premium_until && new Date(user.premium_until) > new Date()) ||
    (['buckeye7066@gmail.com', 'anyawhite@rocketmail.com', 'whiterobert1201@icloud.com', 'tishka1201@icloud.com'].includes(user.promotionalEmail?.toLowerCase())
      && user.promotionalEmail?.toLowerCase() === user.email?.toLowerCase()) ||
    ['9319981779', '+19319981779', '931-998-1779', '(931) 998-1779'].some(p => user.promotionalPhone?.replace(/[\s\-()]/g, '').includes(p.replace(/[\s\-()+]/g, '')))
  );

  const handleExport = async () => {
    if (!isPremium) {
      toast.error("Export is a Premium feature", {
        description: "Upgrade to export your studies to PDF"
      });
      return;
    }

    setIsExporting(true);
    try {
      const { exportStudyToPdf } = await import('@/lib/studyPdf');
      const filename = await exportStudyToPdf({
        ...studyData,
        title: editedTitle || studyData.title || 'Bible Study',
      });
      if (filename) toast.success('Study exported to PDF', { description: filename });
      else toast.info('PDF export canceled');
    } catch (error) {
      console.error('Error exporting study to PDF:', error);
      toast.error('Failed to export to PDF', {
        description: error.message
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (!studyData) {
    return (
      <Alert>
        <AlertCircle className="w-4 h-4" />
        <AlertDescription>No study data available</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6" data-print-section>
      {/* Title Card */}
      <Card className="border-l-4 border-indigo-500" data-print-break-inside-avoid>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {isEditing && !viewOnly ? (
                <Input
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onBlur={() => {
                    setIsEditing(false);
                    studyData.title = editedTitle;
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      setIsEditing(false);
                      studyData.title = editedTitle;
                    }
                  }}
                  autoFocus
                  className="text-2xl font-bold"
                />
              ) : (
                <CardTitle
                  className={viewOnly ? "text-2xl" : "text-2xl cursor-pointer hover:text-indigo-600 transition-colors"}
                  onClick={() => !viewOnly && setIsEditing(true)}
                >
                  {studyData.title}
                </CardTitle>
              )}
              <div className="flex gap-2 mt-2">
                <Badge>{studyData.topic}</Badge>
                <Badge variant="outline">
                  <BookOpen className="w-3 h-3 mr-1" />
                  {studyData.study_sections?.length || 0} sections
                </Badge>
              </div>
            </div>
            <PrintButton label="Print Study" className="shrink-0" />
          </div>
        </CardHeader>
      </Card>

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {studyData.overview}
          </p>
        </CardContent>
      </Card>

      {/* Key Verses */}
      {studyData.key_verses && studyData.key_verses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-green-500" />
              Key Verses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {studyData.key_verses.map((verse, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Badge variant="outline" className="mt-1">{index + 1}</Badge>
                  <p className="flex-1 text-gray-700 dark:text-gray-300">{verse}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Study Sections */}
      {studyData.study_sections && studyData.study_sections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Study Sections</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="space-y-2">
              {studyData.study_sections.map((section, index) => (
                <AccordionItem key={index} value={`section-${index}`} className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <Badge>{index + 1}</Badge>
                      <span className="font-semibold">{section.title}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    {/* Scripture */}
                    {section.scripture && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border-l-4 border-blue-500">
                        <p className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                          📖 Scripture
                        </p>
                        <p className="text-gray-700 dark:text-gray-300 italic">
                          {section.scripture}
                        </p>
                      </div>
                    )}

                    {/* Insights */}
                    {section.insights && (
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                          💡 Insights
                        </p>
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {section.insights}
                        </p>
                      </div>
                    )}

                    {/* Discussion Questions */}
                    {section.questions && section.questions.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <MessageCircle className="w-4 h-4" />
                            Discussion Questions
                          </p>
                          {onEnhanceQuestions && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEnhanceQuestions(index)}
                              disabled={isEnhancing}
                              className="text-blue-600 hover:text-blue-700"
                              data-print-hidden
                            >
                              {isEnhancing && enhancementType === `questions-${index}` ? (
                                <>
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  Larry is adding...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3 h-3 mr-1" />
                                  Add More with Larry
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {section.questions.map((question, qIndex) => (
                            <div key={qIndex} className="flex items-start gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                              <span className="text-indigo-600 font-semibold mt-1 flex-shrink-0">
                                Q{qIndex + 1}:
                              </span>
                              <p className="text-gray-700 dark:text-gray-300">{question}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Application */}
                    {section.application && (
                      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-l-4 border-green-500">
                        <p className="font-semibold text-green-900 dark:text-green-100 mb-2">
                          ✨ Application
                        </p>
                        <p className="text-gray-700 dark:text-gray-300">
                          {section.application}
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
      {studyData.conclusion && (
        <Card className="border-l-4 border-green-500">
          <CardHeader>
            <CardTitle>Conclusion</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {studyData.conclusion}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3" data-print-hidden>
        {typeof onSave === 'function' && !viewOnly && (
          <Button onClick={onSave} className="flex-1" size="lg">
            <Save className="w-4 h-4 mr-2" />
            Save Study
          </Button>
        )}
        {isPremium ? (
          <Button
            variant="outline"
            disabled={isExporting}
            className="flex-1"
            size="lg"
            onClick={handleExport}
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {isExporting ? 'Exporting PDF...' : 'Export PDF'}
          </Button>
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
        <Alert className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-purple-200" data-print-hidden>
          <Crown className="w-4 h-4 text-purple-600" />
          <AlertDescription className="flex items-center justify-between">
            <span>Upgrade to Premium to export studies and access all features</span>
            <Link to={createPageUrl("Pricing")}>
              <Button size="sm" className="ml-4 bg-purple-600 hover:bg-purple-700">
                Upgrade
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Theological Disclaimer */}
      <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200" data-print-hidden>
        <AlertCircle className="w-4 h-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <strong>Note:</strong> This study was generated by Larry, our AI assistant. While Larry is trained on biblical content and 
          denominational doctrine, always verify teachings with official church guidance and consult with spiritual leadership.
        </AlertDescription>
      </Alert>
    </div>
  );
}
