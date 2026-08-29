import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, BookOpen } from "lucide-react";

/**
 * Read-only live view of a Bible study as it streams in. Renders only the
 * fields produced so far; the page swaps to the full StudyGuideViewer once
 * generation completes.
 */
export default function StreamingStudyPreview({ study }) {
  const keyVerses = Array.isArray(study && study.key_verses) ? study.key_verses : [];
  const sections = Array.isArray(study && study.study_sections) ? study.study_sections : [];

  return (
    <div className="space-y-6">
      <Card className="border-l-4 border-emerald-500 bg-gradient-to-br from-emerald-50/60 to-teal-50/60 dark:from-emerald-900/20 dark:to-teal-900/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
            <Loader2 className="w-4 h-4 animate-spin" />
            <Sparkles className="w-4 h-4" />
            Larry is writing your study…
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {study?.title || <span className="text-gray-400">Crafting a title…</span>}
            <span className="inline-block w-2 h-5 ml-1 align-middle bg-emerald-500 animate-pulse" />
          </CardTitle>
          {study?.overview && (
            <p className="text-gray-700 dark:text-gray-300 mt-2">{study.overview}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {keyVerses.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2">📖 Key Verses</h4>
              <div className="flex flex-wrap gap-2">
                {keyVerses.map((v, i) => (
                  <Badge key={i} variant="outline"><BookOpen className="w-3 h-3 mr-1" />{v}</Badge>
                ))}
              </div>
            </div>
          )}

          {sections.map((section, i) => (
            <div key={i} className="border-l-2 border-emerald-300 pl-4 space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Badge className="bg-emerald-600">Section {i + 1}</Badge>
                {section.title}
              </h3>
              {section.scripture && (
                <Badge variant="outline" className="text-xs">{section.scripture}</Badge>
              )}
              {section.insights && (
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{section.insights}</p>
              )}
              {Array.isArray(section.questions) && section.questions.length > 0 && (
                <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 list-decimal list-inside">
                  {section.questions.map((q, qi) => <li key={qi}>{q}</li>)}
                </ul>
              )}
              {section.application && (
                <p className="text-sm text-emerald-800 dark:text-emerald-200"><strong>Apply:</strong> {section.application}</p>
              )}
            </div>
          ))}

          {study?.conclusion && (
            <div>
              <h4 className="font-semibold mb-1">Conclusion</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{study.conclusion}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
