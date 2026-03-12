import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Scale, Sparkles, BookOpen, Loader2, Heart, Brain, MessageCircle, Mic, Send, History, HelpCircle, ExternalLink, FileText, AlertTriangle, Compass } from "lucide-react";
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

const ethicsSchema = {
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
    },
    historical_perspective: {
      type: "object",
      properties: {
        early_church: { type: "string" },
        church_fathers: { type: "string" },
        reformation_era: { type: "string" },
        modern_church: { type: "string" }
      }
    },
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
    },
    modern_application: { type: "string" },
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

export default function ChristianEthics() {
  const [user, setUser] = useState(null);
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState(null);
  const [isThinking, setIsThinking] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    loadUser();
    loadHistory();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await api.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.log("User not logged in");
    }
  };

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

    try {
      const denomination = user?.denomination || "Non-Denominational";
      
      const prompt = `You are Larry, a wise, pastoral AI ethics mentor helping Christians think through moral and ethical issues from a biblical perspective.

A Christian has asked you: "${topicQuestion}"

Provide a comprehensive, balanced response with these sections:

1. TOPIC & DEFINITION: Clear statement and why it matters today
2. BIBLICAL FOUNDATION: 5-8 Scripture passages with full text and application
3. HISTORICAL PERSPECTIVE: Early Church, Church Fathers, Reformation, Modern Church
4. DIFFERENT VIEWS: Orthodox Christian perspectives (if applicable)
5. MODERN APPLICATION: How to live this out today
6. PASTORAL GUIDANCE: Compassionate counsel from ${denomination} view
7. COMMON QUESTIONS: 3-5 Q&A addressing doubts
8. FURTHER READING: 3-5 resources for deeper study

TONE: Pastoral, wise, conversational. Use Scripture liberally. Acknowledge complexity but return to biblical truth. Be compassionate yet clear.

REMEMBER: "Speaking the truth in love" (Ephesians 4:15) - always both.`;

      const larryResponse = await api.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: ethicsSchema
      });

      setResponse(larryResponse);
      saveToHistory(topicQuestion, larryResponse.topic_title);
      toast.success("Larry has responded!");
    } catch (error) {
      console.error('Error asking Larry:', error);
      toast.error("Larry couldn't respond. Please try again.");
    } finally {
      setIsThinking(false);
    }
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
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    placeholder="e.g., What does the Bible say about abortion?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && askLarry(question)}
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
                  onClick={() => askLarry(question)}
                  disabled={isThinking || !question.trim()}
                  size="lg"
                >
                  {isThinking ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
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
                  <Button variant="outline" onClick={() => setResponse(null)}>
                    Ask Another
                  </Button>
                </div>
              </CardHeader>
            </Card>

            <Tabs defaultValue="biblical">
              <TabsList className="grid w-full grid-cols-3 md:grid-cols-5">
                <TabsTrigger value="biblical">Biblical</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="views">Views</TabsTrigger>
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="pastoral">Pastoral</TabsTrigger>
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
                    {response.different_views?.length > 0 ? (
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
                    ) : (
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
                    <p className="text-sm leading-relaxed whitespace-pre-line">
                      {response.modern_application}
                    </p>
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
                    <div className="bg-pink-50 dark:bg-pink-900/20 p-4 rounded-lg border-l-4 border-pink-500">
                      <p className="text-sm whitespace-pre-line">{response.pastoral_guidance}</p>
                    </div>

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