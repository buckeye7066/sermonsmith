import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  X, 
  Clock, 
  Maximize, 
  Lightbulb,
  BookOpen,
  Bot,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Settings,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  TrendingUp,
  Users,
  Search,
  Zap,
  MessageCircle,
  Heart,
  Target,
  Brain
} from "lucide-react";
import { api } from '@/api/apiClient';
import { toast } from "sonner";
import { LARRY_SYSTEM_PROMPT } from '@/ai/personas';

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const ASSISTANT_PERSONALITIES = [
  { 
    id: 'encouraging', 
    name: 'Encouraging Coach', 
    icon: Heart,
    description: 'Supportive, positive, motivational',
    style: 'You\'re doing great! Keep that energy!'
  },
  { 
    id: 'direct', 
    name: 'Direct Advisor', 
    icon: Target,
    description: 'Straightforward, concise, focused',
    style: 'Move to next point. Time is running.'
  },
  { 
    id: 'analytical', 
    name: 'Analytical Mentor', 
    icon: Brain,
    description: 'Data-driven, strategic, thoughtful',
    style: 'Based on pace, consider condensing Point 3.'
  },
  { 
    id: 'conversational', 
    name: 'Conversational Friend', 
    icon: MessageCircle,
    description: 'Warm, casual, relatable',
    style: 'Hey, that illustration landed well! Keep going!'
  }
];

export default function PresentationMode({ sermon, onClose }) {
  const [currentPointIndex, setCurrentPointIndex] = useState(-1);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState(28);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [lastSuggestionPoint, setLastSuggestionPoint] = useState(-999);
  const [pauseStartTime, setPauseStartTime] = useState(null);
  
  // New AI features
  const [vocalFeedback, setVocalFeedback] = useState(null);
  const [isVocalMonitoring, setIsVocalMonitoring] = useState(false);
  const [showScriptureLookup, setShowScriptureLookup] = useState(false);
  const [scriptureQuery, setScriptureQuery] = useState("");
  const [scriptureResults, setScriptureResults] = useState(null);
  const [isSearchingScripture, setIsSearchingScripture] = useState(false);
  const [engagementSuggestion, setEngagementSuggestion] = useState(null);
  const [assistantPersonality, setAssistantPersonality] = useState('encouraging');
  
  const [settings, setSettings] = useState({
    targetTime: 30,
    showTimingCues: true,
    showAISuggestions: true,
    autoSuggestOnPause: true,
    pauseThreshold: 5,
    enableVoiceAlerts: false,
    enableVocalFeedback: true,
    enableEngagementSuggestions: true,
    vocalFeedbackInterval: 60 // seconds
  });

  const containerRef = useRef(null);
  const timerRef = useRef(null);
  const pauseTimerRef = useRef(null);
  const vocalFeedbackTimerRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  // Vocal feedback monitoring
  useEffect(() => {
    if (isVocalMonitoring && settings.enableVocalFeedback && isRunning) {
      vocalFeedbackTimerRef.current = setInterval(() => {
        generateVocalFeedback();
      }, settings.vocalFeedbackInterval * 1000);
    } else {
      if (vocalFeedbackTimerRef.current) {
        clearInterval(vocalFeedbackTimerRef.current);
      }
    }

    return () => {
      if (vocalFeedbackTimerRef.current) clearInterval(vocalFeedbackTimerRef.current);
    };
  }, [isVocalMonitoring, settings.enableVocalFeedback, isRunning]);

  // Auto-engagement suggestions
  useEffect(() => {
    if (settings.enableEngagementSuggestions && isRunning && currentPointIndex >= 0) {
      // Suggest engagement every 5 minutes
      const interval = setInterval(() => {
        generateEngagementSuggestion();
      }, 300000); // 5 minutes

      return () => clearInterval(interval);
    }
  }, [settings.enableEngagementSuggestions, isRunning, currentPointIndex]);

  // Monitor pauses for auto-suggestions
  useEffect(() => {
    if (!isRunning || !settings.autoSuggestOnPause) {
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
        setPauseStartTime(null);
      }
      return;
    }

    if (!pauseStartTime) {
      setPauseStartTime(Date.now());
    }

    pauseTimerRef.current = setTimeout(() => {
      if (currentPointIndex !== lastSuggestionPoint) {
        handleAISuggestion();
      }
    }, settings.pauseThreshold * 1000);

    return () => {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    };
  }, [isRunning, currentPointIndex, pauseStartTime, settings.autoSuggestOnPause]);

  const handleUserAction = () => {
    setPauseStartTime(null);
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
    }
  };

  const toggleVocalMonitoring = () => {
    setIsVocalMonitoring(!isVocalMonitoring);
    if (!isVocalMonitoring) {
      toast.success("Vocal monitoring started - Larry is listening");
    } else {
      toast.info("Vocal monitoring paused");
      setVocalFeedback(null);
    }
  };

  const generateVocalFeedback = async () => {
    // Simulate vocal analysis - in production this would use Web Audio API
    const personalityData = ASSISTANT_PERSONALITIES.find(p => p.id === assistantPersonality);
    
    try {
      const prompt = `You are Larry, the AI preaching assistant with a ${personalityData.name} personality (${personalityData.description}).

The preacher has been speaking for ${Math.floor(elapsedTime / 60)} minutes. Based on typical vocal patterns at this stage:

Provide brief vocal feedback in your ${assistantPersonality} style:
1. Pace assessment (too fast, good, or slow)
2. Energy level observation
3. One actionable tip

Keep it VERY brief (2-3 sentences max) and ${assistantPersonality === 'encouraging' ? 'encouraging' : assistantPersonality === 'direct' ? 'direct' : assistantPersonality === 'analytical' ? 'analytical' : 'conversational'}.`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            pace: { type: "string", enum: ["fast", "good", "slow"] },
            energy: { type: "string", enum: ["high", "good", "low"] },
            feedback: { type: "string" },
            tip: { type: "string" }
          }
        }
      });

      setVocalFeedback(response);
    } catch (error) {
      console.error("Error generating vocal feedback:", error);
      toast.error("Larry couldn't analyze your delivery right now");
    }
  };

  const generateEngagementSuggestion = async () => {
    const personalityData = ASSISTANT_PERSONALITIES.find(p => p.id === assistantPersonality);
    
    try {
      const currentContent = getCurrentContent();
      
      const prompt = `You are Larry with a ${personalityData.name} personality.

Current sermon context:
Point: ${currentContent.subtitle}
Time: ${formatTime(elapsedTime)}

Suggest ONE specific way to engage the audience RIGHT NOW. Options:
- Ask a rhetorical question
- Invite a show of hands
- Share a brief personal story prompt
- Pause for reflection
- Interactive element

Keep it ${assistantPersonality === 'encouraging' ? 'encouraging and positive' : assistantPersonality === 'direct' ? 'brief and actionable' : assistantPersonality === 'analytical' ? 'strategic' : 'warm and conversational'}.`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            type: { type: "string" },
            suggestion: { type: "string" }
          }
        }
      });

      setEngagementSuggestion(response);
      setTimeout(() => setEngagementSuggestion(null), 15000);
    } catch (error) {
      console.error("Error generating engagement:", error);
    }
  };

  const searchScripture = async () => {
    if (!scriptureQuery.trim()) return;
    
    setIsSearchingScripture(true);
    
    try {
      const prompt = `Larry, I need a quick scripture reference while preaching!

Query: "${scriptureQuery}"

Find and return 2-3 relevant Bible verses that address this. Include:
- Verse reference
- Verse text (real verses only)
- Why it's relevant

Keep each verse brief and directly applicable to preaching context.`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            verses: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  reference: { type: "string" },
                  text: { type: "string" },
                  relevance: { type: "string" }
                }
              }
            }
          }
        }
      });

      setScriptureResults(response.verses);
      toast.success("Found verses!");
    } catch (error) {
      console.error("Error searching scripture:", error);
      toast.error("Scripture search failed");
    } finally {
      setIsSearchingScripture(false);
    }
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleNext = () => {
    handleUserAction();
    const maxIndex = sermon.points.length;
    if (currentPointIndex < maxIndex) {
      setCurrentPointIndex(currentPointIndex + 1);
      setAiSuggestion(null);
    }
  };

  const handlePrevious = () => {
    handleUserAction();
    if (currentPointIndex > -1) {
      setCurrentPointIndex(currentPointIndex - 1);
      setAiSuggestion(null);
    }
  };

  const handleAISuggestion = async () => {
    if (!settings.showAISuggestions || isLoadingSuggestion) return;
    
    setIsLoadingSuggestion(true);
    setLastSuggestionPoint(currentPointIndex);
    
    try {
      const personalityData = ASSISTANT_PERSONALITIES.find(p => p.id === assistantPersonality);
      let context = "";
      
      if (currentPointIndex === -1) {
        context = `Introduction - Big Idea: ${sermon.big_idea}`;
      } else if (currentPointIndex >= sermon.points.length) {
        context = `Conclusion - Wrapping up sermon on ${sermon.topic}`;
      } else {
        const point = sermon.points[currentPointIndex];
        context = `Point ${currentPointIndex + 1}: ${point.title}\nExegesis: ${point.exegesis?.substring(0, 300)}`;
      }

      const prompt = `You are Larry with a ${personalityData.name} personality (${personalityData.description}).

I'm preaching live right now and could use a quick assist!

Current context: ${context}
Sermon topic: ${sermon.topic}
Time elapsed: ${formatTime(elapsedTime)}

I've paused. Provide ONE brief suggestion in your ${assistantPersonality} style:
- Transition phrase
- Scripture reference
- Quick example (2-3 sentences)
- Audience question

Match the ${personalityData.description} tone!`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            type: { type: "string" },
            content: { type: "string" }
          }
        }
      });

      setAiSuggestion(response);
    } catch (error) {
      console.error("Error getting AI suggestion:", error);
    } finally {
      setIsLoadingSuggestion(false);
    }
  };

  const getTimingStatus = () => {
    const elapsedMinutes = elapsedTime / 60;
    const targetMinutes = settings.targetTime;
    const expectedProgress = (currentPointIndex + 1) / (sermon.points.length + 2);
    const actualProgress = elapsedMinutes / targetMinutes;

    if (currentPointIndex === -1) {
      if (elapsedMinutes > 4) return { status: "warning", message: "Consider moving to Point 1" };
      return { status: "good", message: "Good pace" };
    }

    if (actualProgress < expectedProgress - 0.15) {
      return { status: "fast", message: "You're ahead of schedule - can expand points" };
    } else if (actualProgress > expectedProgress + 0.15) {
      return { status: "slow", message: "Running behind - consider condensing" };
    }

    return { status: "good", message: "On pace" };
  };

  const getCurrentContent = () => {
    if (currentPointIndex === -1) {
      return {
        title: sermon.title,
        subtitle: "Introduction",
        content: sermon.big_idea,
        type: "intro"
      };
    } else if (currentPointIndex >= sermon.points.length) {
      return {
        title: "Conclusion",
        subtitle: sermon.title,
        content: sermon.conclusion,
        type: "conclusion"
      };
    } else {
      const point = sermon.points[currentPointIndex];
      return {
        title: `Point ${currentPointIndex + 1}`,
        subtitle: point.title,
        content: point.exegesis,
        illustration: point.illustration,
        application: point.application,
        scriptures: point.supporting_scriptures,
        type: "point"
      };
    }
  };

  const timingStatus = getTimingStatus();
  const currentContent = getCurrentContent();
  const progress = ((currentPointIndex + 2) / (sermon.points.length + 2)) * 100;
  const currentPersonality = ASSISTANT_PERSONALITIES.find(p => p.id === assistantPersonality);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === 'p') {
        setIsRunning(!isRunning);
      } else if (e.key === 's') {
        handleAISuggestion();
      } else if (e.key === 'v') {
        toggleVocalMonitoring();
      } else if (e.key === 'l') {
        setShowScriptureLookup(true);
      } else if (e.key === 'e') {
        generateEngagementSuggestion();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentPointIndex, isRunning]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black z-50 flex flex-col"
      style={{ fontSize: `${fontSize}px` }}
    >
      {/* Top Bar */}
      <div className="bg-gray-900 text-white p-4 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsRunning(!isRunning)}
            className="text-white hover:bg-gray-800"
          >
            {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </Button>
          
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            <span className="font-mono text-lg">{formatTime(elapsedTime)}</span>
            <span className="text-gray-400 text-sm">/ {settings.targetTime}min</span>
          </div>

          {settings.showTimingCues && (
            <Badge 
              variant={timingStatus.status === 'good' ? 'default' : 'secondary'}
              className={`${
                timingStatus.status === 'fast' ? 'bg-blue-500' : 
                timingStatus.status === 'slow' ? 'bg-orange-500' : 
                'bg-green-500'
              } text-white`}
            >
              {timingStatus.status === 'good' && <CheckCircle2 className="w-3 h-3 mr-1" />}
              {timingStatus.status === 'slow' && <AlertTriangle className="w-3 h-3 mr-1" />}
              {timingStatus.message}
            </Badge>
          )}

          {/* Vocal Feedback Badge */}
          {vocalFeedback && (
            <Badge className={`${
              vocalFeedback.pace === 'fast' ? 'bg-orange-500' :
              vocalFeedback.pace === 'slow' ? 'bg-blue-500' :
              'bg-green-500'
            } text-white animate-pulse`}>
              <Mic className="w-3 h-3 mr-1" />
              Pace: {vocalFeedback.pace}
            </Badge>
          )}

          {/* AI Personality Indicator */}
          <Badge variant="outline" className="text-white border-purple-400">
            <currentPersonality.icon className="w-3 h-3 mr-1" />
            {currentPersonality.name}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Vocal Monitoring Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleVocalMonitoring}
            className={`text-white hover:bg-gray-800 ${isVocalMonitoring ? 'bg-red-600' : ''}`}
            title="Toggle vocal monitoring (V)"
          >
            {isVocalMonitoring ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </Button>

          {/* Scripture Lookup */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowScriptureLookup(true)}
            className="text-white hover:bg-gray-800"
            title="Quick scripture lookup (L)"
          >
            <Search className="w-4 h-4" />
          </Button>

          {/* Engagement Suggestion */}
          <Button
            variant="ghost"
            size="sm"
            onClick={generateEngagementSuggestion}
            className="text-white hover:bg-gray-800"
            title="Get engagement idea (E)"
          >
            <Users className="w-4 h-4" />
          </Button>

          <span className="text-sm text-gray-400">
            {currentPointIndex + 2} / {sermon.points.length + 2}
          </span>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(true)}
            className="text-white hover:bg-gray-800"
          >
            <Settings className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="text-white hover:bg-gray-800"
          >
            <Maximize className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-gray-800"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-gray-800">
        <div 
          className="h-full bg-indigo-600 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-12 text-white">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Current Section */}
          <div className="text-center space-y-4">
            <Badge variant="outline" className="text-lg px-4 py-2 border-gray-600 text-gray-300">
              {currentContent.title}
            </Badge>
            <h1 className="text-5xl font-bold leading-tight" style={{ fontSize: `${fontSize * 1.8}px` }}>
              {currentContent.subtitle}
            </h1>
          </div>

          {/* Main Content */}
          <Card className="bg-gray-900 border-gray-700 shadow-2xl">
            <CardContent className="p-8 space-y-6">
              {currentContent.type === 'intro' && (
                <div>
                  <h2 className="text-3xl font-bold mb-4 text-indigo-400">Big Idea</h2>
                  <p className="text-2xl leading-relaxed text-gray-200">
                    {currentContent.content}
                  </p>
                </div>
              )}

              {currentContent.type === 'point' && (
                <div className="space-y-6">
                  {currentContent.content && (
                    <div>
                      <h3 className="text-2xl font-bold mb-3 text-blue-400 flex items-center gap-2">
                        <BookOpen className="w-6 h-6" />
                        Key Teaching
                      </h3>
                      <p className="text-xl leading-relaxed text-gray-200" style={{ fontSize: `${fontSize}px` }}>
                        {currentContent.content?.substring(0, 400)}...
                      </p>
                    </div>
                  )}

                  {currentContent.scriptures && currentContent.scriptures.length > 0 && (
                    <div className="bg-gray-800 p-4 rounded-lg border-l-4 border-purple-500">
                      <h4 className="text-lg font-semibold mb-2 text-purple-400">📖 Supporting Scriptures</h4>
                      <div className="flex flex-wrap gap-2">
                        {currentContent.scriptures.map((scripture, index) => (
                          <Badge key={index} variant="outline" className="text-base border-gray-600 text-gray-300">
                            {scripture}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentContent.illustration && (
                    <div className="bg-yellow-900/30 p-4 rounded-lg border-l-4 border-yellow-500">
                      <h4 className="text-lg font-semibold mb-2 text-yellow-400 flex items-center gap-2">
                        <Lightbulb className="w-5 h-5" />
                        Illustration
                      </h4>
                      <p className="text-base text-gray-300">
                        {currentContent.illustration.substring(0, 200)}...
                      </p>
                    </div>
                  )}

                  {currentContent.application && (
                    <div className="bg-green-900/30 p-4 rounded-lg border-l-4 border-green-500">
                      <h4 className="text-lg font-semibold mb-2 text-green-400">✨ Application</h4>
                      <p className="text-base text-gray-300">
                        {currentContent.application.substring(0, 200)}...
                      </p>
                    </div>
                  )}
                </div>
              )}

              {currentContent.type === 'conclusion' && (
                <div>
                  <h2 className="text-3xl font-bold mb-4 text-green-400">Call to Response</h2>
                  <p className="text-2xl leading-relaxed text-gray-200">
                    {currentContent.content}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vocal Feedback Alert */}
          {vocalFeedback && (
            <Alert className="bg-purple-900/50 border-purple-500 animate-in slide-in-from-bottom">
              <Mic className="w-5 h-5 text-purple-400" />
              <AlertDescription className="text-white">
                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <Badge className={vocalFeedback.pace === 'fast' ? 'bg-orange-500' : vocalFeedback.pace === 'slow' ? 'bg-blue-500' : 'bg-green-500'}>
                      Pace: {vocalFeedback.pace}
                    </Badge>
                    <Badge className={vocalFeedback.energy === 'low' ? 'bg-orange-500' : vocalFeedback.energy === 'high' ? 'bg-blue-500' : 'bg-green-500'}>
                      Energy: {vocalFeedback.energy}
                    </Badge>
                  </div>
                  <p className="text-lg">{vocalFeedback.feedback}</p>
                  <p className="text-sm text-purple-300">💡 {vocalFeedback.tip}</p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Engagement Suggestion */}
          {engagementSuggestion && (
            <Alert className="bg-blue-900/50 border-blue-500 animate-in slide-in-from-right">
              <Users className="w-5 h-5 text-blue-400" />
              <AlertDescription className="text-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <span className="font-semibold text-blue-400">
                      Engagement Idea ({engagementSuggestion.type}):
                    </span>
                    <p className="mt-2 text-lg">{engagementSuggestion.suggestion}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEngagementSuggestion(null)}
                    className="text-white hover:bg-blue-800"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* AI Content Suggestion */}
          {settings.showAISuggestions && aiSuggestion && (
            <Alert className="bg-indigo-900/50 border-indigo-500 animate-in slide-in-from-bottom">
              <Bot className="w-5 h-5 text-indigo-400" />
              <AlertDescription className="text-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <span className="font-semibold text-indigo-400">
                      Larry suggests ({aiSuggestion.type}):
                    </span>
                    <p className="mt-2 text-lg">{aiSuggestion.content}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAiSuggestion(null)}
                    className="text-white hover:bg-indigo-800"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {isLoadingSuggestion && (
            <div className="text-center text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              <p className="text-sm">Larry is preparing a suggestion...</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="bg-gray-900 border-t border-gray-700 p-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button
            onClick={handlePrevious}
            disabled={currentPointIndex <= -1}
            size="lg"
            variant="outline"
            className="border-gray-600 text-white hover:bg-gray-800"
          >
            <SkipBack className="w-5 h-5 mr-2" />
            Previous
          </Button>

          <div className="flex items-center gap-4">
            {settings.showAISuggestions && (
              <Button
                onClick={handleAISuggestion}
                disabled={isLoadingSuggestion}
                variant="outline"
                className="border-indigo-600 text-indigo-400 hover:bg-indigo-900/30"
              >
                {isLoadingSuggestion ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Bot className="w-4 h-4 mr-2" />
                )}
                Ask Larry (S)
              </Button>
            )}
            
            <div className="text-center text-gray-400 text-sm">
              <div>← → or Space: Navigate • S: AI Help • E: Engage</div>
              <div>V: Vocal Monitor • L: Scripture • P: Pause</div>
            </div>
          </div>

          <Button
            onClick={handleNext}
            disabled={currentPointIndex >= sermon.points.length}
            size="lg"
            variant="outline"
            className="border-gray-600 text-white hover:bg-gray-800"
          >
            Next
            <SkipForward className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Presentation Settings</DialogTitle>
            <DialogDescription>
              Customize Larry's AI assistance and presentation features
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* AI Personality */}
            <div>
              <Label className="text-base font-semibold mb-3 block">Larry's Personality</Label>
              <RadioGroup value={assistantPersonality} onValueChange={setAssistantPersonality}>
                <div className="grid grid-cols-2 gap-3">
                  {ASSISTANT_PERSONALITIES.map((personality) => {
                    const Icon = personality.icon;
                    return (
                      <div
                        key={personality.id}
                        className="flex items-start space-x-3 p-4 rounded-lg border hover:border-indigo-500 transition-colors cursor-pointer"
                        onClick={() => setAssistantPersonality(personality.id)}
                      >
                        <RadioGroupItem value={personality.id} id={personality.id} />
                        <Label htmlFor={personality.id} className="cursor-pointer flex-1">
                          <div className="flex items-center gap-2 font-medium mb-1">
                            <Icon className="w-4 h-4" />
                            {personality.name}
                          </div>
                          <div className="text-xs text-gray-500">{personality.description}</div>
                          <div className="text-xs text-gray-400 italic mt-1">"{personality.style}"</div>
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </RadioGroup>
            </div>

            {/* Other Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enable Vocal Feedback</Label>
                <input
                  type="checkbox"
                  checked={settings.enableVocalFeedback}
                  onChange={(e) => setSettings({...settings, enableVocalFeedback: e.target.checked})}
                  className="w-4 h-4"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Enable Engagement Suggestions</Label>
                <input
                  type="checkbox"
                  checked={settings.enableEngagementSuggestions}
                  onChange={(e) => setSettings({...settings, enableEngagementSuggestions: e.target.checked})}
                  className="w-4 h-4"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Auto-Suggest on Pause</Label>
                <input
                  type="checkbox"
                  checked={settings.autoSuggestOnPause}
                  onChange={(e) => setSettings({...settings, autoSuggestOnPause: e.target.checked})}
                  className="w-4 h-4"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setShowSettings(false)}>
                Save Settings
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Scripture Lookup Dialog */}
      <Dialog open={showScriptureLookup} onOpenChange={setShowScriptureLookup}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Quick Scripture Lookup
            </DialogTitle>
            <DialogDescription>
              Find relevant verses instantly while preaching
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="e.g., forgiveness, hope, faith, love..."
                value={scriptureQuery}
                onChange={(e) => setScriptureQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchScripture()}
              />
              <Button onClick={searchScripture} disabled={isSearchingScripture}>
                {isSearchingScripture ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>

            {scriptureResults && (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {scriptureResults.map((verse, index) => (
                  <Card key={index} className="bg-blue-50 dark:bg-blue-900/20">
                    <CardContent className="pt-4">
                      <div className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                        {verse.reference}
                      </div>
                      <p className="text-sm italic text-gray-700 dark:text-gray-300 mb-2">
                        "{verse.text}"
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        💡 {verse.relevance}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}