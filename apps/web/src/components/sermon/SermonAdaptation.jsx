import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Wand2, 
  Clock, 
  GraduationCap, 
  Languages, 
  Share2, 
  Loader2,
  Copy,
  Check,
  FileText,
  Zap,
  BookOpen
} from "lucide-react";
import { api } from '@/api/apiClient';
import { toast } from "sonner";
import { LARRY_SYSTEM_PROMPT } from '@/ai/personas';
import { denominationPromptBlock } from '@/lib/denominations';

const SERMON_LENGTHS = [
  { value: "brief", label: "Brief (10-15 min)", minutes: "10-15" },
  { value: "standard", label: "Standard (20-30 min)", minutes: "20-30" },
  { value: "extended", label: "Extended (40-50 min)", minutes: "40-50" },
  { value: "teaching", label: "Teaching Series (60+ min)", minutes: "60+" }
];

const THEOLOGICAL_DEPTHS = [
  { value: "simple", label: "Simple & Accessible", description: "New believers, seekers" },
  { value: "standard", label: "Standard Teaching", description: "Regular congregation" },
  { value: "deep", label: "Deep Theological", description: "Mature believers" },
  { value: "academic", label: "Academic/Seminary", description: "Scholars, students" }
];

const LANGUAGES = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "pt", name: "Portuguese", flag: "🇵🇹" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "zh", name: "Chinese (Simplified)", flag: "🇨🇳" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
  { code: "hi", name: "Hindi", flag: "🇮🇳" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "sw", name: "Swahili", flag: "🇰🇪" },
  { code: "tl", name: "Tagalog", flag: "🇵🇭" },
  { code: "vi", name: "Vietnamese", flag: "🇻🇳" },
  { code: "th", name: "Thai", flag: "🇹🇭" }
];

const SUMMARY_TYPES = [
  { value: "social", label: "Social Media Post", icon: Share2, description: "200-280 characters" },
  { value: "bulletin", label: "Bulletin Blurb", icon: FileText, description: "2-3 sentences" },
  { value: "email", label: "Email Newsletter", icon: FileText, description: "1 paragraph" },
  { value: "tweet", label: "Tweet Thread", icon: Share2, description: "Multi-tweet series" }
];

export default function SermonAdaptation({ open, onClose, sermon, onAdaptedSermon }) {
  const [activeTab, setActiveTab] = useState("length");
  const [isAdapting, setIsAdapting] = useState(false);
  const [adaptedContent, setAdaptedContent] = useState(null);
  const [copied, setCopied] = useState(false);

  // Length adjustment
  const [targetLength, setTargetLength] = useState("standard");
  
  // Depth adjustment
  const [targetDepth, setTargetDepth] = useState("standard");
  
  // Translation
  const [targetLanguage, setTargetLanguage] = useState("es");
  
  // Summary
  const [summaryType, setSummaryType] = useState("social");

  const handleLengthAdjustment = async () => {
    setIsAdapting(true);
    setAdaptedContent(null);
    
    try {
      const lengthInfo = SERMON_LENGTHS.find(l => l.value === targetLength);
      if (!lengthInfo) { toast.error('Unknown length selection'); return; }
      
      const prompt = `Larry, I need your help adapting this sermon for a different time constraint!

Current Sermon:
Title: ${sermon.title}
Topic: ${sermon.topic}
Points: ${sermon.points?.length || 0}
Current Length: Standard (20-30 min)

Target Length: ${lengthInfo.label} (${lengthInfo.minutes} minutes)

${targetLength === 'brief' ? `
Make it BRIEF (10-15 min):
- Keep only 2-3 most crucial points
- Condense illustrations to 1-2 sentences
- Focus on the "big idea"
- Quick, punchy applications
- Remove or greatly shorten exegesis
` : targetLength === 'extended' ? `
Make it EXTENDED (40-50 min):
- Expand all ${sermon.points?.length || 3} points with deeper teaching
- Add detailed exegesis for each point
- Include 2-3 illustrations per point
- Add more supporting scriptures
- Expand applications with specific examples
- Add theological depth and historical context
` : targetLength === 'teaching' ? `
Make it TEACHING SERIES LENGTH (60+ min):
- Full exposition of all points
- Extensive exegesis with original languages
- Multiple illustrations per point
- Deep theological exploration
- Comprehensive scripture references
- Academic-level teaching
- Q&A preparation material
` : `Keep it STANDARD (20-30 min) - just optimize the pacing.`}

${denominationPromptBlock(sermon.denomination || 'Non-Denominational')}
Maintain the same biblical truth and theology. Adjust ONLY the length and depth of content.

Return the adapted sermon in the same JSON format with title, big_idea, points array, and conclusion.`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        feature: 'sermon_adaptation',
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            big_idea: { type: "string" },
            points: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  exegesis: { type: "string" },
                  illustration: { type: "string" },
                  application: { type: "string" },
                  supporting_scriptures: {
                    type: "array",
                    items: { type: "string" }
                  }
                }
              }
            },
            conclusion: { type: "string" }
          }
        }
      });

      setAdaptedContent({
        type: 'sermon',
        data: response,
        metadata: { length: lengthInfo.label }
      });
      
      toast.success(`Larry adapted your sermon to ${lengthInfo.label}!`);
    } catch (error) {
      console.error("Error adjusting length:", error);
      toast.error("Failed to adjust sermon length");
    } finally {
      setIsAdapting(false);
    }
  };

  const handleDepthAdjustment = async () => {
    setIsAdapting(true);
    setAdaptedContent(null);
    
    try {
      const depthInfo = THEOLOGICAL_DEPTHS.find(d => d.value === targetDepth);
      if (!depthInfo) { toast.error('Unknown depth selection'); return; }
      
      const prompt = `Larry, adapt this sermon for a different theological depth level!

Current Sermon:
Title: ${sermon.title}
Topic: ${sermon.topic}
Big Idea: ${sermon.big_idea}

Target Audience: ${depthInfo.label} (${depthInfo.description})

${targetDepth === 'simple' ? `
Make it SIMPLE & ACCESSIBLE:
- Use everyday language, no theological jargon
- Short, clear sentences
- Concrete examples from daily life
- Explain every theological term
- Focus on practical application
- Use analogies and stories
- Assume no biblical background
` : targetDepth === 'deep' ? `
Make it THEOLOGICALLY DEEP:
- Use proper theological terminology
- Reference church history and tradition
- Discuss different interpretations
- Include Greek/Hebrew word studies
- Reference other scriptures extensively
- Address complex doctrinal questions
- Assume solid biblical foundation
` : targetDepth === 'academic' ? `
Make it ACADEMIC/SEMINARY LEVEL:
- Scholarly language and references
- Original language exegesis
- Citation of commentaries and scholars
- Historical-grammatical analysis
- Theological framework discussions
- Engagement with different traditions
- Critical analysis of texts
- Bibliography-worthy depth
` : `Keep it STANDARD - accessible but substantive teaching.`}

${denominationPromptBlock(sermon.denomination || 'Non-Denominational')}
Maintain the same core message and biblical truth. Adjust ONLY the theological depth and language complexity.

Return the adapted sermon in the same JSON format.`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        feature: 'sermon_adaptation',
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            big_idea: { type: "string" },
            points: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  exegesis: { type: "string" },
                  illustration: { type: "string" },
                  application: { type: "string" },
                  supporting_scriptures: {
                    type: "array",
                    items: { type: "string" }
                  }
                }
              }
            },
            conclusion: { type: "string" }
          }
        }
      });

      setAdaptedContent({
        type: 'sermon',
        data: response,
        metadata: { depth: depthInfo.label }
      });
      
      toast.success(`Larry adapted your sermon for ${depthInfo.label}!`);
    } catch (error) {
      console.error("Error adjusting depth:", error);
      toast.error("Failed to adjust theological depth");
    } finally {
      setIsAdapting(false);
    }
  };

  const handleTranslation = async () => {
    setIsAdapting(true);
    setAdaptedContent(null);
    
    try {
      const languageInfo = LANGUAGES.find(l => l.code === targetLanguage);
      if (!languageInfo) { toast.error('Unknown language selection'); return; }
      
      const prompt = `Larry, I need you to translate this entire sermon into ${languageInfo.name}!

Sermon to Translate:
Title: ${sermon.title}
Topic: ${sermon.topic}
Big Idea: ${sermon.big_idea}

Points:
${sermon.points ? sermon.points.map((p, i) => `
Point ${i+1}: ${p.title}
Exegesis: ${p.exegesis?.substring(0, 200)}...
Illustration: ${p.illustration?.substring(0, 200)}...
Application: ${p.application?.substring(0, 200)}...
`).join('\n') : ''}

Conclusion: ${sermon.conclusion?.substring(0, 300)}

Translate EVERYTHING into ${languageInfo.name}:
- Maintain the theological accuracy
- Use culturally appropriate idioms and examples
- Keep scripture references in their standard format
- Preserve the sermon structure
- Use natural, native ${languageInfo.name} that flows well
- Adapt cultural references if needed for ${languageInfo.name} speakers

Return the full translated sermon in the same JSON format.`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        feature: 'sermon_adaptation',
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            big_idea: { type: "string" },
            points: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  exegesis: { type: "string" },
                  illustration: { type: "string" },
                  application: { type: "string" },
                  supporting_scriptures: {
                    type: "array",
                    items: { type: "string" }
                  }
                }
              }
            },
            conclusion: { type: "string" }
          }
        }
      });

      setAdaptedContent({
        type: 'sermon',
        data: response,
        metadata: { language: `${languageInfo.flag} ${languageInfo.name}` }
      });
      
      toast.success(`Larry translated your sermon to ${languageInfo.name}! ${languageInfo.flag}`);
    } catch (error) {
      console.error("Error translating:", error);
      toast.error("Failed to translate sermon");
    } finally {
      setIsAdapting(false);
    }
  };

  const handleSummaryGeneration = async () => {
    setIsAdapting(true);
    setAdaptedContent(null);
    
    try {
      const summaryInfo = SUMMARY_TYPES.find(s => s.value === summaryType);
      if (!summaryInfo) { toast.error('Unknown summary type'); return; }
      
      const prompt = `Larry, create a ${summaryInfo.label} for this sermon!

Sermon:
Title: ${sermon.title}
Topic: ${sermon.topic}
Big Idea: ${sermon.big_idea}
Key Points: ${sermon.points?.map(p => p.title).join(', ') ?? ''}

${summaryType === 'social' ? `
Create a SOCIAL MEDIA POST (200-280 characters):
- Grab attention immediately
- Include the big idea
- End with a call to action or question
- Use emojis where appropriate
- Make it shareable and engaging
- Stay within character limit
` : summaryType === 'bulletin' ? `
Create a BULLETIN BLURB (2-3 sentences):
- Summarize the sermon clearly
- Invite people to attend/listen
- Professional church bulletin tone
- Mention the main scripture
` : summaryType === 'email' ? `
Create an EMAIL NEWSLETTER PARAGRAPH:
- 4-6 sentences
- Recap the key message
- Share a highlight or story
- Encourage application
- Warm, personal tone
` : `
Create a TWEET THREAD (3-5 tweets):
- Tweet 1: Hook/Big idea (280 chars)
- Tweet 2: Key point (280 chars)
- Tweet 3: Application (280 chars)
- Tweet 4-5: Supporting points or conclusion (280 chars each)
- Number them (1/5, 2/5, etc.)
- Make each stand alone AND build together
`}

Make it compelling and share-worthy!`;

      if (summaryType === 'tweet') {
        const response = await api.integrations.Core.InvokeLLM({
          system_prompt: LARRY_SYSTEM_PROMPT,
          prompt,
          feature: 'sermon_adaptation',
          response_json_schema: {
            type: "object",
            properties: {
              tweets: {
                type: "array",
                items: { type: "string" }
              }
            }
          }
        });

        setAdaptedContent({
          type: 'summary',
          data: response.tweets || [],
          metadata: { summaryType: summaryInfo.label }
        });
      } else {
        const response = await api.integrations.Core.InvokeLLM({ system_prompt: LARRY_SYSTEM_PROMPT, prompt, feature: 'sermon_adaptation' });
        const text = typeof response === 'string' ? response : response?.response || JSON.stringify(response);

        setAdaptedContent({
          type: 'summary',
          data: text,
          metadata: { summaryType: summaryInfo.label }
        });
      }
      
      toast.success(`Larry created your ${summaryInfo.label}!`);
    } catch (error) {
      console.error("Error generating summary:", error);
      toast.error("Failed to generate summary");
    } finally {
      setIsAdapting(false);
    }
  };

  const handleCopy = () => {
    let textToCopy = '';
    
    if (adaptedContent?.type === 'summary') {
      if (Array.isArray(adaptedContent.data)) {
        textToCopy = adaptedContent.data.map((tweet, i) => 
          `${i + 1}/${adaptedContent.data.length} ${tweet}`
        ).join('\n\n');
      } else {
        textToCopy = adaptedContent.data;
      }
    } else if (adaptedContent?.type === 'sermon') {
      textToCopy = JSON.stringify(adaptedContent.data, null, 2);
    }
    
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUseAdapted = () => {
    if (adaptedContent?.type === 'sermon') {
      onAdaptedSermon(adaptedContent.data);
      toast.success("Adapted sermon applied!");
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-6 h-6 text-purple-600" />
            Sermon Adaptation Studio
          </DialogTitle>
          <DialogDescription>
            Let Larry adapt your sermon for different contexts and audiences
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Tabs */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={activeTab === 'length' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('length')}
            >
              <Clock className="w-4 h-4 mr-2" />
              Length
            </Button>
            <Button
              variant={activeTab === 'depth' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('depth')}
            >
              <GraduationCap className="w-4 h-4 mr-2" />
              Depth
            </Button>
            <Button
              variant={activeTab === 'translate' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('translate')}
            >
              <Languages className="w-4 h-4 mr-2" />
              Translate
            </Button>
            <Button
              variant={activeTab === 'summary' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('summary')}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Summary
            </Button>
          </div>

          {/* Length Adjustment */}
          {activeTab === 'length' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Adjust Sermon Length</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Target Length</label>
                  <Select value={targetLength} onValueChange={setTargetLength}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SERMON_LENGTHS.map((length) => (
                        <SelectItem key={length.value} value={length.value}>
                          {length.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Alert>
                  <Zap className="w-4 h-4" />
                  <AlertDescription>
                    Larry will {targetLength === 'brief' ? 'condense' : targetLength === 'standard' ? 'optimize' : 'expand'} your sermon while preserving the core message and biblical truth.
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={handleLengthAdjustment}
                  disabled={isAdapting}
                  className="w-full"
                >
                  {isAdapting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Larry is adapting...
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 mr-2" />
                      Adjust Length
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Depth Adjustment */}
          {activeTab === 'depth' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Adjust Theological Depth</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Target Depth</label>
                  <Select value={targetDepth} onValueChange={setTargetDepth}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {THEOLOGICAL_DEPTHS.map((depth) => (
                        <SelectItem key={depth.value} value={depth.value}>
                          <div>
                            <div className="font-medium">{depth.label}</div>
                            <div className="text-xs text-gray-500">{depth.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Alert>
                  <BookOpen className="w-4 h-4" />
                  <AlertDescription>
                    Larry will adjust the theological complexity while maintaining biblical accuracy.
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={handleDepthAdjustment}
                  disabled={isAdapting}
                  className="w-full"
                >
                  {isAdapting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Larry is adapting...
                    </>
                  ) : (
                    <>
                      <GraduationCap className="w-4 h-4 mr-2" />
                      Adjust Depth
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Translation */}
          {activeTab === 'translate' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Translate Sermon</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Target Language</label>
                  <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.flag} {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Alert>
                  <Languages className="w-4 h-4" />
                  <AlertDescription>
                    Larry will translate the entire sermon with cultural sensitivity and theological accuracy.
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={handleTranslation}
                  disabled={isAdapting}
                  className="w-full"
                >
                  {isAdapting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Larry is translating...
                    </>
                  ) : (
                    <>
                      <Languages className="w-4 h-4 mr-2" />
                      Translate Sermon
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Summary Generation */}
          {activeTab === 'summary' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Generate Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Summary Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    {SUMMARY_TYPES.map((type) => {
                      const Icon = type.icon;
                      return (
                        <Button
                          key={type.value}
                          variant={summaryType === type.value ? 'default' : 'outline'}
                          className="h-auto py-4 flex flex-col items-start gap-2"
                          onClick={() => setSummaryType(type.value)}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            <span className="font-medium text-sm">{type.label}</span>
                          </div>
                          <span className="text-xs opacity-80">{type.description}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <Alert>
                  <Share2 className="w-4 h-4" />
                  <AlertDescription>
                    Larry will create engaging, shareable content perfect for your communication needs.
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={handleSummaryGeneration}
                  disabled={isAdapting}
                  className="w-full"
                >
                  {isAdapting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Larry is creating...
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4 mr-2" />
                      Generate Summary
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Adapted Content Display */}
          {adaptedContent && (
            <Card className="border-2 border-green-500">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">✨ Adapted Content</CardTitle>
                    <Badge className="mt-2">{adaptedContent.metadata.length || adaptedContent.metadata.depth || adaptedContent.metadata.language || adaptedContent.metadata.summaryType}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                    >
                      {copied ? (
                        <Check className="w-4 h-4 mr-2" />
                      ) : (
                        <Copy className="w-4 h-4 mr-2" />
                      )}
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                    {adaptedContent.type === 'sermon' && (
                      <Button
                        size="sm"
                        onClick={handleUseAdapted}
                      >
                        Use This Version
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="max-h-96 overflow-y-auto">
                {adaptedContent.type === 'summary' ? (
                  <div className="space-y-3">
                    {Array.isArray(adaptedContent.data) ? (
                      adaptedContent.data.map((tweet, index) => (
                        <div key={index} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border">
                          <div className="text-xs text-gray-500 mb-1">
                            Tweet {index + 1}/{adaptedContent.data.length}
                          </div>
                          <p className="text-sm">{tweet}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {adaptedContent.data}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 text-sm">
                    <div>
                      <strong>Title:</strong> {adaptedContent.data.title}
                    </div>
                    <div>
                      <strong>Big Idea:</strong> {adaptedContent.data.big_idea}
                    </div>
                    <div>
                      <strong>Points:</strong> {adaptedContent.data.points?.length || 0}
                    </div>
                    <Alert>
                      <AlertDescription>
                        Click "Use This Version" to replace your current sermon with this adapted version.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}