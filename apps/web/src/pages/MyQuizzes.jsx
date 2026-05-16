import React, { useState, useEffect } from 'react';
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { logError } from '@/lib/logError';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Brain, Trash2, Play } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import QuizViewer from "../components/quiz/QuizViewer";

export default function MyQuizzes() {
    const { user, isLoadingAuth } = useAuth();
    const [quizzes, setQuizzes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedQuiz, setSelectedQuiz] = useState(null);
    const [showViewer, setShowViewer] = useState(false);

    const loadQuizzes = async (currentUser) => {
        if (!currentUser) return;
        setIsLoading(true);
        try {
            const userQuizzes = await api.entities.Quiz.filter({ user_id: currentUser.id }, '-created_date');
            setQuizzes(userQuizzes);
        } catch (error) {
            toast.error(logError('Failed to load quizzes', error));
        }
        setIsLoading(false);
    };

    useEffect(() => {
        if (isLoadingAuth) return;
        if (!user) {
            toast.error("You must be logged in to view your quizzes.");
            setIsLoading(false);
            return;
        }
        loadQuizzes(user);
    }, [isLoadingAuth, user]);

    const handleDelete = async (quizId) => {
        if (!confirm("Are you sure you want to delete this quiz? This action cannot be undone.")) {
            return;
        }
        try {
            await api.entities.Quiz.delete(quizId);
            setQuizzes(quizzes.filter(q => q.id !== quizId));
            toast.success("Quiz deleted.");
        } catch (error) {
            toast.error(logError('Failed to delete quiz', error));
        }
    };

    const handlePlay = (quiz) => {
        setSelectedQuiz(quiz);
        setShowViewer(true);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="w-12 h-12 animate-spin text-purple-500" />
            </div>
        );
    }
    
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-8 flex items-center gap-3">
                    <Brain className="w-8 h-8 text-purple-500" />
                    My Quizzes
                </h1>
                
                {quizzes.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
                        <Brain className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600" />
                        <p className="mt-4 text-lg font-medium text-gray-500 dark:text-gray-400">You haven't saved any quizzes yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {quizzes.map(quiz => (
                            <Card key={quiz.id} className="flex flex-col">
                                <CardHeader>
                                    <CardTitle>{quiz.title}</CardTitle>
                                    <CardDescription>
                                        <Badge variant="secondary" className="mr-2">{quiz.topic}</Badge>
                                        <Badge variant="outline">{quiz.difficulty}</Badge>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                        {quiz.questions?.length || 0} questions
                                    </p>
                                </CardContent>
                                <CardFooter className="flex justify-between">
                                    <Button variant="outline" size="sm" onClick={() => handlePlay(quiz)}>
                                        <Play className="w-4 h-4 mr-2" />
                                        Take Quiz
                                    </Button>
                                    <Button variant="destructive" size="icon" onClick={() => handleDelete(quiz.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={showViewer} onOpenChange={setShowViewer}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{selectedQuiz?.title}</DialogTitle>
                    </DialogHeader>
                    {selectedQuiz && <QuizViewer quizData={selectedQuiz} viewOnly />}
                </DialogContent>
            </Dialog>
        </div>
    );
}