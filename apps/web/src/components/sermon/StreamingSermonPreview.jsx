import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, BookOpen } from "lucide-react";

/**
 * Read-only live view of a sermon as it streams in. Renders only the fields
 * produced so far (a blinking caret marks where Larry is "writing"), then the
 * page swaps to the full editable SermonEditor once generation completes.
 */
export default function StreamingSermonPreview({ sermon }) {
  const points = Array.isArray(sermon) && Array.isArray(sermon.points) ? sermon.points : [];

  return (
    <div className="space-y-6">
      <Card className="border-l-4 border-indigo-500 bg-gradient-to-br from-indigo-50/60 to-purple-50/60 dark:from-indigo-900/20 dark:to-purple-900/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 text-sm font-medium">
            <Loader2 className="w-4 h-4 animate-spin" />
            <Sparkles className="w-4 h-4" />
            Larry is writing your sermon…
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {sermon?.title || <span className="text-gray-400">Crafting a title…</span>}
            <span className="inline-block w-2 h-5 ml-1 align-middle bg-indigo-500 animate-pulse" />
          </CardTitle>
          {sermon?.big_idea && (
            <p className="text-indigo-700 dark:text-indigo-300 font-medium mt-2">{sermon.big_idea}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {sermon?.theological_notes && (
            <div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded p-3 whitespace-pre-line">
              {sermon.theological_notes}
            </div>
          )}

          {points.map((point, i) => (
            <div key={i} className="border-l-2 border-indigo-300 pl-4 space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Badge className="bg-indigo-600">Point {i + 1}</Badge>
                {point.title}
              </h3>
              {point.exegesis && (
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{point.exegesis}</p>
              )}
              {point.illustration && (
                <p className="text-sm italic text-gray-600 dark:text-gray-400">💡 {point.illustration}</p>
              )}
              {point.application && (
                <p className="text-sm text-blue-800 dark:text-blue-200"><strong>Apply:</strong> {point.application}</p>
              )}
              {Array.isArray(point.supporting_scriptures) && point.supporting_scriptures.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {point.supporting_scriptures.map((ref, r) => (
                    <Badge key={r} variant="outline" className="text-xs"><BookOpen className="w-3 h-3 mr-1" />{ref}</Badge>
                  ))}
                </div>
              )}
            </div>
          ))}

          {sermon?.conclusion && (
            <div>
              <h4 className="font-semibold mb-1">Conclusion</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{sermon.conclusion}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
