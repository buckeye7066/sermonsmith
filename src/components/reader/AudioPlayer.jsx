import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Volume2, VolumeX, Loader2, Crown, Settings } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function AudioPlayer({ verses, book, chapter, isPremium, isOnline }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentVerseIndex, setCurrentVerseIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState([80]);
  const [showSettings, setShowSettings] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [speechRate, setSpeechRate] = useState([0.9]);
  const [speechPitch, setSpeechPitch] = useState([1.0]);
  const [pauseBetweenVerses, setPauseBetweenVerses] = useState([800]);
  const audioRef = useRef(null);
  const utteranceRef = useRef(null);

  useEffect(() => {
    // Load available voices
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      
      // Filter and sort voices - prioritize high-quality ones
      const sortedVoices = voices
        .filter(voice => voice.lang.startsWith('en')) // English voices only
        .sort((a, b) => {
          // Prioritize: Google > Microsoft > Apple > Others
          const getPriority = (name) => {
            if (name.includes('Google')) return 4;
            if (name.includes('Microsoft')) return 3;
            if (name.includes('Apple')) return 2;
            return 1;
          };
          return getPriority(b.name) - getPriority(a.name);
        });
      
      setAvailableVoices(sortedVoices);
      
      // Auto-select the best voice if not already selected
      if (!selectedVoice && sortedVoices.length > 0) {
        // Try to find the best natural-sounding voice
        const preferredVoice = sortedVoices.find(v => 
          v.name.includes('Google') || 
          v.name.includes('Natural') ||
          v.name.includes('Enhanced')
        ) || sortedVoices[0];
        
        setSelectedVoice(preferredVoice);
      }
    };

    loadVoices();
    
    // Voices may load asynchronously
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      if (utteranceRef.current) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Load saved settings
  useEffect(() => {
    const savedSettings = localStorage.getItem('audioPlayerSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (settings.speechRate) setSpeechRate([settings.speechRate]);
        if (settings.speechPitch) setSpeechPitch([settings.speechPitch]);
        if (settings.pauseBetweenVerses) setPauseBetweenVerses([settings.pauseBetweenVerses]);
        if (settings.volume) setVolume([settings.volume]);
        if (settings.voiceName && availableVoices.length > 0) {
          const voice = availableVoices.find(v => v.name === settings.voiceName);
          if (voice) setSelectedVoice(voice);
        }
      } catch (error) {
        console.error('Error loading audio settings:', error);
      }
    }
  }, [availableVoices]);

  // Save settings when they change
  useEffect(() => {
    if (selectedVoice) {
      const settings = {
        speechRate: speechRate[0],
        speechPitch: speechPitch[0],
        pauseBetweenVerses: pauseBetweenVerses[0],
        volume: volume[0],
        voiceName: selectedVoice.name
      };
      localStorage.setItem('audioPlayerSettings', JSON.stringify(settings));
    }
  }, [speechRate, speechPitch, pauseBetweenVerses, volume, selectedVoice]);

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
      
      // Apply selected voice
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      
      // Apply custom settings
      utterance.rate = speechRate[0];
      utterance.pitch = speechPitch[0];
      utterance.volume = volume[0] / 100;

      utterance.onend = () => {
        if (isPlaying && verseIndex < verses.length - 1) {
          // Natural pause between verses
          setTimeout(() => {
            setCurrentVerseIndex(verseIndex + 1);
            speakVerse(verseIndex + 1);
          }, pauseBetweenVerses[0]);
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

  const handleVoiceChange = (voiceName) => {
    const voice = availableVoices.find(v => v.name === voiceName);
    if (voice) {
      setSelectedVoice(voice);
      
      // If currently playing, restart with new voice
      if (isPlaying) {
        window.speechSynthesis.cancel();
        setTimeout(() => speakVerse(currentVerseIndex), 100);
      }
    }
  };

  const progress = verses.length > 0 ? ((currentVerseIndex + 1) / verses.length) * 100 : 0;

  return (
    <>
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
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSettings(true)}
                  className="h-8 w-8"
                >
                  <Settings className="w-4 h-4" />
                </Button>
                {!isPremium && (
                  <Badge className="bg-purple-600">
                    <Crown className="w-3 h-3 mr-1" />
                    Premium
                  </Badge>
                )}
              </div>
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

            {selectedVoice && (
              <div className="text-xs text-center text-purple-700 dark:text-purple-300">
                🎙️ Voice: {selectedVoice.name.split(' ')[0]} • Rate: {speechRate[0].toFixed(1)}x
              </div>
            )}

            {!isPremium && (
              <p className="text-xs text-center text-purple-700 dark:text-purple-300">
                ✨ Upgrade to Premium to listen to Bible chapters with natural text-to-speech
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Audio Settings</DialogTitle>
            <DialogDescription>
              Customize the voice, speed, and reading style
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Voice</Label>
              <Select
                value={selectedVoice?.name}
                onValueChange={handleVoiceChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a voice" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {availableVoices.map((voice) => (
                    <SelectItem key={voice.name} value={voice.name}>
                      {voice.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {availableVoices.length === 0 ? (
                  'Loading voices...'
                ) : (
                  `${availableVoices.length} voices available. Google and Microsoft voices sound most natural.`
                )}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Speech Rate</Label>
                <span className="text-sm text-gray-500">{speechRate[0].toFixed(1)}x</span>
              </div>
              <Slider
                value={speechRate}
                onValueChange={setSpeechRate}
                min={0.5}
                max={2.0}
                step={0.1}
              />
              <p className="text-xs text-gray-500">
                0.8x-1.0x recommended for natural listening
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Voice Pitch</Label>
                <span className="text-sm text-gray-500">{speechPitch[0].toFixed(1)}</span>
              </div>
              <Slider
                value={speechPitch}
                onValueChange={setSpeechPitch}
                min={0.5}
                max={2.0}
                step={0.1}
              />
              <p className="text-xs text-gray-500">
                Adjust voice tone (1.0 is default)
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Pause Between Verses</Label>
                <span className="text-sm text-gray-500">{pauseBetweenVerses[0]}ms</span>
              </div>
              <Slider
                value={pauseBetweenVerses}
                onValueChange={setPauseBetweenVerses}
                min={200}
                max={2000}
                step={100}
              />
              <p className="text-xs text-gray-500">
                Natural breathing room between verses
              </p>
            </div>

            <div className="pt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSpeechRate([0.9]);
                  setSpeechPitch([1.0]);
                  setPauseBetweenVerses([800]);
                }}
              >
                Reset Defaults
              </Button>
              <Button onClick={() => setShowSettings(false)}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}