import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Languages, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from '@/api/apiClient';
import { LARRY_SYSTEM_PROMPT } from '@/ai/personas';

const languages = [
  // Current languages
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "zh", name: "Chinese (Mandarin)" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ar", name: "Arabic" },
  { code: "he", name: "Hebrew" },
  { code: "hi", name: "Hindi" },
  { code: "sw", name: "Swahili" },
  { code: "am", name: "Amharic" },
  { code: "yo", name: "Yoruba" },
  { code: "ig", name: "Igbo" },
  { code: "ha", name: "Hausa" },
  
  // New major world languages
  { code: "bn", name: "Bengali" },
  { code: "ur", name: "Urdu" },
  { code: "id", name: "Indonesian" },
  { code: "mr", name: "Marathi" },
  { code: "te", name: "Telugu" },
  { code: "tr", name: "Turkish" },
  { code: "ta", name: "Tamil" },
  { code: "yue", name: "Cantonese" },
  { code: "vi", name: "Vietnamese" },
  { code: "th", name: "Thai" },
  { code: "gu", name: "Gujarati" },
  { code: "jv", name: "Javanese" },
  { code: "pl", name: "Polish" },
  { code: "uk", name: "Ukrainian" },
  { code: "fa", name: "Persian (Farsi)" },
  { code: "ml", name: "Malayalam" },
  { code: "kn", name: "Kannada" },
  { code: "or", name: "Odia (Oriya)" },
  { code: "my", name: "Burmese" },
  { code: "pa", name: "Punjabi" },
  { code: "su", name: "Sundanese" },
  { code: "ro", name: "Romanian" },
  { code: "nl", name: "Dutch" },
  { code: "tl", name: "Tagalog (Filipino)" },
  { code: "om", name: "Oromo" },
  { code: "az", name: "Azerbaijani" },
  { code: "uz", name: "Uzbek" },
  { code: "mg", name: "Malagasy" },
  { code: "ne", name: "Nepali" },
  { code: "ceb", name: "Cebuano" },
  { code: "si", name: "Sinhala" },
  { code: "km", name: "Khmer (Cambodian)" }
];

export default function TranslationPanel({ open, onClose, verse }) {
  const [targetLanguage, setTargetLanguage] = useState("es");
  const [translatedText, setTranslatedText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslate = async () => {
    setIsTranslating(true);
    setTranslatedText("");
    
    try {
      const targetLangName = languages.find(l => l.code === targetLanguage)?.name || "the selected language";
      
      const prompt = `Translate this Bible verse into ${targetLangName}. Maintain the theological accuracy and reverent tone. Only provide the translation, no explanation or additional commentary.

Original verse (${verse.book_name} ${verse.chapter}:${verse.verse}):
"${verse.text}"

Provide only the translated verse text in ${targetLangName}:`;

      const result = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt: prompt,
        feature: 'reader_insight'
      });
      
      const text = typeof result === 'string' ? result : (result?.response || result?.text || JSON.stringify(result));
      // The model often wraps its answer in quotes; the UI adds its own pair,
      // so strip any leading/trailing quote characters to avoid ""double"" quoting.
      const unquoted = text.trim().replace(/^["'«„“”]+/, '').replace(/["'»“”]+$/, '');
      setTranslatedText(unquoted);
      toast.success("Translation complete!");
      
    } catch (error) {
      console.error("Translation error:", error);
      toast.error("Failed to translate verse. Please try again.");
    } finally {
      setIsTranslating(false);
    }
  };

  if (!verse) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            <Languages className="w-5 h-5 text-purple-500" />
            Verse Translation
            <Badge variant="secondary" className="ml-2">Premium</Badge>
          </DialogTitle>
          <DialogDescription>
            Translate {verse.book_name} {verse.chapter}:{verse.verse} into another language.
          </DialogDescription>
        </DialogHeader>
      <div className="space-y-4">
        <div className="p-3 bg-blue-50 dark:bg-blue-900 rounded-lg">
          <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">
            {verse.book_name} {verse.chapter}:{verse.verse} (English)
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            "{verse.text}"
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Translate to ({languages.length} languages available):</label>
          <Select value={targetLanguage} onValueChange={setTargetLanguage}>
            <SelectTrigger>
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {languages.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={handleTranslate} 
          disabled={isTranslating}
          className="w-full bg-purple-600 hover:bg-purple-700"
        >
          {isTranslating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Translating...
            </>
          ) : (
            <>
              <Languages className="w-4 h-4 mr-2" />
              Translate Verse
            </>
          )}
        </Button>

        {translatedText && (
          <div className="p-3 bg-green-50 dark:bg-green-900 rounded-lg border-l-4 border-green-500">
            <div className="text-xs text-green-600 dark:text-green-400 mb-1">
              {verse.book_name} {verse.chapter}:{verse.verse} ({languages.find(l => l.code === targetLanguage)?.name})
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              "{translatedText}"
            </p>
          </div>
        )}
      </div>
      </DialogContent>
    </Dialog>
  );
}