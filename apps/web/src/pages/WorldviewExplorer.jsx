
import React, { useState, useEffect, useRef } from "react";
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { LARRY_SYSTEM_PROMPT } from '@/ai/personas';
import { formatUserInputBlock } from '@/lib/aiPrompt';
import { denominationPromptBlock } from '@/lib/denominations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Globe,
  Crown,
  Sparkles,
  BookOpen,
  Scale,
  MessagesSquare,
  Loader2,
  Search,
  AlertTriangle,
  Compass,
  Cross,
  FileText,
  GitCompare,
  Save,
  StickyNote
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { usePremiumAccess } from "@/components/hooks/usePremiumAccess";
import { WORLDVIEW_COUNT } from "@/lib/appStats";

const BELIEF_SYSTEMS = [
  // Major World Religions (6)
  { id: 'islam', name: 'Islam', category: 'world_religion', icon: '☪️', description: 'Monotheistic Abrahamic faith, Quran-based' },
  { id: 'judaism', name: 'Judaism', category: 'world_religion', icon: '✡️', description: 'Covenant faith of Israel, Torah-centered' },
  { id: 'buddhism', name: 'Buddhism', category: 'world_religion', icon: '☸️', description: 'Four Noble Truths, Eightfold Path' },
  { id: 'hinduism', name: 'Hinduism', category: 'world_religion', icon: '🕉️', description: 'Dharmic tradition, karma and moksha' },
  { id: 'sikhism', name: 'Sikhism', category: 'world_religion', icon: '☬', description: 'Monotheistic Indian faith, Guru Granth Sahib' },
  { id: 'jainism', name: 'Jainism', category: 'world_religion', icon: '☸️', description: 'Non-violence (ahimsa) and asceticism' },
  
  // East Asian Religions & Philosophies (6)
  { id: 'shinto', name: 'Shinto', category: 'east_asian', icon: '⛩️', description: 'Japanese indigenous kami worship' },
  { id: 'taoism', name: 'Taoism (Daoism)', category: 'east_asian', icon: '☯️', description: 'The Way, wu wei, harmony with nature' },
  { id: 'confucianism', name: 'Confucianism', category: 'east_asian', icon: '📜', description: 'Ethical philosophy, filial piety, social harmony' },
  { id: 'falun_gong', name: 'Falun Gong (Falun Dafa)', category: 'east_asian', icon: '卍', description: 'Chinese qigong and meditation practice' },
  { id: 'tenrikyo', name: 'Tenrikyo', category: 'east_asian', icon: '🌸', description: 'Japanese new religion, joyous life' },
  { id: 'cao_dai', name: 'Cao Dai', category: 'east_asian', icon: '👁️', description: 'Vietnamese syncretic, Divine Eye' },
  
  // Ancient & Classical Religions (8)
  { id: 'zoroastrianism', name: 'Zoroastrianism', category: 'ancient_religion', icon: '🔥', description: 'Ancient Persian, fire temples, dualism' },
  { id: 'greek_mythology', name: 'Greek Gods & Mythology', category: 'ancient_religion', icon: '⚡', description: 'Olympian pantheon, Zeus and gods' },
  { id: 'roman_mythology', name: 'Roman Gods & Mythology', category: 'ancient_religion', icon: '🏛️', description: 'Roman pantheon, Jupiter and gods' },
  { id: 'norse_mythology', name: 'Norse/Nordic Religion', category: 'ancient_religion', icon: '⚔️', description: 'Viking gods, Odin, Thor, Valhalla' },
  { id: 'egyptian_mythology', name: 'Egyptian Religion', category: 'ancient_religion', icon: '𓂀', description: 'Ra, Osiris, Book of the Dead' },
  { id: 'manichaeism', name: 'Manichaeism', category: 'ancient_religion', icon: '⚖️', description: 'Ancient dualistic, light vs darkness' },
  { id: 'mithraism', name: 'Mithraism', category: 'ancient_religion', icon: '🐂', description: 'Roman mystery religion, bull sacrifice' },
  { id: 'zalmoxianism', name: 'Zalmoxianism', category: 'ancient_religion', icon: '⚔️', description: 'Ancient Dacian immortality cult' },
  
  // Middle Eastern Minority Faiths (4)
  { id: 'bahai', name: "Baha'i Faith", category: 'middle_eastern', icon: '⭐', description: 'Universal religion, unity of faiths' },
  { id: 'druze', name: 'Druze', category: 'middle_eastern', icon: '✨', description: 'Esoteric monotheistic, reincarnation' },
  { id: 'yazidism', name: 'Yazidism', category: 'middle_eastern', icon: '☀️', description: 'Kurdish monotheistic, Peacock Angel' },
  { id: 'mandaeism', name: 'Mandaeism', category: 'middle_eastern', icon: '💧', description: 'Gnostic, baptizing, John the Baptist' },
  
  // Modern Pagan & Reconstructionist (7)
  { id: 'wicca', name: 'Wicca/Modern Witchcraft', category: 'modern_pagan', icon: '🔮', description: 'Contemporary pagan, God/Goddess worship' },
  { id: 'druidry', name: 'Druidry (Neo-Druidism)', category: 'modern_pagan', icon: '🌳', description: 'Celtic spiritual revival, nature reverence' },
  { id: 'paganism', name: 'Neo-Paganism (General)', category: 'modern_pagan', icon: '🌙', description: 'Various polytheistic earth-centered paths' },
  { id: 'kemeticism', name: 'Kemeticism', category: 'modern_pagan', icon: '𓁹', description: 'Modern Egyptian reconstruction, ma\'at' },
  { id: 'hellenism', name: 'Hellenism', category: 'modern_pagan', icon: '🏺', description: 'Greek polytheism revival, Olympians' },
  { id: 'asatru', name: 'Ásatrú', category: 'modern_pagan', icon: '🔨', description: 'Norse/Germanic heathenry, runes' },
  { id: 'rodnovery', name: 'Slavic Native Faith (Rodnovery)', category: 'modern_pagan', icon: '⚡', description: 'Slavic paganism, Perun and Veles' },
  
  // African Diaspora Religions (5)
  { id: 'candomble', name: 'Candomblé', category: 'african_diaspora', icon: '🥁', description: 'Afro-Brazilian, Orishas worship' },
  { id: 'umbanda', name: 'Umbanda', category: 'african_diaspora', icon: '🕯️', description: 'Afro-Brazilian syncretic, spirits & mediums' },
  { id: 'santeria', name: 'Santería (Lucumí)', category: 'african_diaspora', icon: '🪘', description: 'Afro-Cuban Yoruba, Catholic saint syncretism' },
  { id: 'vodou', name: 'Vodou (Haitian)', category: 'african_diaspora', icon: '🐍', description: 'Haitian Vodou, Lwa spirits' },
  { id: 'rastafari', name: 'Rastafarianism', category: 'african_diaspora', icon: '🦁', description: 'Jamaican, Haile Selassie as messiah' },
  
  // African Traditional Religions (4)
  { id: 'ifa', name: 'Ifá (Yoruba)', category: 'african_traditional', icon: '🌴', description: 'Yoruba divination, Orunmila wisdom' },
  { id: 'akan', name: 'Akan Religion', category: 'african_traditional', icon: '🌍', description: 'Ghanaian, Nyame supreme being' },
  { id: 'dinka', name: 'Dinka Religion', category: 'african_traditional', icon: '🐄', description: 'South Sudan, Nhialic creator god' },
  { id: 'maasai', name: 'Maasai Religion', category: 'african_traditional', icon: '🦒', description: 'East African, Enkai god, cattle sacred' },
  
  // Indigenous American Religions (6)
  { id: 'native_american_church', name: 'Native American Church', category: 'indigenous_american', icon: '🦅', description: 'Peyotism, sacred medicine' },
  { id: 'hopi', name: 'Hopi Religion', category: 'indigenous_american', icon: '🌞', description: 'Southwestern U.S., kachina spirits' },
  { id: 'lakota', name: 'Lakota Spirituality', category: 'indigenous_american', icon: '🪬', description: 'Sioux, Wakan Tanka, vision quests' },
  { id: 'maya', name: 'Maya Religion', category: 'indigenous_american', icon: '🌽', description: 'Mesoamerican, calendar cosmology' },
  { id: 'aztec', name: 'Aztec Religion (Mexica)', category: 'indigenous_american', icon: '🌞', description: 'Huitzilopochtli, human sacrifice' },
  { id: 'inca', name: 'Inca Religion', category: 'indigenous_american', icon: '⛰️', description: 'Andean, Inti sun god, ancestor worship' },
  
  // Central Asian & Shamanic (3)
  { id: 'shamanism', name: 'Shamanism', category: 'central_asian', icon: '🌌', description: 'Spirit world mediators, ecstatic journeys' },
  { id: 'bon', name: 'Bon', category: 'central_asian', icon: '🔱', description: 'Pre-Buddhist Tibetan, tantric practices' },
  { id: 'tengriism', name: 'Tengriism', category: 'central_asian', icon: '🐎', description: 'Turkic-Mongolic sky god worship' },
  
  // Modern Spiritual Movements (6)
  { id: 'scientology', name: 'Scientology', category: 'modern_movement', icon: '🛸', description: 'Dianetics, Thetans, L. Ron Hubbard' },
  { id: 'eckankar', name: 'Eckankar', category: 'modern_movement', icon: '💫', description: 'Soul travel, spiritual exercises' },
  { id: 'theosophy', name: 'Theosophy', category: 'modern_movement', icon: '🔯', description: 'Esoteric wisdom, Blavatsky teachings' },
  { id: 'spiritualism', name: 'Spiritualism', category: 'modern_movement', icon: '👻', description: '19th-century mediums and séances' },
  { id: 'cargo_cults', name: 'Cargo Cults', category: 'modern_movement', icon: '✈️', description: 'Melanesian spiritual movements' },
  { id: 'unitarian_universalism', name: 'Unitarian Universalism', category: 'modern_movement', icon: '🌈', description: 'Liberal religious pluralism' },
  
  // New Age & Alternative (1)
  { id: 'new_age', name: 'New Age Movement', category: 'new_age', icon: '🌟', description: 'Spiritual eclecticism, crystals, chakras' },
  
  // Philosophical Worldviews (3)
  { id: 'atheism', name: 'Atheism/Secular Humanism', category: 'philosophy', icon: '🔬', description: 'Naturalistic worldview, no God' },
  { id: 'agnosticism', name: 'Agnosticism', category: 'philosophy', icon: '❓', description: 'Skepticism about divine knowledge' },
  { id: 'deism', name: 'Deism', category: 'philosophy', icon: '⚙️', description: 'Clockmaker God, no intervention' }
];

// Keep the shared marketing count (used by the homepage) in sync with the real
// list — warn in dev if someone adds/removes a belief system without updating
// src/lib/appStats.js.
if (import.meta.env?.DEV && BELIEF_SYSTEMS.length !== WORLDVIEW_COUNT) {
  console.error(`[appStats] WORLDVIEW_COUNT (${WORLDVIEW_COUNT}) does not match BELIEF_SYSTEMS.length (${BELIEF_SYSTEMS.length}). Please update src/lib/appStats.js to reflect the current number of belief systems.`);
  throw new Error('WORLDVIEW_COUNT mismatch');
}

const analysisSchema = {
  type: "object",
  properties: {
    core_beliefs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          belief: { type: "string" },
          explanation: { type: "string" }
        }
      }
    },
    why_they_believe: {
      type: "object",
      properties: {
        philosophical_reasons: { type: "array", items: { type: "string" } },
        cultural_reasons: { type: "array", items: { type: "string" } },
        experiential_reasons: { type: "array", items: { type: "string" } }
      }
    },
    christian_comparison: {
      type: "object",
      properties: {
        similarities: { type: "array", items: { type: "string" } },
        key_differences: { type: "array", items: { type: "string" } },
        common_ground: { type: "string" }
      }
    },
    historical_influence: {
      type: "object",
      properties: {
        on_christianity: { type: "string" },
        from_christianity: { type: "string" },
        cultural_exchange: { type: "string" }
      }
    },
    biblical_perspective: {
      type: "object",
      properties: {
        relevant_scriptures: {
          type: "array",
          items: {
            type: "object",
            properties: {
              reference: { type: "string" },
              relevance: { type: "string" }
            }
          }
        },
        theological_response: { type: "string" }
      }
    },
    apologetics: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          christian_response: { type: "string" },
          scripture_support: { type: "string" }
        }
      }
    },
    engagement_tips: {
      type: "array",
      items: { type: "string" }
    }
  }
};

export default function WorldviewExplorer() {
  // User comes from the shared AuthContext — no per-page api.auth.me() call.
  const { user, isLoadingAuth } = useAuth();
  const { isPremium, loading: accessLoading } = usePremiumAccess();
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customBelief, setCustomBelief] = useState("");
  const [selectedCategory] = useState('all');
  const [systemSummaries, setSystemSummaries] = useState({});
  const [isLoadingSummary, setIsLoadingSummary] = useState({});
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [compareSystemA, setCompareSystemA] = useState(null);
  const [compareSystemB, setCompareSystemB] = useState(null);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [isComparing, setIsComparing] = useState(false);
  const [userNotes, setUserNotes] = useState({});
  const [currentNote, setCurrentNote] = useState('');
  const [showNotesDialog, setShowNotesDialog] = useState(false);

  // Anchor for the analysis panel. The belief-system grid is very long (59
  // cards), so when a card deep in the list is analyzed the result paints far
  // below the fold and looks like "nothing happened" / "it appeared on a
  // different card". Scroll the panel into view as soon as analysis starts.
  const analysisAnchorRef = useRef(null);

  useEffect(() => {
    loadUserNotes();
  }, []);

  useEffect(() => {
    if (isAnalyzing || analysis || analysisError) {
      analysisAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isAnalyzing, analysis, analysisError]);

  useEffect(() => {
    if (showNotesDialog && selectedSystem) {
      setCurrentNote(userNotes[selectedSystem] || '');
    }
  }, [showNotesDialog, selectedSystem, userNotes]);

  const loadUserNotes = () => {
    try {
      const saved = localStorage.getItem('worldview_notes');
      if (saved) {
        setUserNotes(JSON.parse(saved));
      }
    } catch (error) {
      console.error("Failed to load notes");
      setUserNotes({});
    }
  };

  const saveNote = (systemName, note) => {
    const updated = { ...userNotes, [systemName]: note };
    setUserNotes(updated);
    try {
      localStorage.setItem('worldview_notes', JSON.stringify(updated));
      toast.success('Note saved!');
    } catch (error) {
      toast.error("Failed to save note");
    }
  };

  const generateQuickSummary = async (systemName) => {
    if (systemSummaries[systemName] || isLoadingSummary[systemName]) return;
    
    setIsLoadingSummary(prev => ({ ...prev, [systemName]: true }));

    try {
      const prompt = `Provide a 2-3 sentence summary of ${systemName}:
1. Core belief (one sentence)
2. Key distinction from Christianity (one sentence)

Be concise, accurate, and respectful.`;

      const summary = await api.integrations.Core.InvokeLLM({ system_prompt: LARRY_SYSTEM_PROMPT, prompt, feature: 'worldview' });
      
      setSystemSummaries(prev => ({ ...prev, [systemName]: summary }));
    } catch (error) {
      console.error('Error generating summary:', error);
    } finally {
      setIsLoadingSummary(prev => ({ ...prev, [systemName]: false }));
    }
  };

  const compareBeliefSystems = async () => {
    if (!compareSystemA || !compareSystemB) {
      toast.error('Please select two belief systems');
      return;
    }
    if (compareSystemA === compareSystemB) {
      toast.error('Please select two different systems');
      return;
    }

    setIsComparing(true);

    try {
      const denomination = user?.denomination || "Non-Denominational";
      
      const prompt = `Compare ${compareSystemA} and ${compareSystemB} from the Christian perspective of the tradition described below.

${denominationPromptBlock(denomination)}

Provide analysis covering:

1. SIMILARITIES: What both share
2. DIFFERENCES: How they differ (aspect, system A view, system B view)
3. CHRISTIAN EVALUATION: How Christianity relates to each
4. HISTORICAL RELATIONSHIP: Interactions between them
5. EVANGELISM STRATEGY: How to witness to followers of each

Be objective, fair, theologically sound.`;

      const comparison = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        feature: 'worldview',
        response_json_schema: {
          type: "object",
          properties: {
            similarities: { type: "array", items: { type: "string" } },
            differences: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  aspect: { type: "string" },
                  system_a: { type: "string" },
                  system_b: { type: "string" }
                }
              }
            },
            christian_evaluation: { type: "string" },
            historical_relationship: { type: "string" },
            evangelism_strategy: {
              type: "object",
              properties: {
                approach_to_a: { type: "string" },
                approach_to_b: { type: "string" },
                common_bridges: { type: "array", items: { type: "string" } }
              }
            }
          }
        },
        // Multi-section comparison — give it enough budget to finish the JSON.
        max_tokens: 6000,
      });

      setComparisonResult(comparison);
      toast.success('Comparison complete!');
    } catch (error) {
      console.error('Error comparing:', error);
      toast.error('Comparison failed');
    } finally {
      setIsComparing(false);
    }
  };

  const analyzeBeliefSystem = async (systemId, systemName) => {
    setIsAnalyzing(true);
    setSelectedSystem(systemName);
    setAnalysis(null);
    setAnalysisError(null);

    try {
      const denomination = user?.denomination || "Non-Denominational";
      
      const prompt = `Analyze the belief system named below from a Christian perspective for ministers and apologists.

${formatUserInputBlock('Belief system', systemName)}

${denominationPromptBlock(denomination)}

Cover:
1. Core beliefs (5-8)
2. Why they believe (philosophical, cultural, experiential)
3. Christian comparison (similarities, differences, common ground)
4. Historical influence (on/from Christianity)
5. Biblical perspective (scriptures, theological response from the tradition described above)
6. Apologetics (5-7 Q&A)
7. Engagement tips (5-8 practical)

Be respectful, accurate, pastoral.`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        feature: 'worldview',
        response_json_schema: analysisSchema,
        // This is a deep 7-section analysis; the default 1500-token budget
        // truncates it mid-JSON (which then fails to parse and surfaces as
        // "Failed to generate analysis"). Give it room to complete.
        max_tokens: 8000,
      });

      setAnalysis(response);
      toast.success(`Analysis complete!`);
    } catch (error) {
      console.error('Error details:', error);
      // Record the failure in state so the UI can show a real error panel.
      // Previously the catch only fired a toast and left both `analysis` and
      // `isAnalyzing` empty/false — so the page rendered nothing and looked
      // like the click was simply ignored.
      setAnalysisError(error?.data?.message || error?.message || 'Something went wrong while generating this analysis. Please try again. If the issue persists, please report it with the error details in the console.');
      toast.error("Failed to generate analysis");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeCustomBelief = async () => {
    if (!customBelief.trim()) {
      toast.error("Please enter a belief system");
      return;
    }
    analyzeBeliefSystem('custom', customBelief);
  };

  const filteredSystems = BELIEF_SYSTEMS.filter(system => {
    const matchesSearch = system.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         system.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || system.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedSystems = filteredSystems.reduce((acc, system) => {
    if (!acc[system.category]) {
      acc[system.category] = [];
    }
    acc[system.category].push(system);
    return acc;
  }, {});

  const categoryLabels = {
    world_religion: '🌍 Major World Religions',
    east_asian: '🏯 East Asian Religions',
    ancient_religion: '🏛️ Ancient & Classical',
    middle_eastern: '⭐ Middle Eastern',
    modern_pagan: '🌙 Modern Pagan',
    african_diaspora: '🥁 African Diaspora',
    african_traditional: '🌍 African Traditional',
    indigenous_american: '🦅 Indigenous American',
    central_asian: '🌌 Central Asian',
    modern_movement: '🛸 Modern Movements',
    new_age: '🌟 New Age',
    philosophy: '🔬 Philosophy'
  };

  const categoryOrder = [
    'world_religion', 'east_asian', 'ancient_religion', 'middle_eastern',
    'modern_pagan', 'african_diaspora', 'african_traditional', 
    'indigenous_american', 'central_asian', 'modern_movement', 'new_age', 'philosophy'
  ];

  if (isLoadingAuth || accessLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <Globe className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h2 className="text-2xl font-bold mb-2">Sign In Required</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Study {BELIEF_SYSTEMS.length} belief systems through a Christian lens
              </p>
              <Button onClick={() => api.auth.redirectToLogin()}>Sign In</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!isPremium) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-purple-300">
            <CardContent className="pt-6 text-center py-12">
              <Crown className="w-16 h-16 mx-auto mb-4 text-purple-600" />
              <h2 className="text-2xl font-bold mb-2">Premium Feature</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                Study {BELIEF_SYSTEMS.length} world religions through a biblical lens
              </p>
              <Link to={createPageUrl('Pricing')}>
                <Button className="bg-purple-600 hover:bg-purple-700" size="lg">
                  <Crown className="w-5 h-5 mr-2" />
                  Upgrade
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe className="w-8 h-8 text-indigo-600" />
            Worldview Explorer
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Study {BELIEF_SYSTEMS.length} belief systems through a biblical, Christian lens
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Badge className="bg-purple-600">
              <Crown className="w-3 h-3 mr-1" />
              Premium
            </Badge>
            <Badge variant="outline">
              {BELIEF_SYSTEMS.length} Systems
            </Badge>
          </div>
        </div>

        {/* Purpose Notice */}
        <Alert className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-blue-300">
          <Cross className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <p className="font-semibold mb-1">✝️ Purpose</p>
            <p className="text-sm">
              For evangelism, apologetics, and interfaith dialogue from a {user?.denomination || 'Christian'} perspective.
            </p>
          </AlertDescription>
        </Alert>

        {/* Compare Feature Button */}
        <Card className="mb-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GitCompare className="w-8 h-8 text-purple-600" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                    Compare Belief Systems
                  </h3>
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    Side-by-side analysis of any two worldviews
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => setShowCompareDialog(true)}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <GitCompare className="w-4 h-4 mr-2" />
                Compare
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder={`Search ${BELIEF_SYSTEMS.length} belief systems...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Custom Belief Input */}
        <Card className="mb-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-green-600" />
              Analyze Any Belief System
            </CardTitle>
            <CardDescription>
              Enter any religion not listed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., Mormonism, Gnosticism..."
                value={customBelief}
                onChange={(e) => setCustomBelief(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && analyzeCustomBelief()}
              />
              <Button
                onClick={analyzeCustomBelief}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Analyze'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Belief Systems Grid */}
        <div className="space-y-6">
          {categoryOrder.map(category => {
            const systems = groupedSystems[category];
            if (!systems || systems.length === 0) return null;

            return (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{categoryLabels[category]}</span>
                    <Badge variant="secondary">{systems.length} system{systems.length === 1 ? '' : 's'}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {systems.map((system) => (
                      <Card
                        key={system.id}
                        className="hover:shadow-lg transition-all border-2 hover:border-indigo-400"
                        onMouseEnter={() => generateQuickSummary(system.name)}
                      >
                        <CardContent className="pt-4 pb-4">
                          <div className="text-center">
                            <div className="text-3xl mb-2">{system.icon}</div>
                            <h3 className="font-semibold text-sm mb-1">{system.name}</h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                              {system.description}
                            </p>
                            
                            {isLoadingSummary[system.name] ? (
                              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                                <Loader2 className="w-3 h-3 animate-spin mx-auto text-blue-600" />
                              </div>
                            ) : systemSummaries[system.name] ? (
                              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-left text-blue-800 dark:text-blue-200">
                                {systemSummaries[system.name]}
                              </div>
                            ) : null}

                            {userNotes[system.name] && (
                              <Badge variant="outline" className="mt-2 text-xs">
                                <StickyNote className="w-3 h-3 mr-1" />
                                Note
                              </Badge>
                            )}
                            
                            <Button
                              size="sm"
                              className="w-full mt-3"
                              onClick={() => analyzeBeliefSystem(system.id, system.name)}
                            >
                              Full Analysis
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Scroll target for the analysis panel (see analysisAnchorRef effect). */}
        <div ref={analysisAnchorRef} />

        {/* Analysis Loading */}
        {isAnalyzing && (
          <Card className="mt-8">
            <CardContent className="pt-6 text-center py-12">
              <Loader2 className="w-12 h-12 animate-spin mx-auto text-indigo-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                Analyzing {selectedSystem}...
              </h3>
              <p className="text-gray-600 dark:text-gray-400">This may take 30-60 seconds</p>
            </CardContent>
          </Card>
        )}

        {/* Analysis Error */}
        {analysisError && !isAnalyzing && (
          <Card className="mt-8 border-red-200 dark:border-red-900">
            <CardContent className="pt-6 text-center py-12">
              <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Analysis didn't complete</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">{analysisError}</p>
              {selectedSystem && (
                <Button
                  variant="outline"
                  onClick={() => analyzeBeliefSystem('retry', selectedSystem)}
                >
                  Try Again
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Enhanced Analysis Results */}
        {analysis && !isAnalyzing && (
          <div className="mt-8 space-y-6">
            <Card className="border-t-4 border-indigo-600">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl mb-2">
                      {selectedSystem}
                    </CardTitle>
                    <CardDescription>
                      From a {user?.denomination || 'Christian'} perspective
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNotesDialog(true)}
                    >
                      <StickyNote className="w-4 h-4 mr-2" />
                      {userNotes[selectedSystem] ? 'Edit Note' : 'Add Note'}
                    </Button>
                    <Button variant="outline" onClick={() => setAnalysis(null)}>
                      Close
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {userNotes[selectedSystem] && (
              <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <StickyNote className="w-4 h-4 text-yellow-600" />
                    My Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
                    {userNotes[selectedSystem]}
                  </p>
                </CardContent>
              </Card>
            )}

            <Tabs defaultValue="beliefs" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3 md:grid-cols-6">
                <TabsTrigger value="beliefs">Core Beliefs</TabsTrigger>
                <TabsTrigger value="why">Why Believe</TabsTrigger>
                <TabsTrigger value="comparison">Comparison</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="biblical">Biblical View</TabsTrigger>
                <TabsTrigger value="apologetics">Apologetics</TabsTrigger>
              </TabsList>

              <TabsContent value="beliefs">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                      What {selectedSystem} Teaches
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analysis.core_beliefs?.map((belief, index) => (
                        <div key={index} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border-l-4 border-blue-500">
                          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                            {index + 1}. {belief.belief}
                          </h4>
                          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                            {belief.explanation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="why">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Compass className="w-5 h-5 text-purple-600" />
                      Why Followers Believe in {selectedSystem}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-3 flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        Philosophical Reasons
                      </h4>
                      <ul className="space-y-2">
                        {analysis.why_they_believe?.philosophical_reasons?.map((reason, index) => (
                          <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                            <span className="text-purple-600 mt-1">•</span>
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        Cultural/Historical Reasons
                      </h4>
                      <ul className="space-y-2">
                        {analysis.why_they_believe?.cultural_reasons?.map((reason, index) => (
                          <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                            <span className="text-blue-600 mt-1">•</span>
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Experiential Reasons
                      </h4>
                      <ul className="space-y-2">
                        {analysis.why_they_believe?.experiential_reasons?.map((reason, index) => (
                          <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
                            <span className="text-green-600 mt-1">•</span>
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="comparison">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Scale className="w-5 h-5 text-indigo-600" />
                      Christian Comparison
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-l-4 border-green-500">
                      <h4 className="font-semibold text-green-900 dark:text-green-100 mb-3">
                        ✅ Similarities & Common Ground
                      </h4>
                      <ul className="space-y-2">
                        {analysis.christian_comparison?.similarities?.map((sim, index) => (
                          <li key={index} className="text-sm text-green-800 dark:text-green-200 flex items-start gap-2">
                            <span>✓</span>
                            {sim}
                          </li>
                        ))}
                      </ul>
                      {analysis.christian_comparison?.common_ground && (
                        <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/40 rounded">
                          <p className="text-sm text-green-900 dark:text-green-100">
                            <strong>Starting Point for Dialogue:</strong> {analysis.christian_comparison.common_ground}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border-l-4 border-red-500">
                      <h4 className="font-semibold text-red-900 dark:text-red-100 mb-3">
                        ⚠️ Key Theological Differences
                      </h4>
                      <ul className="space-y-2">
                        {analysis.christian_comparison?.key_differences?.map((diff, index) => (
                          <li key={index} className="text-sm text-red-800 dark:text-red-200 flex items-start gap-2">
                            <span>✗</span>
                            {diff}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history">
                <Card>
                  <CardHeader>
                    <CardTitle>Historical Context & Influence</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {analysis.historical_influence?.on_christianity && (
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                          📚 Influence on Christianity
                        </h4>
                        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-line">
                          {analysis.historical_influence.on_christianity}
                        </p>
                      </div>
                    )}

                    {analysis.historical_influence?.from_christianity && (
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                          ✝️ Christian Influence on {selectedSystem}
                        </h4>
                        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-line">
                          {analysis.historical_influence.from_christianity}
                        </p>
                      </div>
                    )}

                    {analysis.historical_influence?.cultural_exchange && (
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                          🌍 Cultural Exchange
                        </h4>
                        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-line">
                          {analysis.historical_influence.cultural_exchange}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="biblical">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-indigo-600" />
                      Biblical Response
                    </CardTitle>
                    <CardDescription>
                      From a {user?.denomination || 'Christian'} theological perspective
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className="font-semibold mb-3">📖 Relevant Scriptures</h4>
                      <div className="space-y-3">
                        {analysis.biblical_perspective?.relevant_scriptures?.map((scripture, index) => (
                          <div key={index} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border-l-2 border-blue-500">
                            <Badge variant="outline" className="mb-2">{scripture.reference}</Badge>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {scripture.relevance}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                      <h4 className="font-semibold text-indigo-900 dark:text-indigo-100 mb-3">
                        ✝️ Theological Response
                      </h4>
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                        {analysis.biblical_perspective?.theological_response}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="apologetics">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessagesSquare className="w-5 h-5 text-purple-600" />
                      Apologetics & Dialogue
                    </CardTitle>
                    <CardDescription>
                      Common questions and biblical responses
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="space-y-3">
                      {analysis.apologetics?.map((item, index) => (
                        <AccordionItem key={index} value={`q-${index}`} className="border rounded-lg px-4">
                          <AccordionTrigger className="hover:no-underline">
                            <span className="text-left font-medium">{item.question}</span>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-3 pt-4">
                            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded">
                              <h5 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2">
                                Christian Response:
                              </h5>
                              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                {item.christian_response}
                              </p>
                            </div>
                            <div>
                              <h5 className="text-sm font-semibold mb-1">Scripture Support:</h5>
                              <p className="text-sm text-blue-700 dark:text-blue-300">
                                {item.scripture_support}
                              </p>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>

                    <div className="mt-6 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border-amber-300 border">
                      <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Tips for Respectful Engagement
                      </h4>
                      <ul className="space-y-2">
                        {analysis.engagement_tips?.map((tip, index) => (
                          <li key={index} className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                            <span className="text-amber-600 mt-0.5">💡</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
              <CardContent className="pt-6">
                <div className="flex gap-3 justify-center flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAnalysis(null);
                      setSelectedSystem(null);
                    }}
                  >
                    Analyze Another
                  </Button>
                  <Link to={createPageUrl('SermonBuilder')}>
                    <Button>
                      <FileText className="w-4 h-4 mr-2" />
                      Sermon
                    </Button>
                  </Link>
                  <Link to={createPageUrl('BibleStudy')}>
                    <Button variant="outline">
                      <BookOpen className="w-4 h-4 mr-2" />
                      Study
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Disclaimer */}
        <Alert className="mt-8 bg-gray-100 dark:bg-gray-800 border-gray-300">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription className="text-gray-700 dark:text-gray-300 text-sm">
            <p className="font-semibold mb-2">⚠️ Disclaimers:</p>
            <ul className="space-y-1 ml-4 text-xs">
              <li>• Objective analysis for educational/ministry purposes</li>
              <li>• AI-generated - verify before teaching</li>
              <li>• Goal: understanding and effective witness</li>
              <li>• Approach with love and truth (1 Peter 3:15-16)</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Dialogs */}
        <Dialog open={showCompareDialog} onOpenChange={setShowCompareDialog}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GitCompare className="w-6 h-6 text-purple-600" />
                Compare Belief Systems
              </DialogTitle>
              <DialogDescription>
                Side-by-side analysis
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {!comparisonResult ? (
                <>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">First System</label>
                      <Select value={compareSystemA || ''} onValueChange={setCompareSystemA}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-96">
                          {BELIEF_SYSTEMS.map(sys => (
                            <SelectItem key={sys.id} value={sys.name}>
                              {sys.icon} {sys.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Second System</label>
                      <Select value={compareSystemB || ''} onValueChange={setCompareSystemB}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-96">
                          {BELIEF_SYSTEMS.map(sys => (
                            <SelectItem key={sys.id} value={sys.name}>
                              {sys.icon} {sys.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    onClick={compareBeliefSystems}
                    disabled={isComparing}
                    className="w-full"
                    size="lg"
                  >
                    {isComparing ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Comparing...
                      </>
                    ) : (
                      <>
                        <GitCompare className="w-5 h-5 mr-2" />
                        Compare
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold">
                      {compareSystemA} vs {compareSystemB}
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setComparisonResult(null)}
                    >
                      New
                    </Button>
                  </div>

                  {comparisonResult.similarities?.length > 0 && (
                    <Card className="bg-green-50 dark:bg-green-900/20 border-green-300">
                      <CardHeader>
                        <CardTitle className="text-lg">✅ Similarities</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {comparisonResult.similarities?.map((sim, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm">
                              <span className="text-green-600">•</span>
                              {sim}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {comparisonResult.differences?.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">⚖️ Differences</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {comparisonResult.differences?.map((diff, index) => (
                            <div key={index} className="grid md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded">
                              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                                <h5 className="font-semibold text-xs text-blue-600 mb-2">{compareSystemA}</h5>
                                <p className="text-sm">{diff.system_a}</p>
                              </div>
                              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded">
                                <h5 className="font-semibold text-xs text-purple-600 mb-2">{compareSystemB}</h5>
                                <p className="text-sm">{diff.system_b}</p>
                              </div>
                              {diff.aspect && (
                                <div className="md:col-span-2 pt-2 border-t border-gray-200">
                                  <p className="text-xs font-semibold">
                                    Comparing: {diff.aspect}
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {comparisonResult.christian_evaluation && (
                    <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-300">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Cross className="w-5 h-5" />
                          Christian View
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm whitespace-pre-line">{comparisonResult.christian_evaluation}</p>
                      </CardContent>
                    </Card>
                  )}

                  {comparisonResult.historical_relationship && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">📚 History</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm whitespace-pre-line">{comparisonResult.historical_relationship}</p>
                      </CardContent>
                    </Card>
                  )}

                  {comparisonResult.evangelism_strategy && (
                    <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-300">
                      <CardHeader>
                        <CardTitle className="text-lg">🎯 Evangelism</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {comparisonResult.evangelism_strategy?.approach_to_a && (
                          <div>
                            <h5 className="font-semibold text-sm mb-2">For {compareSystemA}:</h5>
                            <p className="text-sm">{comparisonResult.evangelism_strategy.approach_to_a}</p>
                          </div>
                        )}
                        {comparisonResult.evangelism_strategy?.approach_to_b && (
                          <div>
                            <h5 className="font-semibold text-sm mb-2">For {compareSystemB}:</h5>
                            <p className="text-sm">{comparisonResult.evangelism_strategy.approach_to_b}</p>
                          </div>
                        )}
                        {comparisonResult.evangelism_strategy?.common_bridges?.length > 0 && (
                          <div>
                            <h5 className="font-semibold text-sm mb-2">Gospel Bridges:</h5>
                            <ul className="space-y-1">
                              {comparisonResult.evangelism_strategy.common_bridges.map((bridge, i) => (
                                <li key={i} className="text-sm flex items-start gap-2">
                                  <span>→</span>
                                  {bridge}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Notes Dialog */}
        <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <StickyNote className="w-5 h-5 text-yellow-600" />
                Notes on {selectedSystem}
              </DialogTitle>
              <DialogDescription>
                Save your thoughts and insights
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <Textarea
                placeholder="Enter notes..."
                value={currentNote}
                onChange={(e) => setCurrentNote(e.target.value)}
                rows={8}
                className="w-full"
              />

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    saveNote(selectedSystem, currentNote);
                    setShowNotesDialog(false);
                  }}
                  disabled={!currentNote.trim()}
                  className="flex-1"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowNotesDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
