import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Share2, Copy, RefreshCw, Heart } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function VerseOfTheDay({ user }) {
  const [verse, setVerse] = useState(null);
  const [devotional, setDevotional] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadVerseOfDay();
  }, []);

  const loadVerseOfDay = async () => {
    setIsLoading(true);
    
    // Get today's date as seed for consistency
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const cached = localStorage.getItem(`votd-${today}`);
      
      if (cached) {
        const data = JSON.parse(cached);
        setVerse(data.verse);
        setDevotional(data.devotional);
        setIsLoading(false);
        return;
      }

      // Generate AI-selected verse with devotional
      const prompt = `Select an inspiring, encouraging Bible verse for today (${today}) and create a brief devotional.

Choose a verse that:
- Offers hope and encouragement
- Is practical for daily life
- Different from yesterday
- Accessible to all believers
- Memorable and shareable

Create:
1. Selected verse with reference
2. Why this verse today (1-2 sentences)
3. Devotional reflection (2-3 paragraphs)
4. Practical application (specific action for today)
5. Prayer starter (one sentence)

Make it warm, personal, and actionable.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            reference: { type: "string" },
            text: { type: "string" },
            why_today: { type: "string" },
            reflection: { type: "string" },
            application: { type: "string" },
            prayer_starter: { type: "string" }
          }
        }
      });

      // Cache for today
      localStorage.setItem(`votd-${today}`, JSON.stringify({
        verse: {
          reference: response.reference,
          text: response.text
        },
        devotional: {
          why_today: response.why_today,
          reflection: response.reflection,
          application: response.application,
          prayer_starter: response.prayer_starter
        }
      }));

      setVerse({
        reference: response.reference,
        text: response.text
      });
      setDevotional({
        why_today: response.why_today,
        reflection: response.reflection,
        application: response.application,
        prayer_starter: response.prayer_starter
      });
    } catch (error) {
      console.error('Error loading verse of day:', error);
      toast.error("Failed to load verse of the day");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    const today = new Date().toISOString().split('T')[0];
    localStorage.removeItem(`votd-${today}`);
    setIsRefreshing(true);
    loadVerseOfDay();
  };

  const handleShare = () => {
    const text = `📖 Verse of the Day\n\n${verse.text}\n- ${verse.reference}\n\n${devotional.reflection.substring(0, 200)}...\n\nvia SermonSmith`;
    
    if (navigator.share) {
      navigator.share({ text }).catch(() => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard!");
      });
    } else {
      navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard!");
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
        <CardContent className="pt-6 text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">Loading today's verse...</p>
        </CardContent>
      </Card>
    );
  }

  if (!verse || !devotional) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <Card className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-900/20 dark:via-purple-900/20 dark:to-pink-900/20 border-2 border-indigo-200 dark:border-indigo-800 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-600" />
              Verse of the Day
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* The Verse */}
          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur p-6 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <p className="text-xl md:text-2xl font-serif italic text-gray-800 dark:text-gray-200 leading-relaxed mb-3">
              {verse.text}
            </p>
            <p className="text-right text-indigo-600 dark:text-indigo-400 font-semibold">
              - {verse.reference}
            </p>
          </div>

          {/* Why Today */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
              <Heart className="w-4 h-4" />
              Why This Verse Today
            </h4>
            <p className="text-blue-800 dark:text-blue-200 text-sm">
              {devotional.why_today}
            </p>
          </div>

          {/* Reflection */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Reflection
            </h4>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
              {devotional.reflection}
            </p>
          </div>

          {/* Application */}
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-l-4 border-green-500">
            <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
              ✨ Today's Application
            </h4>
            <p className="text-green-800 dark:text-green-200">
              {devotional.application}
            </p>
          </div>

          {/* Prayer */}
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
            <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
              🙏 Prayer Starter
            </h4>
            <p className="text-purple-800 dark:text-purple-200 italic">
              {devotional.prayer_starter}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="flex-1"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex-1"
            >
              {isRefreshing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              New Verse
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}