import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, BookOpen, Brain, MessageSquare, Lightbulb, Save, X } from "lucide-react";
import { api } from '@/api/apiClient';
import { LARRY_SYSTEM_PROMPT } from '@/ai/personas';
import { toast } from "sonner";

export default function StudyToolsPanel({ open, onClose, verse, user }) {
  const [activeTab, setActiveTab] = useState("questions");
  const [isGenerating, setIsGenerating] = useState(false);
  const [studyContent, setStudyContent] = useState({
    questions: [],
    outline: null,
    connections: null,
    insights: null
  });
  
  const [noteContent, setNoteContent] = useState("");
  const [noteCategory, setNoteCategory] = useState("observation");
  const [noteTags, setNoteTags] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [lastVerse, setLastVerse] = useState(null);

  React.useEffect(() => {
    const verseKey = verse ? `${verse.book_name}:${verse.chapter}:${verse.verse}` : null;
    if (verseKey !== lastVerse) {
      setLastVerse(verseKey);
      setStudyContent({ questions: [], outline: null, connections: null, insights: null });
    }
  }, [verse]);

  const generateStudyQuestions = async () => {
    setIsGenerating(true);
    setActiveTab("questions");
    
    try {
      const denomination = user?.denomination || "Non-denominational";
      
      const prompt = `Generate 8-10 thought-provoking study questions for this Bible verse:

${verse.book_name} ${verse.chapter}:${verse.verse}
"${verse.text}"

Create questions that:
- Encourage personal reflection and application
- Explore historical and cultural context
- Connect to broader biblical themes
- Prompt deeper theological understanding
- Are appropriate for ${denomination} perspective
- Range from basic comprehension to advanced application

Mix question types: observation, interpretation, application, and reflection.`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  type: { type: "string" },
                  difficulty: { type: "string" }
                }
              }
            }
          }
        }
      });

      setStudyContent(prev => ({ ...prev, questions: response.questions || [] }));
      toast.success("Study questions generated!");
    } catch (error) {
      console.error("Error generating questions:", error);
      toast.error("Failed to generate study questions");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateStudyOutline = async () => {
    setIsGenerating(true);
    setActiveTab("outline");
    
    try {
      const denomination = user?.denomination || "Non-denominational";
      
      const prompt = `Create a comprehensive study outline for this verse:

${verse.book_name} ${verse.chapter}:${verse.verse}
"${verse.text}"

Denomination: ${denomination}

Include:
1. **Historical Context**: When, where, who, why was this written
2. **Literary Context**: What comes before and after
3. **Key Terms**: Important words and their meanings
4. **Theological Themes**: Main spiritual concepts
5. **Cross-References**: Related passages (3-5)
6. **Life Application**: Practical ways to apply this
7. **Discussion Points**: 3 key talking points for groups

Make it detailed but accessible, about 400-500 words total.`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            historical_context: { type: "string" },
            literary_context: { type: "string" },
            key_terms: { type: "array", items: { type: "string" } },
            theological_themes: { type: "array", items: { type: "string" } },
            cross_references: { type: "array", items: { type: "string" } },
            life_application: { type: "string" },
            discussion_points: { type: "array", items: { type: "string" } }
          }
        }
      });

      setStudyContent(prev => ({ ...prev, outline: response }));
      toast.success("Study outline created!");
    } catch (error) {
      console.error("Error generating outline:", error);
      toast.error("Failed to generate study outline");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateTheologicalConnections = async () => {
    setIsGenerating(true);
    setActiveTab("connections");
    
    try {
      const denomination = user?.denomination || "Non-denominational";
      
      const prompt = `Explore theological connections for this verse:

${verse.book_name} ${verse.chapter}:${verse.verse}
"${verse.text}"

Denomination: ${denomination}

Provide:
1. **Connection to Gospel**: How does this relate to Christ and salvation?
2. **Old Testament Echoes**: OT passages that prefigure or connect to this
3. **New Testament Parallels**: Related NT teachings
4. **Theological Traditions**: How different traditions interpret this
5. **Systematic Theology**: Which doctrines does this touch (salvation, sanctification, etc.)
6. **Practical Discipleship**: How does this shape Christian living?

Be scholarly yet accessible. About 400 words.`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            gospel_connection: { type: "string" },
            old_testament_echoes: { type: "array", items: { type: "string" } },
            new_testament_parallels: { type: "array", items: { type: "string" } },
            theological_traditions: { type: "string" },
            systematic_theology: { type: "array", items: { type: "string" } },
            practical_discipleship: { type: "string" }
          }
        }
      });

      setStudyContent(prev => ({ ...prev, connections: response }));
      toast.success("Theological connections revealed!");
    } catch (error) {
      console.error("Error generating connections:", error);
      toast.error("Failed to generate theological connections");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateInsights = async () => {
    setIsGenerating(true);
    setActiveTab("insights");
    
    try {
      const prompt = `Provide deep spiritual insights for this verse:

${verse.book_name} ${verse.chapter}:${verse.verse}
"${verse.text}"

Share:
1. **What the Original Readers Heard**: Cultural context and meaning
2. **What We Often Miss**: Hidden depths and overlooked details
3. **Life-Changing Truth**: The core transformative message
4. **Common Misinterpretations**: What people get wrong
5. **Personal Reflection**: A devotional thought
6. **Memorization Tip**: Why this verse is worth memorizing

Make it personal, practical, and profound. About 350 words.`;

      const response = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            original_meaning: { type: "string" },
            what_we_miss: { type: "string" },
            core_truth: { type: "string" },
            misinterpretations: { type: "string" },
            devotional: { type: "string" },
            memorization_tip: { type: "string" }
          }
        }
      });

      setStudyContent(prev => ({ ...prev, insights: response }));
      toast.success("Insights generated!");
    } catch (error) {
      console.error("Error generating insights:", error);
      toast.error("Failed to generate insights");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveStudyNote = async () => {
    if (!noteContent.trim()) {
      toast.error("Please enter note content");
      return;
    }

    setIsSavingNote(true);
    try {
      const tags = noteTags.split(',').map(t => t.trim()).filter(Boolean);
      
      await api.entities.StudyNote.create({
        user_id: user.id,
        content: noteContent,
        scripture_reference: `${verse.book_name} ${verse.chapter}:${verse.verse}`,
        category: noteCategory,
        tags: tags,
        title: `Note on ${verse.book_name} ${verse.chapter}:${verse.verse}`
      });

      toast.success("Study note saved!");
      setNoteContent("");
      setNoteTags("");
      setNoteCategory("observation");
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Failed to save note");
    } finally {
      setIsSavingNote(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            Bible Study Tools
          </DialogTitle>
        </DialogHeader>

        {verse && (
          <Alert className="bg-blue-50 border-blue-200">
            <AlertDescription>
              <div className="font-semibold text-blue-900">
                {verse.book_name} {verse.chapter}:{verse.verse}
              </div>
              <div className="text-sm text-blue-800 mt-1 italic">
                "{verse.text}"
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="questions">Questions</TabsTrigger>
            <TabsTrigger value="outline">Outline</TabsTrigger>
            <TabsTrigger value="connections">Theology</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
            <TabsTrigger value="notes">My Notes</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="questions" className="space-y-4">
              {!studyContent.questions.length ? (
                <div className="text-center py-12">
                  <MessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <Button onClick={generateStudyQuestions} disabled={isGenerating}>
                    {isGenerating ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                    ) : (
                      <><Brain className="w-4 h-4 mr-2" /> Generate Study Questions</>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {studyContent.questions.map((q, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-lg border">
                      <div className="flex items-start gap-3">
                        <Badge variant="outline" className="mt-1">{index + 1}</Badge>
                        <div className="flex-1">
                          <p className="font-medium">{q.question}</p>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">{q.type}</Badge>
                            <Badge variant="outline" className="text-xs">{q.difficulty}</Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" onClick={generateStudyQuestions} className="w-full">
                    Regenerate Questions
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="outline" className="space-y-4">
              {!studyContent.outline ? (
                <div className="text-center py-12">
                  <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <Button onClick={generateStudyOutline} disabled={isGenerating}>
                    {isGenerating ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                    ) : (
                      <><Brain className="w-4 h-4 mr-2" /> Generate Study Outline</>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-lg mb-2">📜 Historical Context</h3>
                    <p className="text-gray-700">{studyContent.outline.historical_context}</p>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">📖 Literary Context</h3>
                    <p className="text-gray-700">{studyContent.outline.literary_context}</p>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">🔑 Key Terms</h3>
                    <div className="flex flex-wrap gap-2">
                      {studyContent.outline.key_terms.map((term, i) => (
                        <Badge key={i} variant="secondary">{term}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">⛪ Theological Themes</h3>
                    <div className="flex flex-wrap gap-2">
                      {studyContent.outline.theological_themes.map((theme, i) => (
                        <Badge key={i} className="bg-purple-100 text-purple-800">{theme}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">🔗 Cross-References</h3>
                    <div className="flex flex-wrap gap-2">
                      {studyContent.outline.cross_references.map((ref, i) => (
                        <Badge key={i} variant="outline">{ref}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">✨ Life Application</h3>
                    <p className="text-gray-700">{studyContent.outline.life_application}</p>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">💬 Discussion Points</h3>
                    <ul className="space-y-2">
                      {studyContent.outline.discussion_points.map((point, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-indigo-600 font-bold">{i + 1}.</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="connections" className="space-y-4">
              {!studyContent.connections ? (
                <div className="text-center py-12">
                  <Lightbulb className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <Button onClick={generateTheologicalConnections} disabled={isGenerating}>
                    {isGenerating ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                    ) : (
                      <><Brain className="w-4 h-4 mr-2" /> Explore Theological Connections</>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border-l-4 border-green-500 rounded">
                    <h3 className="font-bold text-lg mb-2">✝️ Connection to Gospel</h3>
                    <p className="text-gray-700">{studyContent.connections.gospel_connection}</p>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">📜 Old Testament Echoes</h3>
                    <ul className="space-y-2">
                      {studyContent.connections.old_testament_echoes.map((echo, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-indigo-600">•</span>
                          <span>{echo}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">📖 New Testament Parallels</h3>
                    <ul className="space-y-2">
                      {studyContent.connections.new_testament_parallels.map((parallel, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-indigo-600">•</span>
                          <span>{parallel}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-4 bg-blue-50 rounded">
                    <h3 className="font-bold text-lg mb-2">🏛️ Theological Traditions</h3>
                    <p className="text-gray-700">{studyContent.connections.theological_traditions}</p>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">📚 Systematic Theology</h3>
                    <div className="flex flex-wrap gap-2">
                      {studyContent.connections.systematic_theology.map((doctrine, i) => (
                        <Badge key={i} className="bg-indigo-100 text-indigo-800">{doctrine}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 bg-purple-50 rounded">
                    <h3 className="font-bold text-lg mb-2">🚶 Practical Discipleship</h3>
                    <p className="text-gray-700">{studyContent.connections.practical_discipleship}</p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="insights" className="space-y-4">
              {!studyContent.insights ? (
                <div className="text-center py-12">
                  <Lightbulb className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <Button onClick={generateInsights} disabled={isGenerating}>
                    {isGenerating ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                    ) : (
                      <><Lightbulb className="w-4 h-4 mr-2" /> Generate Deep Insights</>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50 border-l-4 border-amber-500 rounded">
                    <h3 className="font-bold text-lg mb-2">🕰️ What the Original Readers Heard</h3>
                    <p className="text-gray-700">{studyContent.insights.original_meaning}</p>
                  </div>
                  <div className="p-4 bg-pink-50 rounded">
                    <h3 className="font-bold text-lg mb-2">🔍 What We Often Miss</h3>
                    <p className="text-gray-700">{studyContent.insights.what_we_miss}</p>
                  </div>
                  <div className="p-4 bg-green-50 border-l-4 border-green-500 rounded">
                    <h3 className="font-bold text-lg mb-2">💎 Life-Changing Truth</h3>
                    <p className="text-gray-700">{studyContent.insights.core_truth}</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded">
                    <h3 className="font-bold text-lg mb-2">⚠️ Common Misinterpretations</h3>
                    <p className="text-gray-700">{studyContent.insights.misinterpretations}</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded">
                    <h3 className="font-bold text-lg mb-2">🙏 Personal Reflection</h3>
                    <p className="text-gray-700 italic">{studyContent.insights.devotional}</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded">
                    <h3 className="font-bold text-lg mb-2">🧠 Memorization Tip</h3>
                    <p className="text-gray-700">{studyContent.insights.memorization_tip}</p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg border">
                <h3 className="font-semibold mb-3">Create Study Note</h3>
                <div className="space-y-3">
                  <Select value={noteCategory} onValueChange={setNoteCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Note Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="observation">📝 Observation</SelectItem>
                      <SelectItem value="interpretation">💡 Interpretation</SelectItem>
                      <SelectItem value="application">✨ Application</SelectItem>
                      <SelectItem value="prayer">🙏 Prayer</SelectItem>
                      <SelectItem value="question">❓ Question</SelectItem>
                      <SelectItem value="insight">🔍 Insight</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Textarea
                    placeholder="Write your study note..."
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    rows={5}
                  />
                  
                  <Input
                    placeholder="Tags (comma-separated)"
                    value={noteTags}
                    onChange={(e) => setNoteTags(e.target.value)}
                  />
                  
                  <Button onClick={saveStudyNote} disabled={isSavingNote} className="w-full">
                    {isSavingNote ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                    ) : (
                      <><Save className="w-4 h-4 mr-2" /> Save Study Note</>
                    )}
                  </Button>
                </div>
              </div>
              
              <Alert>
                <AlertDescription>
                  Your study notes are saved and can be viewed in the My Studies page.
                </AlertDescription>
              </Alert>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}