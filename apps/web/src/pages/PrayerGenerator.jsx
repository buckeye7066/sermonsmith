import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { LARRY_SYSTEM_PROMPT } from '@/ai/personas';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Heart,
  Sparkles,
  BookOpen,
  Loader2,
  Copy,
  Share2,
  Save,
  RefreshCw,
  Users,
  User,
  Church,
  Baby,
  GraduationCap,
  Volume2,
  VolumeX
} from "lucide-react";
import { toast } from "sonner";

const PRAYER_TYPES = [
  { value: 'personal', label: 'Personal Prayer', icon: User, description: 'For individual devotion' },
  { value: 'congregational', label: 'Congregational Prayer', icon: Church, description: 'For worship services' },
  { value: 'pastoral', label: 'Pastoral Prayer', icon: Heart, description: 'For shepherding & care' },
  { value: 'intercessory', label: 'Intercessory Prayer', icon: Users, description: 'For others\' needs' },
  { value: 'thanksgiving', label: 'Thanksgiving Prayer', icon: Sparkles, description: 'Gratitude & praise' },
  { value: 'children', label: 'Children\'s Prayer', icon: Baby, description: 'Simple & accessible' },
  { value: 'youth', label: 'Youth Prayer', icon: GraduationCap, description: 'For young people' }
];

const PRAYER_OCCASIONS = [
  'Morning Devotion', 'Evening Prayer', 'Worship Service Opening', 'Worship Service Closing',
  'Meal Blessing', 'Communion', 'Baptism', 'Wedding', 'Funeral', 'Hospital Visit',
  'Healing', 'Guidance', 'Comfort', 'Strength', 'Forgiveness', 'Protection',
  'Celebration', 'Crisis', 'Mission/Outreach', 'Small Group', 'General'
];

const prayerSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    opening: { type: "string" },
    body_sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          focus: { type: "string" },
          content: { type: "string" }
        }
      }
    },
    closing: { type: "string" },
    scripture_basis: {
      type: "array",
      items: { type: "string" }
    },
    alternate_endings: {
      type: "array",
      items: { type: "string" }
    }
  }
};

export default function PrayerGenerator() {
  const { user } = useAuth();
  const [prayerTheme, setPrayerTheme] = useState('');
  const [prayerType, setPrayerType] = useState('personal');
  const [occasion, setOccasion] = useState('General');
  const [scriptureRef, setScriptureRef] = useState('');
  const [specificNeeds, setSpecificNeeds] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPrayer, setGeneratedPrayer] = useState(null);
  const [savedPrayers, setSavedPrayers] = useState([]);
  const [isReading, setIsReading] = useState(false);
  const [speechSynthesis, setSpeechSynthesis] = useState(null);

  useEffect(() => {
    loadSavedPrayers();
    if ('speechSynthesis' in window) {
      setSpeechSynthesis(window.speechSynthesis);
    }
  }, []);

  const loadSavedPrayers = () => {
    try {
      const saved = localStorage.getItem('saved_prayers');
      if (saved) {
        setSavedPrayers(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load saved prayers');
    }
  };

  const generatePrayer = async () => {
    if (!prayerTheme.trim()) {
      toast.error('Please enter a prayer theme');
      return;
    }

    setIsGenerating(true);

    try {
      const denomination = user?.denomination || 'Non-Denominational';
      
      const typeInfo = PRAYER_TYPES.find(t => t.value === prayerType);
      
      const prompt = `IMPORTANT: NEVER invent or fabricate Bible verses. Only reference real, valid Scripture. If unsure, instruct the user to check their Bible.

You are a pastor helping create a biblically sound, heartfelt prayer.

Create a ${typeInfo.label} on the theme: "${prayerTheme}"

Context:
- Denomination: ${denomination}
- Occasion: ${occasion}
${scriptureRef ? `- Scripture Reference: ${scriptureRef}` : ''}
${specificNeeds ? `- Specific Needs: ${specificNeeds}` : ''}

Guidelines:
1. Be authentic, reverent, and biblically grounded
2. Appropriate for ${typeInfo.description}
3. Align with ${denomination} theology and language
4. Use "You/Your" (not "Thee/Thou") unless old English preferred by denomination
5. Include confession, thanksgiving, petition, and commitment where appropriate
6. Reference Scripture naturally (don't force it)
7. Be specific to the theme while remaining universal enough to be meaningful
8. Length: ${prayerType === 'children' ? '50-100 words' : prayerType === 'congregational' ? '150-250 words' : '100-200 words'}

Structure:
- Title: Brief, meaningful title
- Opening: Address God appropriately (Father, Lord, Heavenly Father, etc.)
- Body (2-4 sections): Each focusing on a different aspect (thanksgiving, confession, petition, etc.)
- Closing: Appropriate conclusion
- Scripture Basis: 3-5 key verses that inspired this prayer
- Alternate Endings: 2-3 variations of how to close (for different contexts)

Make it heartfelt, not formulaic. Use concrete imagery. Be personal yet universal.`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        response_json_schema: prayerSchema
      });

      setGeneratedPrayer({
        ...response,
        theme: prayerTheme,
        type: prayerType,
        occasion,
        created_at: new Date().toISOString()
      });

      toast.success('Prayer generated! 🙏');
    } catch (error) {
      console.error('Error generating prayer:', error);
      toast.error('Failed to generate prayer');
    } finally {
      setIsGenerating(false);
    }
  };

  const savePrayer = () => {
    if (!generatedPrayer) return;

    const updated = [generatedPrayer, ...savedPrayers.slice(0, 19)]; // Keep last 20
    setSavedPrayers(updated);
    localStorage.setItem('saved_prayers', JSON.stringify(updated));
    toast.success('Prayer saved!');
  };

  const copyPrayer = () => {
    if (!generatedPrayer) return;

    const fullText = `${generatedPrayer.title}\n\n${generatedPrayer.opening}\n\n${generatedPrayer.body_sections.map(s => s.content).join('\n\n')}\n\n${generatedPrayer.closing}`;
    
    navigator.clipboard.writeText(fullText);
    toast.success('Prayer copied to clipboard!');
  };

  const sharePrayer = () => {
    if (!generatedPrayer) return;

    const text = `${generatedPrayer.title}\n\n${generatedPrayer.opening}\n\n${generatedPrayer.body_sections.map(s => s.content).join('\n\n')}\n\n${generatedPrayer.closing}`;
    
    if (navigator.share) {
      navigator.share({ text }).catch(() => copyPrayer());
    } else {
      copyPrayer();
    }
  };

  const readPrayerAloud = () => {
    if (!generatedPrayer || !speechSynthesis) return;

    if (isReading) {
      speechSynthesis.cancel();
      setIsReading(false);
      return;
    }

    const text = `${generatedPrayer.opening}. ${generatedPrayer.body_sections.map(s => s.content).join('. ')}. ${generatedPrayer.closing}`;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.onend = () => setIsReading(false);
    
    speechSynthesis.speak(utterance);
    setIsReading(true);
    toast.info('Reading prayer aloud...');
  };

  const generateVariation = async () => {
    if (!generatedPrayer) return;

    setIsGenerating(true);

    try {
      const prompt = `Create a variation of this prayer on the same theme "${generatedPrayer.theme}" but with different wording and emphasis.

Original prayer focus: ${generatedPrayer.body_sections.map(s => s.focus).join(', ')}

Create a fresh prayer that:
- Covers similar ground but with new language
- Perhaps emphasizes different aspects
- Uses different Scripture allusions
- Maintains the same spirit and denomination alignment

Same structure as before.`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        response_json_schema: prayerSchema
      });

      setGeneratedPrayer({
        ...response,
        theme: generatedPrayer.theme,
        type: generatedPrayer.type,
        occasion: generatedPrayer.occasion,
        created_at: new Date().toISOString()
      });

      toast.success('New variation generated! 🙏');
    } catch (error) {
      toast.error('Failed to generate variation');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <Heart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h2 className="text-2xl font-bold mb-2">Sign In Required</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Access the Prayer Generator to create biblically sound prayers
              </p>
              <Button onClick={() => api.auth.redirectToLogin()}>Sign In</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Heart className="w-8 h-8 text-pink-600" />
            AI Prayer Generator
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Create biblically sound prayers for any occasion
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {!generatedPrayer ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                    Create a Prayer
                  </CardTitle>
                  <CardDescription>
                    AI will help you craft a meaningful, biblically grounded prayer
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Prayer Theme/Topic *</label>
                    <Input
                      placeholder="e.g., Healing for the sick, Guidance in decisions, Thanksgiving for blessings..."
                      value={prayerTheme}
                      onChange={(e) => setPrayerTheme(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && generatePrayer()}
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Prayer Type</label>
                      <Select value={prayerType} onValueChange={setPrayerType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRAYER_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Occasion</label>
                      <Select value={occasion} onValueChange={setOccasion}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-96">
                          {PRAYER_OCCASIONS.map(occ => (
                            <SelectItem key={occ} value={occ}>{occ}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Scripture Reference (Optional)</label>
                    <Input
                      placeholder="e.g., Philippians 4:6-7, Psalm 23"
                      value={scriptureRef}
                      onChange={(e) => setScriptureRef(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Specific Needs/Intentions (Optional)</label>
                    <Textarea
                      placeholder="Any specific people, situations, or needs to include..."
                      value={specificNeeds}
                      onChange={(e) => setSpecificNeeds(e.target.value)}
                      rows={3}
                    />
                  </div>

                  {user?.denomination && (
                    <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-300">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      <AlertDescription className="text-blue-800 dark:text-blue-200">
                        Prayer will be crafted for <strong>{user.denomination}</strong> theology and language
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    onClick={generatePrayer}
                    disabled={isGenerating || !prayerTheme.trim()}
                    className="w-full"
                    size="lg"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Crafting prayer...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        Generate Prayer
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <Card className="bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 border-pink-200">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-2xl mb-2">{generatedPrayer.title}</CardTitle>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge>{PRAYER_TYPES.find(t => t.value === generatedPrayer.type)?.label}</Badge>
                          <Badge variant="outline">{generatedPrayer.occasion}</Badge>
                          {generatedPrayer.theme && <Badge variant="secondary">{generatedPrayer.theme}</Badge>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={copyPrayer} title="Copy">
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={sharePrayer} title="Share">
                          <Share2 className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={savePrayer} title="Save">
                          <Save className="w-4 h-4" />
                        </Button>
                        {speechSynthesis && (
                          <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={readPrayerAloud}
                            title={isReading ? "Stop" : "Read Aloud"}
                          >
                            {isReading ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="prose dark:prose-invert max-w-none">
                      <p className="text-lg font-medium text-gray-800 dark:text-gray-200 leading-relaxed">
                        {generatedPrayer.opening}
                      </p>

                      {generatedPrayer.body_sections?.map((section, index) => (
                        <div key={index} className="my-4">
                          {section.focus && (
                            <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-2">
                              {section.focus}
                            </p>
                          )}
                          <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                            {section.content}
                          </p>
                        </div>
                      ))}

                      <p className="text-lg font-medium text-gray-800 dark:text-gray-200 leading-relaxed mt-6">
                        {generatedPrayer.closing}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Tabs defaultValue="scripture" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="scripture">Scripture Basis</TabsTrigger>
                    <TabsTrigger value="variations">Alternate Endings</TabsTrigger>
                  </TabsList>

                  <TabsContent value="scripture">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-blue-600" />
                          Biblical Foundation
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {generatedPrayer.scripture_basis?.map((verse, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm">
                              <span className="text-blue-600 dark:text-blue-400">•</span>
                              <span>{verse}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="variations">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Alternate Closing Options</CardTitle>
                        <CardDescription>Different ways to conclude this prayer</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {generatedPrayer.alternate_endings?.map((ending, index) => (
                            <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded border">
                              <p className="text-sm">{ending}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>

                <div className="flex gap-3 flex-wrap">
                  <Button 
                    variant="outline" 
                    onClick={() => setGeneratedPrayer(null)}
                    className="flex-1"
                  >
                    New Prayer
                  </Button>
                  <Button 
                    onClick={generateVariation}
                    disabled={isGenerating}
                    className="flex-1"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Generate Variation
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div>
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="text-lg">Saved Prayers</CardTitle>
                <CardDescription>Your recent prayers</CardDescription>
              </CardHeader>
              <CardContent>
                {savedPrayers.length === 0 ? (
                  <div className="text-center py-8">
                    <Heart className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm text-gray-500">No saved prayers yet</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {savedPrayers.map((prayer, index) => (
                      <div
                        key={index}
                        className="p-3 bg-gray-50 dark:bg-gray-800 rounded border cursor-pointer hover:border-indigo-300 transition-colors"
                        onClick={() => setGeneratedPrayer(prayer)}
                      >
                        <h4 className="font-semibold text-sm mb-1">{prayer.title}</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                          {prayer.theme}
                        </p>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">
                            {PRAYER_TYPES.find(t => t.value === prayer.type)?.label.split(' ')[0]}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {new Date(prayer.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Alert className="mt-8 bg-amber-50 dark:bg-amber-900/20 border-amber-300">
          <Heart className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
            <p className="font-semibold mb-1">💡 Tips for Great Prayers:</p>
            <ul className="space-y-1 ml-4 text-xs">
              <li>• Be specific about the theme and context</li>
              <li>• Reference relevant Scripture when appropriate</li>
              <li>• AI-generated prayers are starting points - edit as needed</li>
              <li>• Pray authentically from your heart</li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}