import React, { useState } from "react";
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { LARRY_SYSTEM_PROMPT } from '@/ai/personas';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { HelpCircle, Loader2, Brain, Play } from "lucide-react";
import { toast } from "sonner";



import QuizViewer from "../components/quiz/QuizViewer";

const QUIZ_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "An engaging title for this quiz" },
    questions: {
      type: "array",
      minItems: 5,
      maxItems: 15,
      items: {
        type: "object",
        properties: {
          question: { type: "string", description: "The quiz question" },
          options: {
            type: "array",
            items: { type: "string" },
            minItems: 4,
            maxItems: 4,
            description: "Four multiple choice options"
          },
          correct_answer: { type: "number", description: "Index of correct answer (0-3)" },
          explanation: { type: "string", description: "Brief explanation of the correct answer" },
          scripture_reference: { type: "string", description: "Relevant Bible verse reference" }
        },
        required: ["question", "options", "correct_answer", "explanation", "scripture_reference"]
      }
    }
  },
  required: ["title", "questions"]
};

export default function QuizBuilder() {
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [quizData, setQuizData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const handleGenerateQuiz = async () => {
    if (!user) {
        toast.error("Please log in to generate quizzes");
        return;
    }

    if (!topic.trim()) {
      toast.error("Please enter a topic for your quiz.");
      return;
    }

    setIsLoading(true);
    setQuizData(null);

    const denomination = user.denomination || 'Non-denominational';
    const prompt = `Generate a Bible quiz on the topic "${topic}" with ${difficulty} difficulty level. The questions and correct answers should reflect the theological perspective and biblical interpretation of the "${denomination}" tradition. Create 10 multiple choice questions with 4 options each. Each question should test knowledge of Bible facts, stories, characters, or teachings related to "${topic}". Include the correct answer index (0-3), a brief explanation, and a relevant scripture reference for each question.`;

    try {
      const result = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt: `IMPORTANT: NEVER invent or fabricate Bible verses. Only reference real, valid Scripture. If unsure, instruct the user to check their Bible.\n\n${prompt}`,
        response_json_schema: QUIZ_SCHEMA
      });

      setQuizData({
        ...result,
        topic: topic,
        difficulty: difficulty
      });

    } catch (error) {
      console.error("Error generating quiz:", error);
      toast.error("Failed to generate quiz. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveQuiz = async (quizDataToSave) => {
    if (!user) return;

    try {
      await api.entities.Quiz.create({
        user_id: user.id,
        title: quizDataToSave.title,
        topic: quizDataToSave.topic,
        difficulty: quizDataToSave.difficulty,
        questions: quizDataToSave.questions,
        time_limit: 600
      });
      toast.success("Quiz saved successfully!");
    } catch (error) {
      toast.error("Failed to save quiz.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto" data-print-full-width>
        <div className="mb-8" data-print-hidden={!!quizData || undefined}>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Brain className="w-8 h-8 text-purple-500" />
            Quiz Builder
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Create interactive Bible quizzes and tests with AI assistance.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" data-print-layout>
          <div className="lg:col-span-1" data-print-hidden>
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-purple-500" />
                  Quiz Setup
                </CardTitle>
                <CardDescription>
                  Configure your Bible quiz.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="topic">Quiz Topic</label>
                  <Input
                    id="topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g., Genesis, Jesus' Miracles, Paul's Letters"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="difficulty">Difficulty Level</label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger id="difficulty">
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleGenerateQuiz} disabled={isLoading} className="w-full bg-purple-600 hover:bg-purple-700">
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
                  Generate Quiz
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="shadow-lg h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="w-5 h-5 text-green-500" />
                  Your Quiz
                </CardTitle>
                <CardDescription>
                  Review and save your generated quiz.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading && (
                  <div className="text-center py-12">
                    <Loader2 className="w-12 h-12 mx-auto animate-spin text-purple-500" />
                    <p className="mt-4 text-lg font-medium text-gray-700 dark:text-gray-300">Creating your quiz...</p>
                    <p className="text-sm text-gray-500">This may take up to 30 seconds.</p>
                  </div>
                )}
                {quizData && (
                  <QuizViewer quizData={quizData} onSave={handleSaveQuiz} user={user} />
                )}
                {!isLoading && !quizData && (
                  <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <Brain className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600" />
                    <p className="mt-4 text-lg font-medium text-gray-500 dark:text-gray-400">Ready to create your quiz.</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">Enter a topic and click generate to begin.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
