
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, ChevronRight, Save, Edit2 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "react-hot-toast"; // Assuming react-hot-toast for toast notifications

export default function QuizViewer({ quizData, onSave, user }) {
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(quizData.title);

  const devEmails = [
    'buckeye7066@gmail.com',
    'anyawhite@rocketmail.com',
    'whiterobert1201@icloud.com',
    'tishka1201@icloud.com'
  ];
  
  const devPhones = ['9319981779', '+19319981779', '931-998-1779', '(931) 998-1779'];
  
  const emailMatch = user?.email && devEmails.includes(user.email.toLowerCase());
  
  // Normalize user.phone and devPhones for robust comparison
  const normalizePhoneNumber = (phone) => phone ? phone.replace(/[\s\-\(\)\+]/g, '') : '';

  const phoneMatch = user?.phone && devPhones.some(devPhone => {
    const normalizedUserPhone = normalizePhoneNumber(user.phone);
    const normalizedDevPhone = normalizePhoneNumber(devPhone);
    return normalizedUserPhone.includes(normalizedDevPhone);
  });
  
  const isPremium = user?.subscription_tier === 'premium' || 
                    user?.premium_override === true ||
                    emailMatch ||
                    phoneMatch ||
                    (user?.premium_until && new Date(user.premium_until) > new Date());

  const handleAnswerSelect = (questionIndex, optionIndex) => {
    if (showResults) return;
    setSelectedAnswers({
      ...selectedAnswers,
      [questionIndex]: optionIndex
    });
  };

  const calculateScore = () => {
    let correct = 0;
    quizData.questions.forEach((question, index) => {
      if (selectedAnswers[index] === question.correct_answer) {
        correct++;
      }
    });
    return correct;
  };

  const getScoreColor = (score, total) => {
    const percentage = (score / total) * 100;
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const handleSave = () => {
    if (onSave) {
      onSave({ ...quizData, title: editedTitle });
    }
  };

  const handleExport = async () => {
    if (!isPremium) {
      toast.error("Export is a Premium feature", {
        description: "Upgrade to export your quizzes"
      });
      return;
    }

    // Placeholder for actual export logic.
    // In a real application, this would contain the code to
    // generate and download the quiz data (e.g., as JSON, PDF, etc.)
    toast.success("Export initiated (Premium feature)", {
      description: "This is a placeholder, actual export logic goes here."
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          {isEditingTitle ? (
            <div className="flex gap-2 items-center">
              <Input 
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="text-2xl font-bold"
                placeholder="Enter quiz title..."
              />
              <Button size="sm" onClick={() => setIsEditingTitle(false)}>
                Done
              </Button>
            </div>
          ) : (
            <div className="flex justify-between items-start">
              <CardTitle className="text-2xl">{editedTitle}</CardTitle>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setIsEditingTitle(true)}
              >
                <Edit2 className="w-4 h-4" />
              </Button>
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <Badge variant="secondary">Topic: {quizData.topic}</Badge>
            <Badge variant="outline">Difficulty: {quizData.difficulty}</Badge>
            <Badge variant="outline">{quizData.questions.length} Questions</Badge>
          </div>
        </CardHeader>
      </Card>

      {showResults && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-900">
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-2">Quiz Complete!</h3>
              <p className={`text-3xl font-bold ${getScoreColor(calculateScore(), quizData.questions.length)}`}>
                {calculateScore()} / {quizData.questions.length}
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                {Math.round((calculateScore() / quizData.questions.length) * 100)}% Score
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {quizData.questions.map((question, questionIndex) => (
          <Card key={questionIndex} className={`${
            showResults 
              ? selectedAnswers[questionIndex] === question.correct_answer 
                ? 'border-green-500 bg-green-50 dark:bg-green-900'
                : selectedAnswers[questionIndex] !== undefined 
                ? 'border-red-500 bg-red-50 dark:bg-red-900'
                : 'border-gray-200'
              : 'border-gray-200'
          }`}>
            <CardHeader>
              <CardTitle className="text-lg">
                {questionIndex + 1}. {question.question}
              </CardTitle>
              {showResults && (
                <Badge variant="outline" className="w-fit">
                  {question.scripture_reference}
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {question.options.map((option, optionIndex) => {
                  const isSelected = selectedAnswers[questionIndex] === optionIndex;
                  const isCorrect = optionIndex === question.correct_answer;
                  
                  return (
                    <Button
                      key={optionIndex}
                      variant={
                        showResults 
                          ? isCorrect 
                            ? "default" 
                            : isSelected 
                            ? "destructive" 
                            : "outline"
                          : isSelected 
                          ? "default" 
                          : "outline"
                      }
                      className={`w-full justify-start h-auto p-3 text-left ${
                        showResults && isCorrect ? 'bg-green-600 hover:bg-green-700' : ''
                      }`}
                      onClick={() => handleAnswerSelect(questionIndex, optionIndex)}
                      disabled={showResults}
                    >
                      <div className="flex items-center gap-2">
                        {showResults && (
                          isCorrect ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : isSelected ? (
                            <XCircle className="w-4 h-4" />
                          ) : null
                        )}
                        <span>{String.fromCharCode(65 + optionIndex)}. {option}</span>
                      </div>
                    </Button>
                  );
                })}
              </div>
              
              {showResults && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Explanation:</strong> {question.explanation}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {!showResults && (
        <div className="flex justify-center gap-3">
          <Button 
            onClick={() => setShowResults(true)} 
            className="bg-green-600 hover:bg-green-700"
            disabled={Object.keys(selectedAnswers).length < quizData.questions.length}
          >
            Submit Quiz
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
          {onSave && (
            <Button onClick={handleSave} variant="outline">
              <Save className="w-4 h-4 mr-2" />
              Save Quiz
            </Button>
          )}
        </div>
      )}

      {showResults && onSave && (
        <Button onClick={handleSave} className="w-full">
          <Save className="w-4 h-4 mr-2" />
          Save Quiz
        </Button>
      )}

      {/* Example of where handleExport might be used, e.g., an export button for premium users */}
      {showResults && (
        <div className="flex justify-center mt-4">
          <Button onClick={handleExport} disabled={!isPremium && user !== undefined} variant="secondary">
            Export Results {isPremium ? '' : '(Premium)'}
          </Button>
        </div>
      )}
    </div>
  );
}
