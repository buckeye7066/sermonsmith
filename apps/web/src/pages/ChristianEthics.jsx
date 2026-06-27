import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { logError } from '@/lib/logError';
import { LARRY_SYSTEM_PROMPT } from '@/ai/personas';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Scale, BookOpen, Loader2, Heart, Brain, MessageCircle, Mic, Send, History, HelpCircle, ExternalLink, FileText, AlertTriangle, Compass, Save } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const ETHICAL_CATEGORIES = [
  {
    category: 'Life Ethics',
    icon: '🌱',
    topics: [
      { id: 'abortion', name: 'Abortion' },
      { id: 'euthanasia', name: 'Euthanasia & Assisted Suicide' },
      { id: 'capital_punishment', name: 'Capital Punishment' },
      { id: 'suicide', name: 'Suicide Prevention' },
      { id: 'genetic_modification', name: 'Genetic Modification' },
      { id: 'ivf', name: 'IVF & Reproductive Tech' }
    ]
  },
  {
    category: 'Sexual Ethics',
    icon: '💍',
    topics: [
      { id: 'marriage', name: 'Marriage & Covenant' },
      { id: 'sexual_purity', name: 'Sexual Purity' },
      { id: 'pornography', name: 'Pornography' },
      { id: 'same_sex', name: 'Same-Sex Attraction' },
      { id: 'gender', name: 'Gender & Identity' },
      { id: 'cohabitation', name: 'Cohabitation' }
    ]
  },
  {
    category: 'Bioethics',
    icon: '🧬',
    topics: [
      { id: 'stem_cell', name: 'Stem Cell Research' },
      { id: 'cloning', name: 'Human Cloning' },
      { id: 'artificial_intelligence', name: 'Artificial Intelligence' },
      { id: 'organ_donation', name: 'Organ Donation' },
      { id: 'vaccination', name: 'Vaccination Ethics' }
    ]
  },
  {
    category: 'Social Justice',
    icon: '⚖️',
    topics: [
      { id: 'racism', name: 'Racism & Reconciliation' },
      { id: 'poverty', name: 'Poverty & Economic Justice' },
      { id: 'immigration', name: 'Immigration & Refugees' },
      { id: 'human_trafficking', name: 'Human Trafficking' },
      { id: 'oppression', name: 'Oppression & Human Rights' }
    ]
  },
  {
    category: 'Science & Origins',
    icon: '🔬',
    topics: [
      { id: 'evolution', name: 'Evolution & Creation' },
      { id: 'age_of_earth', name: 'Age of the Earth' },
      { id: 'science_faith', name: 'Science & Faith Integration' }
    ]
  },
  {
    category: 'War & Peace',
    icon: '🕊️',
    topics: [
      { id: 'just_war', name: 'Just War Theory' },
      { id: 'pacifism', name: 'Pacifism & Nonviolence' },
      { id: 'self_defense', name: 'Self-Defense' }
    ]
  },
  {
    category: 'Environmental Ethics',
    icon: '🌍',
    topics: [
      { id: 'creation_care', name: 'Creation Care' },
      { id: 'animal_rights', name: 'Animal Welfare' },
      { id: 'sustainability', name: 'Sustainability' }
    ]
  },
  {
    category: 'Technology Ethics',
    icon: '💻',
    topics: [
      { id: 'social_media', name: 'Social Media Ethics' },
      { id: 'privacy', name: 'Privacy & Surveillance' },
      { id: 'addiction', name: 'Technology Addiction' }
    ]
  },
  {
    category: 'Work & Economics',
    icon: '💼',
    topics: [
      { id: 'capitalism', name: 'Capitalism & Free Markets' },
      { id: 'socialism', name: 'Socialism & Redistribution' },
      { id: 'work_ethic', name: 'Work Ethic & Calling' },
      { id: 'tithing', name: 'Tithing & Generosity' }
    ]
  },
  {
    category: 'Family Ethics',
    icon: '👨‍👩‍👧‍👦',
    topics: [
      { id: 'parenting', name: 'Biblical Parenting' },
      { id: 'divorce', name: 'Divorce & Remarriage' },
      { id: 'adoption', name: 'Adoption & Foster Care' }
    ]
  }
];

// -----------------------------------------------------------------------------
// Per-tab schemas
//
// The original implementation asked the LLM to fill ONE giant schema with
// ~8 deeply-nested sections in a single call. Backend tokens are capped at
// 1500 for free users (see services/api/src/routes/ai.js → FREE_MAX_TOKENS),
// which routinely truncated the JSON before sections like
// `historical_perspective`, `different_views`, `modern_application`, and
// `pastoral_guidance` were emitted — leaving History/Views/Today/Pastoral as
// empty card shells in the UI.
//
// Fix: split into one small "intro + biblical" schema for the initial call
// (Biblical is the default open tab) and one focused schema per remaining
// tab, fetched on demand when the user clicks that tab. Each focused call
// fits comfortably within the token cap.
// -----------------------------------------------------------------------------

const introSchema = {
  type: "object",
  properties: {
    topic_title: { type: "string" },
    ethical_category: { type: "string" },
    definition: { type: "string" },
    biblical_foundation: {
      type: "object",
      properties: {
        key_scriptures: {
          type: "array",
          items: {
            type: "object",
            properties: {
              reference: { type: "string" },
              text: { type: "string" },
              application: { type: "string" }
            }
          }
        },
        theological_principles: { type: "array", items: { type: "string" } }
      }
    }
  }
};

const historySchema = {
  type: "object",
  properties: {
    early_church: { type: "string" },
    church_fathers: { type: "string" },
    reformation_era: { type: "string" },
    modern_church: { type: "string" }
  }
};

const viewsSchema = {
  type: "object",
  properties: {
    different_views: {
      type: "array",
      items: {
        type: "object",
        properties: {
          perspective: { type: "string" },
          reasoning: { type: "string" },
          biblical_support: { type: "string" }
        }
      }
    }
  }
};

const todaySchema = {
  type: "object",
  properties: {
    modern_application: { type: "string" }
  }
};

const pastoralSchema = {
  type: "object",
  properties: {
    pastoral_guidance: { type: "string" },
    common_questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          answer: { type: "string" }
        }
      }
    },
    further_reading: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          author: { type: "string" },
          description: { type: "string" }
        }
      }
    }
  }
};

const DENOMINATIONS = [
  "Catholic",
  "Reformed / Calvinist",
  "Lutheran",
  "Methodist / Wesleyan",
  "Baptist",
  "Pentecostal / Charismatic",
  "Anglican / Episcopal",
  "Eastern Orthodox",
  "Non-Denominational Evangelical",
];

const comparisonSchema = {
  type: "object",
  properties: {
    topic_title: { type: "string" },
    perspectives: {
      type: "array",
      items: {
        type: "object",
        properties: {
          denomination: { type: "string" },
          position_summary: { type: "string" },
          key_scriptures: { type: "array", items: { type: "string" } },
          reasoning: { type: "string" },
          pastoral_tone: { type: "string" },
          notable_figures: { type: "string" }
        }
      }
    },
    common_ground: { type: "string" },
    key_differences: { type: "string" },
    pastoral_advice: { type: "string" }
  }
};

export default function ChristianEthics() {
  // Centralised auth — no local api.auth.me() fetch.
  const { user } = useAuth();
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState(null);
  const [isThinking, setIsThinking] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [mode, setMode] = useState("single"); // "single" or "compare"
  const [selectedDenominations, setSelectedDenominations] = useState(["Catholic", "Reformed / Calvinist", "Baptist"]);
  const [comparisonResult, setComparisonResult] = useState(null);
  // Per-tab loading flags so the UI can show a spinner while a focused tab
  // call is in flight. Keys: 'history' | 'views' | 'today' | 'pastoral'.
  const [tabLoading, setTabLoading] = useState({});
  const [activeTab, setActiveTab] = useState("biblical");

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    const history = localStorage.getItem('ethics_history');
    if (history) {
      setSearchHistory(JSON.parse(history));
    }
  };

  const saveToHistory = (question, topic) => {
    const newHistory = [
      { question, topic, timestamp: new Date().toISOString() },
      ...searchHistory.slice(0, 9)
    ];
    setSearchHistory(newHistory);
    localStorage.setItem('ethics_history', JSON.stringify(newHistory));
  };

  const askLarry = async (topicQuestion) => {
    if (!topicQuestion.trim()) {
      toast.error("Please enter a question or topic");
      return;
    }

    setIsThinking(true);
    setResponse(null);
    setActiveTab("biblical");
    setTabLoading({});

    try {
      const prompt = `You are Larry, a wise, pastoral AI ethics mentor helping Christians think through moral and ethical issues from a biblical perspective.

A Christian has asked you: "${topicQuestion}"

Provide ONLY the following sections for this first response:

1. topic_title — a short, descriptive headline for the topic
2. ethical_category — pick one short label, e.g. "Sexual Ethics", "Life Ethics", "Bioethics", "Social Justice", "War & Peace", etc.
3. definition — 2-3 sentence definition explaining what the issue is and why it matters today
4. biblical_foundation:
   - key_scriptures: 5-8 passages, each with the reference, the FULL verse text, and a 1-2 sentence application
   - theological_principles: 4-6 short bullet-style principles drawn from Scripture

TONE: Pastoral, wise, conversational. Use Scripture liberally. Be compassionate yet clear.
"Speaking the truth in love" (Ephesians 4:15).`;

      const larryResponse = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        response_json_schema: introSchema
      });

      // Lightweight trace so we can see in the console why a tab might be empty.
      console.log("[ChristianEthics] intro response", {
        question: topicQuestion,
        topic: larryResponse?.topic_title,
        hasBiblical: !!larryResponse?.biblical_foundation?.key_scriptures?.length,
      });

      setResponse(larryResponse);
      saveToHistory(topicQuestion, larryResponse.topic_title || topicQuestion);
      toast.success("Larry has responded!");
    } catch (error) {
      toast.error(logError('Larry could not respond', error));
    } finally {
      setIsThinking(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Per-tab lazy fetchers
  //
  // Each click on History / Views / Today / Pastoral kicks off a small, focused
  // LLM call that fills ONLY that tab's section. Results are merged back into
  // `response` so the existing render logic just works. Cached after first
  // load so re-clicking a tab does not re-spend AI quota.
  // ---------------------------------------------------------------------------

  const fetchTabSection = async (tabKey) => {
    if (!response?.topic_title) return;
    if (tabLoading[tabKey]) return; // already in flight
    // Already loaded? Skip.
    if (tabKey === "history" && response.historical_perspective) return;
    if (tabKey === "views" && Array.isArray(response.different_views)) return;
    if (tabKey === "today" && response.modern_application) return;
    if (tabKey === "pastoral" && response.pastoral_guidance) return;

    const denomination = user?.denomination || "Non-Denominational";
    const topic = response.topic_title;
    const userQuestion = question || `the ethical topic "${topic}"`;

    const promptsByTab = {
      history: {
        schema: historySchema,
        prompt: `You are Larry. The user is exploring the ethical topic: "${topic}".

Write the CHURCH HISTORY perspective on this issue. Return ONLY these fields, each a 2-4 sentence paragraph:
- early_church: how the early Christian community (pre-Nicene, 1st-3rd centuries) treated this issue
- church_fathers: views of major Church Fathers (Augustine, Chrysostom, the Cappadocians, etc.) where relevant
- reformation_era: how Reformers (Luther, Calvin, etc.) and Counter-Reformation thought addressed it
- modern_church: how 20th/21st-century churches across traditions have engaged this issue

Be historically accurate. If a period has little to say, briefly acknowledge that rather than inventing claims.`,
      },
      views: {
        schema: viewsSchema,
        prompt: `You are Larry. The user is exploring the ethical topic: "${topic}".

List 3-5 DIFFERENT orthodox Christian PERSPECTIVES on this issue. Return a "different_views" array; each item is:
- perspective: short label/name for the view
- reasoning: 2-4 sentence summary of the view's reasoning
- biblical_support: the main Scripture passages cited (references + brief gloss)

Be fair to each tradition. If orthodox Christianity broadly speaks with one voice on this issue, return 1-2 entries that note this.`,
      },
      today: {
        schema: todaySchema,
        prompt: `You are Larry. The user asked: "${userQuestion}".
Topic: "${topic}".

Write a MODERN APPLICATION section: 4-8 paragraphs of practical, pastoral guidance for living this out today.
Cover: personal choices, family/relationships, church community, cultural engagement, and common pitfalls.
Use specific, concrete examples. Speak warmly and directly to the reader.`,
      },
      pastoral: {
        schema: pastoralSchema,
        prompt: `You are Larry. The user asked: "${userQuestion}".
Topic: "${topic}".

Write PASTORAL COUNSEL from a ${denomination} perspective. Return:
- pastoral_guidance: 3-6 paragraphs of compassionate, biblically grounded counsel. Acknowledge pain, complexity, and grace.
- common_questions: 3-5 Q&A pairs addressing the most common doubts or follow-up questions
- further_reading: 3-5 resources (title, author, 1-sentence description) for deeper study

"Speaking the truth in love" (Ephesians 4:15).`,
      },
    };

    const cfg = promptsByTab[tabKey];
    if (!cfg) return;

    setTabLoading((prev) => ({ ...prev, [tabKey]: true }));

    try {
      const sectionResp = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt: cfg.prompt,
        response_json_schema: cfg.schema,
      });

      console.log(`[ChristianEthics] ${tabKey} response`, sectionResp);

      setResponse((prev) => {
        if (!prev) return prev;
        if (tabKey === "history") {
          return { ...prev, historical_perspective: sectionResp || {} };
        }
        if (tabKey === "views") {
          return { ...prev, different_views: sectionResp?.different_views || [] };
        }
        if (tabKey === "today") {
          return { ...prev, modern_application: sectionResp?.modern_application || "" };
        }
        if (tabKey === "pastoral") {
          return {
            ...prev,
            pastoral_guidance: sectionResp?.pastoral_guidance || "",
            common_questions: sectionResp?.common_questions || [],
            further_reading: sectionResp?.further_reading || [],
          };
        }
        return prev;
      });
    } catch (err) {
      toast.error(logError(`Couldn't load the ${tabKey} section`, err, { tabKey }));
    } finally {
      setTabLoading((prev) => ({ ...prev, [tabKey]: false }));
    }
  };

  const handleTabChange = (value) => {
    setActiveTab(value);
    if (value === "biblical") return;
    fetchTabSection(value);
  };

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error("Voice input not supported in this browser");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
      toast.info("Listening... Speak your question");
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setQuestion(transcript);
      toast.success("Got it! Click 'Ask Larry' to continue");
    };

    recognition.onerror = () => {
      toast.error("Voice input failed");
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const toggleDenomination = (denom) => {
    setSelectedDenominations(prev =>
      prev.includes(denom)
        ? prev.filter(d => d !== denom)
        : prev.length < 4 ? [...prev, denom] : prev
    );
  };

  const compareAcrossDenominations = async (topicQuestion) => {
    if (!topicQuestion.trim()) {
      toast.error("Please enter a question or topic");
      return;
    }
    if (selectedDenominations.length < 2) {
      toast.error("Select at least 2 denominations to compare");
      return;
    }

    setIsThinking(true);
    setComparisonResult(null);
    setResponse(null);

    try {
      const denomList = selectedDenominations.join(", ");
      const prompt = `Compare how these Christian denominations approach the following ethical topic:

Denominations: ${denomList}

Topic/Question: "${topicQuestion}"

For EACH denomination, provide:
1. Their official or mainstream position summary
2. Key Scripture passages they cite (just references)
3. Their theological reasoning
4. Their pastoral tone and approach
5. Notable theologians or church figures who shaped this view

Then provide:
- Common ground shared across all listed denominations
- Key differences that distinguish their approaches
- Pastoral advice for navigating these differences in a mixed-denomination context

Be fair and charitable to each tradition. Present each view from within that tradition's own logic, not as an outsider critique.`;

      const result = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        response_json_schema: comparisonSchema
      });

      setComparisonResult(result);
      saveToHistory(topicQuestion, `Compare: ${result.topic_title}`);
      toast.success("Comparison complete!");
    } catch (error) {
      toast.error(logError('Comparison failed', error));
    } finally {
      setIsThinking(false);
    }
  };

  const saveAnalysis = async (data) => {
    try {
      await api.entities.EthicsAnalysis.create({
        data: {
          question,
          mode,
          result: mode === 'compare' ? comparisonResult : response,
          denominations: mode === 'compare' ? selectedDenominations : [],
        }
      });
      toast.success("Analysis saved to your library!");
    } catch (error) {
      toast.error(logError('Failed to save analysis (are you logged in?)', error));
    }
  };

  const handleTopicClick = (topicName) => {
    setQuestion(`What does the Bible say about ${topicName.toLowerCase()}?`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Scale className="w-8 h-8 text-indigo-600" />
            Christian Ethics Explorer
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Ask Larry about moral and ethical issues from a biblical perspective
          </p>
        </div>

        <Card className="mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="text-5xl">🧑‍🏫</div>
              <div>
                <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-2">
                  Meet Larry - Your AI Ethics Mentor
                </h3>
                <p className="text-blue-800 dark:text-blue-200 text-sm leading-relaxed">
                  Larry is your friendly guide through complex ethical questions. He's grounded in Scripture, 
                  familiar with church history, and speaks with wisdom and compassion.
                </p>
                <p className="text-blue-700 dark:text-blue-300 text-xs mt-2 italic">
                  "Always be prepared to give an answer... with gentleness and respect." - 1 Peter 3:15
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-purple-600" />
              Ask Larry About Ethics
            </CardTitle>
            <CardDescription>
              Type your question, use voice input, or select a topic below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Mode toggle */}
              <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit">
                <Button
                  variant={mode === "single" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => { setMode("single"); setComparisonResult(null); }}
                >
                  <MessageCircle className="w-4 h-4 mr-1" />
                  Ask Larry
                </Button>
                <Button
                  variant={mode === "compare" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => { setMode("compare"); setResponse(null); }}
                >
                  <Compass className="w-4 h-4 mr-1" />
                  Compare Denominations
                </Button>
              </div>

              {/* Denomination selector (compare mode) */}
              {mode === "compare" && (
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="text-sm font-medium mb-2 text-purple-900 dark:text-purple-200">
                    Select 2–4 denominations to compare:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {DENOMINATIONS.map((denom) => (
                      <Badge
                        key={denom}
                        variant={selectedDenominations.includes(denom) ? "default" : "outline"}
                        className={`cursor-pointer transition-colors ${
                          selectedDenominations.includes(denom)
                            ? 'bg-purple-600 hover:bg-purple-700'
                            : 'hover:bg-purple-100 dark:hover:bg-purple-900'
                        }`}
                        onClick={() => toggleDenomination(denom)}
                      >
                        {denom}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    placeholder={mode === "compare"
                      ? "e.g., What is the role of women in church leadership?"
                      : "e.g., What does the Bible say about abortion?"
                    }
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (mode === 'compare' ? compareAcrossDenominations(question) : askLarry(question))}
                    className="pr-12"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                    onClick={handleVoiceInput}
                    disabled={isListening}
                  >
                    <Mic className={`w-4 h-4 ${isListening ? 'text-red-500 animate-pulse' : ''}`} />
                  </Button>
                </div>
                <Button
                  onClick={() => mode === 'compare' ? compareAcrossDenominations(question) : askLarry(question)}
                  disabled={isThinking || !question.trim()}
                  size="lg"
                >
                  {isThinking ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : mode === 'compare' ? (
                    <>
                      <Compass className="w-4 h-4 mr-2" />
                      Compare
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Ask Larry
                    </>
                  )}
                </Button>
              </div>

              {searchHistory.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                    <History className="w-3 h-3" />
                    Recent Questions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {searchHistory.slice(0, 5).map((item, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                        onClick={() => setQuestion(item.question)}
                      >
                        {item.question.substring(0, 40)}...
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {!response && !isThinking && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Brain className="w-5 h-5" />
                Browse Topics by Category
              </h2>
            </div>

            {ETHICAL_CATEGORIES.map((cat) => (
              <Card key={cat.category}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">{cat.icon}</span>
                    {cat.category}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {cat.topics.map((topic) => (
                      <Button
                        key={topic.id}
                        variant="outline"
                        className="h-auto py-3 justify-start hover:border-indigo-500"
                        onClick={() => handleTopicClick(topic.name)}
                      >
                        <HelpCircle className="w-4 h-4 mr-2" />
                        <span className="text-sm">{topic.name}</span>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {isThinking && (
          <Card>
            <CardContent className="pt-6 text-center py-16">
              <div className="text-6xl mb-4">🧑‍🏫</div>
              <Loader2 className="w-12 h-12 animate-spin mx-auto text-indigo-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                Larry is thinking deeply...
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Searching Scripture and church history
              </p>
            </CardContent>
          </Card>
        )}

        {/* Comparison Results */}
        {comparisonResult && !isThinking && (
          <div className="space-y-6">
            <Card className="border-t-4 border-purple-600">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="text-5xl">⚖️</div>
                  <div className="flex-1">
                    <CardTitle className="text-2xl mb-2">
                      {comparisonResult.topic_title}
                    </CardTitle>
                    <div className="flex gap-2 flex-wrap mt-2">
                      {selectedDenominations.map((d) => (
                        <Badge key={d} variant="secondary">{d}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={saveAnalysis}>
                      <Save className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                    <Button variant="outline" onClick={() => setComparisonResult(null)}>
                      New Comparison
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {comparisonResult.perspectives?.map((perspective, index) => (
              <Card key={index} className="border-l-4" style={{ borderLeftColor: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b'][index % 4] }}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="text-2xl">{['⛪', '✝️', '🕊️', '📖'][index % 4]}</span>
                    {perspective.denomination}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Position</h4>
                    <p className="text-sm">{perspective.position_summary}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Theological Reasoning</h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{perspective.reasoning}</p>
                  </div>
                  {perspective.key_scriptures?.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Key Scriptures</h4>
                      <div className="flex flex-wrap gap-2">
                        {perspective.key_scriptures.map((ref, i) => (
                          <Badge key={i} variant="outline">{ref}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Pastoral Tone</h4>
                    <p className="text-sm italic text-gray-600 dark:text-gray-400">{perspective.pastoral_tone}</p>
                  </div>
                  {perspective.notable_figures && (
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Notable Figures</h4>
                      <p className="text-xs text-gray-500">{perspective.notable_figures}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
              <CardContent className="pt-6 space-y-4">
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-green-600" />
                    Common Ground
                  </h4>
                  <p className="text-sm">{comparisonResult.common_ground}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-orange-600" />
                    Key Differences
                  </h4>
                  <p className="text-sm">{comparisonResult.key_differences}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-pink-600" />
                    Pastoral Advice
                  </h4>
                  <p className="text-sm">{comparisonResult.pastoral_advice}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {response && !isThinking && (
          <div className="space-y-6">
            <Card className="border-t-4 border-indigo-600">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="text-5xl">🧑‍🏫</div>
                  <div className="flex-1">
                    <CardTitle className="text-2xl mb-2">
                      {response.topic_title}
                    </CardTitle>
                    <Badge className="mb-2">{response.ethical_category}</Badge>
                    <CardDescription className="text-base">
                      {response.definition}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={saveAnalysis}>
                      <Save className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                    <Button variant="outline" onClick={() => setResponse(null)}>
                      Ask Another
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="grid w-full grid-cols-3 md:grid-cols-5">
                <TabsTrigger value="biblical">Biblical</TabsTrigger>
                <TabsTrigger value="history">
                  History {tabLoading.history ? <Loader2 className="w-3 h-3 ml-1 animate-spin inline" /> : null}
                </TabsTrigger>
                <TabsTrigger value="views">
                  Views {tabLoading.views ? <Loader2 className="w-3 h-3 ml-1 animate-spin inline" /> : null}
                </TabsTrigger>
                <TabsTrigger value="today">
                  Today {tabLoading.today ? <Loader2 className="w-3 h-3 ml-1 animate-spin inline" /> : null}
                </TabsTrigger>
                <TabsTrigger value="pastoral">
                  Pastoral {tabLoading.pastoral ? <Loader2 className="w-3 h-3 ml-1 animate-spin inline" /> : null}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="biblical" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                      Biblical Foundation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className="font-semibold mb-3">📖 Key Scriptures</h4>
                      <div className="space-y-4">
                        {response.biblical_foundation?.key_scriptures?.map((scripture, index) => (
                          <div key={index} className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500">
                            <Badge variant="outline" className="mb-2">{scripture.reference}</Badge>
                            <p className="text-sm italic text-gray-700 dark:text-gray-300 mb-2">
                              "{scripture.text}"
                            </p>
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                              <strong>Application:</strong> {scripture.application}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-3">🎯 Theological Principles</h4>
                      <ul className="space-y-2">
                        {response.biblical_foundation?.theological_principles?.map((principle, index) => (
                          <li key={index} className="flex items-start gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded">
                            <span className="text-indigo-600 font-bold">{index + 1}.</span>
                            <span className="text-sm">{principle}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Church History on This Issue</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {tabLoading.history && !response.historical_perspective && (
                      <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 py-8 justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                        Larry is reviewing the church's history on this topic…
                      </div>
                    )}
                    {!tabLoading.history && !response.historical_perspective && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 py-6 text-center">
                        <Button variant="outline" size="sm" onClick={() => fetchTabSection("history")}>
                          Load church history
                        </Button>
                      </div>
                    )}
                    {response.historical_perspective?.early_church && (
                      <div>
                        <h4 className="font-semibold mb-2">⛪ Early Church</h4>
                        <p className="text-sm whitespace-pre-line">{response.historical_perspective.early_church}</p>
                      </div>
                    )}
                    {response.historical_perspective?.church_fathers && (
                      <div>
                        <h4 className="font-semibold mb-2">📚 Church Fathers</h4>
                        <p className="text-sm whitespace-pre-line">{response.historical_perspective.church_fathers}</p>
                      </div>
                    )}
                    {response.historical_perspective?.reformation_era && (
                      <div>
                        <h4 className="font-semibold mb-2">⚡ Reformation</h4>
                        <p className="text-sm whitespace-pre-line">{response.historical_perspective.reformation_era}</p>
                      </div>
                    )}
                    {response.historical_perspective?.modern_church && (
                      <div>
                        <h4 className="font-semibold mb-2">🌍 Modern Church</h4>
                        <p className="text-sm whitespace-pre-line">{response.historical_perspective.modern_church}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="views" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Scale className="w-5 h-5" />
                      Different Christian Views
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {tabLoading.views && !response.different_views && (
                      <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 py-8 justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                        Larry is mapping different Christian perspectives…
                      </div>
                    )}
                    {!tabLoading.views && !response.different_views && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 py-6 text-center">
                        <Button variant="outline" size="sm" onClick={() => fetchTabSection("views")}>
                          Load Christian perspectives
                        </Button>
                      </div>
                    )}
                    {response.different_views && response.different_views.length > 0 && (
                      <div className="space-y-4">
                        {response.different_views.map((view, index) => (
                          <div key={index} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <h4 className="font-semibold mb-2">{view.perspective}</h4>
                            <p className="text-sm mb-2">{view.reasoning}</p>
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              <strong>Biblical:</strong> {view.biblical_support}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    {response.different_views && response.different_views.length === 0 && !tabLoading.views && (
                      <p className="text-gray-600">Orthodox Christianity speaks with one voice on this.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="today" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Living This Out Today</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {tabLoading.today && !response.modern_application && (
                      <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 py-8 justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                        Larry is drafting practical application for today…
                      </div>
                    )}
                    {!tabLoading.today && !response.modern_application && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 py-6 text-center">
                        <Button variant="outline" size="sm" onClick={() => fetchTabSection("today")}>
                          Load modern application
                        </Button>
                      </div>
                    )}
                    {response.modern_application && (
                      <p className="text-sm leading-relaxed whitespace-pre-line">
                        {response.modern_application}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="pastoral" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Heart className="w-5 h-5 text-pink-600" />
                      Pastoral Counsel
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {tabLoading.pastoral && !response.pastoral_guidance && (
                      <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 py-8 justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                        Larry is preparing pastoral counsel…
                      </div>
                    )}
                    {!tabLoading.pastoral && !response.pastoral_guidance && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 py-6 text-center">
                        <Button variant="outline" size="sm" onClick={() => fetchTabSection("pastoral")}>
                          Load pastoral counsel
                        </Button>
                      </div>
                    )}
                    {response.pastoral_guidance && (
                      <div className="bg-pink-50 dark:bg-pink-900/20 p-4 rounded-lg border-l-4 border-pink-500">
                        <p className="text-sm whitespace-pre-line">{response.pastoral_guidance}</p>
                      </div>
                    )}

                    {response.common_questions?.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3">❓ Common Questions</h4>
                        <Accordion type="single" collapsible>
                          {response.common_questions.map((qa, index) => (
                            <AccordionItem key={index} value={`qa-${index}`}>
                              <AccordionTrigger>{qa.question}</AccordionTrigger>
                              <AccordionContent>
                                <p className="text-sm">{qa.answer}</p>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </div>
                    )}

                    {response.further_reading?.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <ExternalLink className="w-4 h-4" />
                          Further Study
                        </h4>
                        <div className="space-y-3">
                          {response.further_reading.map((resource, index) => (
                            <div key={index} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                              <h5 className="font-semibold text-sm">📚 {resource.title}</h5>
                              <p className="text-xs mt-1">{resource.author}</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                {resource.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 mt-6">
              <CardContent className="pt-6">
                <div className="flex gap-3 justify-center flex-wrap">
                  <Button variant="outline" onClick={() => setResponse(null)}>
                    Ask Another
                  </Button>
                  <Link to={createPageUrl('SermonBuilder')}>
                    <Button>
                      <FileText className="w-4 h-4 mr-2" />
                      Create Sermon
                    </Button>
                  </Link>
                  <Link to={createPageUrl('BibleStudy')}>
                    <Button variant="outline">
                      <BookOpen className="w-4 h-4 mr-2" />
                      Create Study
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Alert className="mt-8 bg-gray-100 dark:bg-gray-800">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription className="text-sm">
            <p className="font-semibold mb-2">📌 Important Notes:</p>
            <ul className="space-y-1 ml-4 text-xs">
              <li>• Larry provides biblical ethics rooted in Scripture</li>
              <li>• AI-generated - verify before major decisions</li>
              <li>• For education, not legal/medical advice</li>
              <li>• Truth in love (Ephesians 4:15)</li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}