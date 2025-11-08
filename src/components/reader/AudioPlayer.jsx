import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Volume2, VolumeX, Loader2, Crown } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function AudioPlayer({ verses, book, chapter, isPremium, isOnline }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentVerseIndex, setCurrentVerseIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState([80]);
  const audioRef = useRef(null);
  const utteranceRef = useRef(null);

  useEffect(() => {
    return () => {
      if (utteranceRef.current) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speakVerse = (verseIndex) => {
    if (verseIndex >= verses.length) {
      setIsPlaying(false);
      setCurrentVerseIndex(0);
      return;
    }

    const verse = verses[verseIndex];
    const text = `${verse.verse}. ${verse.text}`;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = volume[0] / 100;

      utterance.onend = () => {
        if (isPlaying && verseIndex < verses.length - 1) {
          setTimeout(() => {
            setCurrentVerseIndex(verseIndex + 1);
            speakVerse(verseIndex + 1);
          }, 500);
        } else {
          setIsPlaying(false);
          setCurrentVerseIndex(0);
        }
      };

      utterance.onerror = (event) => {
        console.error('Speech error:', event);
        setIsPlaying(false);
        toast.error("Audio playback failed");
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } else {
      toast.error("Audio playback not supported in this browser");
      setIsPlaying(false);
    }
  };

  const handlePlayPause = () => {
    if (!isPremium) {
      toast.error("Audio playback is a Premium feature", {
        description: "Upgrade to listen to Bible chapters"
      });
      return;
    }

    if (!isOnline) {
      toast.error("Audio requires an internet connection");
      return;
    }

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      speakVerse(currentVerseIndex);
    }
  };

  const handleVolumeChange = (value) => {
    setVolume(value);
    if (utteranceRef.current && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      if (isPlaying) {
        speakVerse(currentVerseIndex);
      }
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (!isMuted) {
      setVolume([0]);
    } else {
      setVolume([80]);
    }
  };

  const progress = verses.length > 0 ? ((currentVerseIndex + 1) / verses.length) * 100 : 0;

  return (
    <Card className="mb-6 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-purple-200 dark:border-purple-800">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                size="icon"
                onClick={handlePlayPause}
                disabled={isGenerating || verses.length === 0}
                className="h-12 w-12 rounded-full bg-purple-600 hover:bg-purple-700"
              >
                {isGenerating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-1" />
                )}
              </Button>
              <div>
                <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                  {book} {chapter}
                </h3>
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  {isPlaying ? `Verse ${currentVerseIndex + 1} of ${verses.length}` : 'Audio Playback'}
                </p>
              </div>
            </div>
            {!isPremium && (
              <Badge className="bg-purple-600">
                <Crown className="w-3 h-3 mr-1" />
                Premium
              </Badge>
            )}
          </div>

          {isPlaying && (
            <div className="space-y-2">
              <div className="h-2 bg-purple-200 dark:bg-purple-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-600 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-center text-purple-600 dark:text-purple-400">
                {Math.round(progress)}% complete
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="h-8 w-8"
            >
              {isMuted || volume[0] === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </Button>
            <Slider
              value={volume}
              onValueChange={handleVolumeChange}
              max={100}
              step={5}
              className="flex-1"
              disabled={!isPremium}
            />
            <span className="text-sm text-gray-600 w-10">{volume[0]}%</span>
          </div>

          {!isPremium && (
            <p className="text-xs text-center text-purple-700 dark:text-purple-300">
              ✨ Upgrade to Premium to listen to Bible chapters with natural text-to-speech
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}