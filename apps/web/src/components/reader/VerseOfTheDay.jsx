import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Share2, Heart } from "lucide-react";
import { api } from '@/api/apiClient';
import { LARRY_SYSTEM_PROMPT } from '@/ai/personas';
import { toast } from "sonner";
import { motion } from "framer-motion";

// Curated public-domain (KJV) verses. The "verse of the day" is chosen
// DETERMINISTICALLY from this list by the calendar date, so it is identical for
// every user, on every page (Home and Reader), all day — and never an AI
// hallucination. Previously the verse was AI-selected and only kept consistent
// by a fragile per-device cache, so Home and Reader could (and did) disagree.
const CURATED_VERSES = [
  { reference: "John 3:16", text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life." },
  { reference: "Jeremiah 29:11", text: "For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end." },
  { reference: "Philippians 4:13", text: "I can do all things through Christ which strengtheneth me." },
  { reference: "Romans 8:28", text: "And we know that all things work together for good to them that love God, to them who are the called according to his purpose." },
  { reference: "Psalm 23:1", text: "The LORD is my shepherd; I shall not want." },
  { reference: "Proverbs 3:5", text: "Trust in the LORD with all thine heart; and lean not unto thine own understanding." },
  { reference: "Isaiah 40:31", text: "But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint." },
  { reference: "Isaiah 41:10", text: "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness." },
  { reference: "Joshua 1:9", text: "Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest." },
  { reference: "Philippians 4:6", text: "Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God." },
  { reference: "Matthew 11:28", text: "Come unto me, all ye that labour and are heavy laden, and I will give you rest." },
  { reference: "Psalm 46:1", text: "God is our refuge and strength, a very present help in trouble." },
  { reference: "2 Corinthians 5:17", text: "Therefore if any man be in Christ, he is a new creature: old things are passed away; behold, all things are become new." },
  { reference: "Romans 12:2", text: "And be not conformed to this world: but be ye transformed by the renewing of your mind, that ye may prove what is that good, and acceptable, and perfect, will of God." },
  { reference: "Ephesians 2:8", text: "For by grace are ye saved through faith; and that not of yourselves: it is the gift of God." },
  { reference: "Hebrews 11:1", text: "Now faith is the substance of things hoped for, the evidence of things not seen." },
  { reference: "Psalm 119:105", text: "Thy word is a lamp unto my feet, and a light unto my path." },
  { reference: "Matthew 6:33", text: "But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you." },
  { reference: "John 14:6", text: "Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me." },
  { reference: "Romans 5:8", text: "But God commendeth his love toward us, in that, while we were yet sinners, Christ died for us." },
  { reference: "Psalm 27:1", text: "The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?" },
  { reference: "Isaiah 26:3", text: "Thou wilt keep him in perfect peace, whose mind is stayed on thee: because he trusteth in thee." },
  { reference: "Lamentations 3:22", text: "It is of the LORD'S mercies that we are not consumed, because his compassions fail not." },
  { reference: "Deuteronomy 31:6", text: "Be strong and of a good courage, fear not, nor be afraid of them: for the LORD thy God, he it is that doth go with thee; he will not fail thee, nor forsake thee." },
  { reference: "Psalm 37:4", text: "Delight thyself also in the LORD; and he shall give thee the desires of thine heart." },
  { reference: "Proverbs 18:10", text: "The name of the LORD is a strong tower: the righteous runneth into it, and is safe." },
  { reference: "1 Peter 5:7", text: "Casting all your care upon him; for he careth for you." },
  { reference: "James 1:5", text: "If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him." },
  { reference: "Colossians 3:23", text: "And whatsoever ye do, do it heartily, as to the Lord, and not unto men." },
  { reference: "2 Timothy 1:7", text: "For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind." },
  { reference: "Psalm 121:1", text: "I will lift up mine eyes unto the hills, from whence cometh my help." },
  { reference: "John 16:33", text: "These things I have spoken unto you, that in me ye might have peace. In the world ye shall have tribulation: but be of good cheer; I have overcome the world." },
  { reference: "Romans 15:13", text: "Now the God of hope fill you with all joy and peace in believing, that ye may abound in hope, through the power of the Holy Ghost." },
  { reference: "Galatians 6:9", text: "And let us not be weary in well doing: for in due season we shall reap, if we faint not." },
  { reference: "Psalm 118:24", text: "This is the day which the LORD hath made; we will rejoice and be glad in it." },
  { reference: "Nahum 1:7", text: "The LORD is good, a strong hold in the day of trouble; and he knoweth them that trust in him." },
];

// Deterministic verse for a given YYYY-MM-DD: same for everyone, every page.
function verseForDate(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) >>> 0;
  }
  return CURATED_VERSES[hash % CURATED_VERSES.length];
}

export default function VerseOfTheDay({ user }) {
  const [verse, setVerse] = useState(() => verseForDate(new Date().toISOString().split('T')[0]));
  const [devotional, setDevotional] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadVerseOfDay();
  }, []);

  const loadVerseOfDay = async () => {
    setIsLoading(true);

    const today = new Date().toISOString().split('T')[0];
    const todaysVerse = verseForDate(today);
    setVerse(todaysVerse);

    // The verse is fixed; only the AI devotional varies, cached per day so it's
    // generated once. If the devotional can't load, the verse still shows.
    try {
      const cached = localStorage.getItem(`votd-devotional-${today}`);
      if (cached) {
        setDevotional(JSON.parse(cached));
        return;
      }

      const prompt = `Write a short devotional for today (${today}) based on this exact verse:

"${todaysVerse.text}" — ${todaysVerse.reference}

Provide:
1. Why this verse encourages us today (1-2 sentences)
2. A devotional reflection (2-3 short paragraphs)
3. A practical application (one specific action for today)
4. A one-sentence prayer starter

Do NOT change the verse or its reference. Be warm, personal, and actionable.`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        feature: 'reader_insight',
        response_json_schema: {
          type: "object",
          properties: {
            why_today: { type: "string" },
            reflection: { type: "string" },
            application: { type: "string" },
            prayer_starter: { type: "string" }
          }
        }
      });

      const dev = {
        why_today: response.why_today,
        reflection: response.reflection,
        application: response.application,
        prayer_starter: response.prayer_starter,
      };
      localStorage.setItem(`votd-devotional-${today}`, JSON.stringify(dev));
      setDevotional(dev);
    } catch (error) {
      console.error('Error loading devotional:', error);
      // Non-fatal — the verse itself still renders.
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = () => {
    const reflection = devotional?.reflection ? `\n\n${devotional.reflection.substring(0, 200)}...` : '';
    const text = `📖 Verse of the Day\n\n${verse.text}\n- ${verse.reference}${reflection}\n\nvia SermonSmith`;
    
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

  if (!verse) return null;

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

          {/* Devotional (AI-generated for the day's verse). The verse above is
              always shown; these sections appear once the devotional loads. */}
          {isLoading && !devotional && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Preparing today's devotional…
            </div>
          )}

          {devotional && (
            <>
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
            </>
          )}

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
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}