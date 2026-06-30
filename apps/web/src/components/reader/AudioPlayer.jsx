import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Play, Pause, Volume2, VolumeX, Loader2, Crown, Settings, Globe, AlertTriangle, Info, ExternalLink } from "lucide-react";
import { toast } from "sonner";

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

// Language codes mapping
const LANGUAGE_MAP = {
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'ar': 'Arabic',
  'he': 'Hebrew',
  'zh': 'Chinese',
  'ja': 'Japanese',
  'ko': 'Korean',
  'hi': 'Hindi',
  'sv': 'Swedish',
  'no': 'Norwegian',
  'da': 'Danish',
  'nl': 'Dutch',
  'pl': 'Polish',
  'cs': 'Czech',
  'el': 'Greek'
};

// Translation language mapping
const TRANSLATION_LANGUAGES = {
  'KJV': 'en', 'ESV': 'en', 'NIV': 'en', 'NKJV': 'en', 'NLT': 'en', 'NASB': 'en',
  'RVR1960': 'es', 'RVR1995': 'es', 'NVI': 'es', 'BTX': 'es',
  'LSG': 'fr', 'S21': 'fr',
  'LUTH1545': 'de', 'ELB': 'de',
  'NR2006': 'it',
  'ARC': 'pt', 'NVI-PT': 'pt',
  'RUSV': 'ru', 'CARS': 'ru',
  'SVL': 'ar',
  'WLC': 'he', 'OHB': 'he',
  'CUV': 'zh', 'CNVS': 'zh'
};

// Detect user's OS
const getOS = () => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  if (userAgent.includes('win')) return 'Windows';
  if (userAgent.includes('mac')) return 'macOS';
  if (userAgent.includes('iphone') || userAgent.includes('ipad')) return 'iOS';
  if (userAgent.includes('android')) return 'Android';
  if (userAgent.includes('linux')) return 'Linux';
  return 'Unknown';
};

// Get installation instructions based on OS
const getInstallInstructions = (os, language) => {
  const instructions = {
    'Windows': `Settings → Time & Language → Language → Add a language → Search for "${language}" → Install`,
    'macOS': `System Preferences → Accessibility → Spoken Content → System Voice → Manage Voices → Download "${language}" voices`,
    'iOS': `Settings → Accessibility → Spoken Content → Voices → Select Language → Download`,
    'Android': `Settings → System → Languages & input → Text-to-speech → Language → Download "${language}"`,
    'Linux': `Install espeak or festival: sudo apt-get install espeak`
  };
  return instructions[os] || 'Check your system settings to install additional language packs';
};

export default function AudioPlayer({ verses, book, chapter, isPremium, isOnline, currentTranslation }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentVerseIndex, setCurrentVerseIndex] = useState(0);
  const [isGenerating] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState([80]);
  const [showSettings, setShowSettings] = useState(false);
  const [, setAllVoices] = useState([]);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [speechRate, setSpeechRate] = useState([0.9]);
  const [speechPitch, setSpeechPitch] = useState([1.0]);
  const [pauseBetweenVerses, setPauseBetweenVerses] = useState([800]);
  const [translationLanguage, setTranslationLanguage] = useState('en');
  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [showLanguageHelp, setShowLanguageHelp] = useState(false);
  const [userOS, setUserOS] = useState('');
  
  const utteranceRef = useRef(null);

  useEffect(() => {
    // Detect OS
    setUserOS(getOS());

    // Load available voices
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAllVoices(voices);
      
      // Get unique languages available
      const uniqueLangs = [...new Set(voices.map(v => v.lang.split('-')[0]))];
      setAvailableLanguages(uniqueLangs);
      
      // Determine translation language
      const transLang = TRANSLATION_LANGUAGES[currentTranslation] || 'en';
      setTranslationLanguage(transLang);
      
      // Filter voices for current translation language
      const filteredVoices = voices
        .filter(voice => voice.lang.startsWith(transLang))
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
      
      setAvailableVoices(filteredVoices);
      
      // Auto-select the best voice if not already selected or if translation changed
      if (!selectedVoice || !selectedVoice.lang.startsWith(transLang)) {
        if (filteredVoices.length > 0) {
          // Try to find the best natural-sounding voice
          const preferredVoice = filteredVoices.find(v => 
            v.name.includes('Google') || 
            v.name.includes('Natural') ||
            v.name.includes('Enhanced')
          ) || filteredVoices[0];
          
          setSelectedVoice(preferredVoice);
        } else {
          setSelectedVoice(null);
          // Do NOT auto-open the voice-install help on load — it was intrusive
          // (fired unprompted) and disclosed the user's OS. The help is still
          // reachable on intent: when the user presses Play with no voice
          // (handlePlayPause) and via the inline "install voice" button below.
        }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy effect intentionally keeps existing trigger behavior.
  }, [currentTranslation, isPremium]);

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
      } catch (error) {
        console.error('Error loading audio settings:', error);
      }
    }
  }, []);

  // Save settings when they change
  useEffect(() => {
    if (selectedVoice) {
      const settings = {
        speechRate: speechRate[0],
        speechPitch: speechPitch[0],
        pauseBetweenVerses: pauseBetweenVerses[0],
        volume: volume[0],
        voiceName: selectedVoice.name,
        voiceLang: selectedVoice.lang
      };
      localStorage.setItem('audioPlayerSettings', JSON.stringify(settings));
    }
  }, [speechRate, speechPitch, pauseBetweenVerses, volume, selectedVoice]);

  const speakVerse = (verseIndex) => {
    if (verseIndex >= verses.length || !isPlaying) {
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
        utterance.lang = selectedVoice.lang;
      }
      
      // Apply custom settings
      utterance.rate = speechRate[0];
      utterance.pitch = speechPitch[0];
      utterance.volume = volume[0] / 100;

      utterance.onend = () => {
        // Auto-advance to next verse if still playing
        if (verseIndex < verses.length - 1) {
          setTimeout(() => {
            setCurrentVerseIndex(verseIndex + 1);
            speakVerse(verseIndex + 1);
          }, pauseBetweenVerses[0]);
        } else {
          // Reached the end of the chapter
          setIsPlaying(false);
          setCurrentVerseIndex(0);
          toast.success("Finished reading chapter");
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

    if (!selectedVoice) {
      toast.error("No voice available for this language", {
        description: "Click 'Install Voice' for instructions"
      });
      setShowLanguageHelp(true);
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
      
      toast.success(`Voice changed to ${voice.name.split(' ')[0]}`);
    }
  };

  const getVoiceLabel = (voice) => {
    // Extract accent/region from voice name
    const nameParts = voice.name.split(/[()]/);
    const mainName = nameParts[0].trim();
    const region = nameParts[1] || '';
    
    return `${mainName} ${region ? `(${region})` : ''}`;
  };

  const getInstallLink = () => {
    const links = {
      'Windows': 'ms-settings:regionlanguage',
      'macOS': 'x-apple.systempreferences:com.apple.preference.universalaccess',
      'iOS': 'App-Prefs:',
      'Android': 'settings://settings/language'
    };
    return links[userOS];
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
                  disabled={isGenerating || verses.length === 0 || (!selectedVoice && isPremium)}
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
                  title="Audio Settings"
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
              <div className="flex items-center justify-center gap-2 text-xs text-purple-700 dark:text-purple-300">
                <Globe className="w-3 h-3" />
                <span>
                  {LANGUAGE_MAP[translationLanguage] || 'Language'}: {selectedVoice.name.split(' ')[0]} • Rate: {speechRate[0].toFixed(1)}x
                </span>
              </div>
            )}

            {!selectedVoice && isPremium && availableVoices.length === 0 && (
              <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <AlertTitle className="text-amber-900 dark:text-amber-100 mb-2">
                  {LANGUAGE_MAP[translationLanguage] || translationLanguage.toUpperCase()} Voice Not Installed
                </AlertTitle>
                <AlertDescription className="text-amber-800 dark:text-amber-200 space-y-2">
                  <p className="text-sm">
                    Your device doesn't have {LANGUAGE_MAP[translationLanguage] || 'this language'} text-to-speech installed.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLanguageHelp(true)}
                    className="w-full"
                  >
                    <Info className="w-4 h-4 mr-2" />
                    How to Install {LANGUAGE_MAP[translationLanguage]} Voice
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {!isPremium && (
              <p className="text-xs text-center text-purple-700 dark:text-purple-300">
                ✨ Upgrade to Premium to listen to Bible chapters in multiple languages with native voices
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Language Help Dialog */}
      <Dialog open={showLanguageHelp} onOpenChange={setShowLanguageHelp}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Install {LANGUAGE_MAP[translationLanguage]} Voice
            </DialogTitle>
            <DialogDescription>
              Follow these steps to enable {LANGUAGE_MAP[translationLanguage]} audio on your device
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <Alert>
              <Info className="w-4 h-4" />
              <AlertTitle>Your System: {userOS}</AlertTitle>
              <AlertDescription>
                {getInstallInstructions(userOS, LANGUAGE_MAP[translationLanguage])}
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Step-by-Step Instructions:</h4>
                {userOS === 'Windows' && (
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>Open Settings → Time & Language → Language & region</li>
                    <li>Click "Add a language"</li>
                    <li>Search for and select "{LANGUAGE_MAP[translationLanguage]}"</li>
                    <li>Click "Next" and check "Text-to-speech"</li>
                    <li>Click "Install" and wait for download to complete</li>
                    <li>Refresh this page to use the new voice</li>
                  </ol>
                )}
                {userOS === 'macOS' && (
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>Open System Preferences → Accessibility</li>
                    <li>Select "Spoken Content" from the left sidebar</li>
                    <li>Click "System Voice" dropdown → "Manage Voices..."</li>
                    <li>Find "{LANGUAGE_MAP[translationLanguage]}" in the list</li>
                    <li>Click the download icon next to your preferred voice</li>
                    <li>Wait for download, then refresh this page</li>
                  </ol>
                )}
                {userOS === 'iOS' && (
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>Open Settings → Accessibility → Spoken Content</li>
                    <li>Tap "Voices"</li>
                    <li>Tap your language (e.g., "{LANGUAGE_MAP[translationLanguage]}")</li>
                    <li>Download a high-quality voice (Enhanced or Premium)</li>
                    <li>Return to SermonSmith and refresh</li>
                  </ol>
                )}
                {userOS === 'Android' && (
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>Open Settings → System → Languages & input</li>
                    <li>Tap "Text-to-speech output"</li>
                    <li>Tap the gear icon next to your TTS engine</li>
                    <li>Select "Install voice data"</li>
                    <li>Download "{LANGUAGE_MAP[translationLanguage]}" voice</li>
                    <li>Restart your browser and refresh SermonSmith</li>
                  </ol>
                )}
              </div>

              <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-300">
                <Info className="w-4 h-4 text-blue-600" />
                <AlertTitle className="text-blue-900 dark:text-blue-100">
                  Languages Currently Available on Your Device
                </AlertTitle>
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  <div className="flex flex-wrap gap-2 mt-2">
                    {availableLanguages.map(lang => (
                      <Badge key={lang} variant="secondary">
                        {LANGUAGE_MAP[lang] || lang.toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                  {availableLanguages.length === 0 && (
                    <p className="text-sm">No voices detected. Install language packs to enable audio.</p>
                  )}
                </AlertDescription>
              </Alert>

              {availableLanguages.length > 0 && !availableLanguages.includes(translationLanguage) && (
                <Alert>
                  <Info className="w-4 h-4" />
                  <AlertDescription>
                    <strong>Tip:</strong> You can temporarily use an English translation (KJV, ESV, NIV) while you install {LANGUAGE_MAP[translationLanguage]} voices.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="flex justify-end gap-2">
              {getInstallLink() && (
                <Button
                  variant="outline"
                  onClick={() => {
                    try {
                      window.location.href = getInstallLink();
                    } catch (error) {
                      toast.info("Please open your system settings manually");
                    }
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Settings
                </Button>
              )}
              <Button onClick={() => setShowLanguageHelp(false)}>
                Got It
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Audio Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Audio Settings</DialogTitle>
            <DialogDescription>
              Customize voice, accent, speed, and reading style for {LANGUAGE_MAP[translationLanguage] || 'current language'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <Label>Voice & Accent</Label>
                  <Badge variant="outline" className="text-xs">
                    {LANGUAGE_MAP[translationLanguage] || translationLanguage.toUpperCase()}
                  </Badge>
                </div>
                {availableVoices.length === 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowSettings(false);
                      setShowLanguageHelp(true);
                    }}
                  >
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Install
                  </Button>
                )}
              </div>
              <Select
                value={selectedVoice?.name}
                onValueChange={handleVoiceChange}
                disabled={availableVoices.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={availableVoices.length === 0 ? "No voices installed" : "Select a voice"} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {availableVoices.map((voice) => (
                    <SelectItem key={voice.name} value={voice.name}>
                      {getVoiceLabel(voice)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {availableVoices.length === 0 ? (
                  <span className="text-amber-600">
                    ⚠️ No {LANGUAGE_MAP[translationLanguage]} voices installed. Click "Install" above.
                  </span>
                ) : (
                  `${availableVoices.length} voice${availableVoices.length > 1 ? 's' : ''} available. Different accents and regions shown in parentheses.`
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
