import React, { useState, useEffect } from 'react';
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { logError } from '@/lib/logError';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, GraduationCap, Trash2, Eye, History } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import StudyGuideViewer from "../components/study/StudyGuideViewer";
import RevisionHistory from '@/components/sermon/RevisionHistory';

export default function MyStudies() {
    const { user, isLoadingAuth } = useAuth();
    const [studies, setStudies] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedStudy, setSelectedStudy] = useState(null);
    const [showViewer, setShowViewer] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    const loadStudies = async (currentUser) => {
        if (!currentUser) return;
        setIsLoading(true);
        try {
            const userStudies = await api.entities.BibleStudy.filter({ user_id: currentUser.id }, '-created_date');
            setStudies(userStudies);
        } catch (error) {
            toast.error(logError('Failed to load Bible studies', error));
        }
        setIsLoading(false);
    };

    useEffect(() => {
        if (isLoadingAuth) return;
        if (!user) {
            toast.error("You must be logged in to view your studies.");
            setIsLoading(false);
            return;
        }
        loadStudies(user);
    }, [isLoadingAuth, user]);

    const handleDelete = async (studyId) => {
        if (!confirm("Are you sure you want to delete this Bible study? This action cannot be undone.")) {
            return;
        }
        try {
            await api.entities.BibleStudy.delete(studyId);
            setStudies(studies.filter(s => s.id !== studyId));
            toast.success("Bible study deleted.");
        } catch (error) {
            toast.error(logError('Failed to delete study', error));
        }
    };

    const handleView = (study) => {
        setSelectedStudy(study);
        setShowViewer(true);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
            </div>
        );
    }
    
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-8 flex items-center gap-3">
                    <GraduationCap className="w-8 h-8 text-blue-500" />
                    My Bible Studies
                </h1>
                
                {studies.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
                        <GraduationCap className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600" />
                        <p className="mt-4 text-lg font-medium text-gray-500 dark:text-gray-400">You haven't saved any Bible studies yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {studies.map(study => (
                            <Card key={study.id} className="flex flex-col">
                                <CardHeader>
                                    <CardTitle>{study.title}</CardTitle>
                                    <CardDescription>
                                        <Badge variant="secondary" className="mr-2">{study.topic}</Badge>
                                        <Badge variant="outline">{study.study_type}</Badge>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                                        {study.overview}
                                    </p>
                                </CardContent>
                                <CardFooter className="flex justify-between gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleView(study)}>
                                        <Eye className="w-4 h-4 mr-2" />
                                        View
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => { setSelectedStudy(study); setShowHistory(true); }}>
                                        <History className="w-4 h-4 mr-2" />History
                                    </Button>
                                    <Button variant="destructive" size="icon" onClick={() => handleDelete(study.id)}>
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
                        <DialogTitle>{selectedStudy?.title}</DialogTitle>
                    </DialogHeader>
                    {selectedStudy && <StudyGuideViewer studyData={selectedStudy} viewOnly />}
                </DialogContent>
            </Dialog>
            <Dialog open={showHistory} onOpenChange={setShowHistory}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>{selectedStudy?.title} history</DialogTitle></DialogHeader>
                    {selectedStudy && <RevisionHistory entityType="BibleStudy" entityId={selectedStudy.id} onRestored={(restored) => {
                        setSelectedStudy(restored);
                        setStudies((current) => current.map((item) => item.id === restored.id ? restored : item));
                    }} />}
                </DialogContent>
            </Dialog>
        </div>
    );
}
