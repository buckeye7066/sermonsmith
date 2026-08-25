import React, { useState } from "react";
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, Star, Zap, ExternalLink, Loader2, Crown } from "lucide-react";
import { toast } from "sonner";


import { usePremiumAccess } from '../components/hooks/usePremiumAccess';
import { isNativeApp } from '../lib/platform';

const freeFeatures = [
    "KJV Bible Reader",
    "Highlighting & Notes",
    "Tradition-aware drafting prompts",
    "Sermon, Bible-study & quiz draft builders",
    "Save and revise your sermon and study drafts"
];

const premiumFeatures = [
    "All Free features, plus:",
    "Additional Bible translations when available from configured sources",
    "Multi-perspective study prompts for comparison",
    "AI-assisted language adaptation",
    "Worldview and ethics study tools",
    "Export sermons to PDF",
    "Interactive Bible maps and journeys",
    "Teaching-context adaptation (VBS, Sunday School, youth, and more)",
    "Advanced drafting and study tools",
    "Account sync on supported signed-in clients"
];

export default function Pricing() {
    const { user, isLoadingAuth: isLoading } = useAuth();
    const [isProcessing, setIsProcessing] = useState(false);
    const { isPremium, devOverride, loading: accessLoading } = usePremiumAccess();
    
    const handleUpgrade = async () => {
        if (!user) {
            toast.error("Please log in or sign up to upgrade your account.");
            return;
        }
        
        if (isPremium) {
            toast.info("You're already on Premium!", {
                description: "Manage your subscription in Settings"
            });
            return;
        }
        
        setIsProcessing(true);
        try {
            const response = await api.functions.invoke('createCheckoutSession');
            
            if (response.error) {
                throw new Error(response.error);
            }

            const { url } = response;
            
            const inIframe = window.self !== window.top;
            
            if (inIframe) {
                const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
                if (!newWindow) {
                    toast.error("Please allow pop-ups to complete payment", {
                        description: "Your browser blocked the payment window. Please enable pop-ups and try again."
                    });
                }
                setIsProcessing(false);
            } else {
                window.location.href = url;
            }
            
        } catch(e) {
            toast.error("Could not start upgrade process.", {
                description: e.message
            });
            setIsProcessing(false);
        }
    };

    const PlanCard = ({ title, price, description, features, isPremiumPlan, isCurrentPlan }) => (
        <Card className={`flex flex-col ${isPremiumPlan ? 'border-purple-500 border-2 shadow-purple-500/20 shadow-lg' : ''}`}>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="text-2xl">{title}</CardTitle>
                    {isPremiumPlan && <Star className="w-6 h-6 text-purple-500" />}
                </div>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
                <p className="text-4xl font-bold">{price}<span className="text-lg font-normal text-gray-500">/month</span></p>
                <ul className="space-y-2">
                    {features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                            <span>{feature}</span>
                        </li>
                    ))}
                </ul>
            </CardContent>
            <div className="p-6">
                 {isCurrentPlan ? (
                    <Button disabled variant="outline" className="w-full">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Current Plan
                    </Button>
                ) : isPremiumPlan ? (
                    <Button onClick={handleUpgrade} disabled={isProcessing || isPremium} className="w-full bg-purple-600 hover:bg-purple-700">
                        {isProcessing ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Zap className="w-4 h-4 mr-2" />
                        )}
                        {isProcessing ? "Redirecting..." : isPremium ? "Already Premium" : "Upgrade Now"}
                        {!isPremium && <ExternalLink className="w-4 h-4 ml-2" />}
                    </Button>
                ) : null}
            </div>
        </Card>
    );

    if (isLoading || accessLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    // Store policy: the installed app must not offer a purchase flow or
    // point at an external one, so native builds get a neutral notice
    // instead of plans, prices, or checkout.
    if (isNativeApp()) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
                <div className="max-w-xl mx-auto pt-16">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Crown className="w-6 h-6 text-purple-500" />
                                <CardTitle>Subscriptions</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-gray-700 dark:text-gray-300">
                                Subscription upgrades aren&apos;t available in this app.
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                If you already have a Premium subscription, simply log in with the
                                same account — all of your Premium features work here.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
                        Choose Your Plan
                    </h1>
                    <p className="text-xl text-gray-600 dark:text-gray-400">
                        Compare the SermonSmith tools available for study and sermon preparation
                    </p>
                    {devOverride && (
                        <div className="mt-4 inline-flex items-center gap-2 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded-lg">
                            <Crown className="w-5 h-5" />
                            <span className="font-semibold">Developer Premium Access Active</span>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
                    <PlanCard 
                        title="Free"
                        price="$0"
                        description="Essential tools for personal study and basic sermon prep."
                        features={freeFeatures}
                        isCurrentPlan={!isPremium}
                    />
                    <PlanCard 
                        title="Premium"
                        price="$4.99"
                        description="The complete toolkit for pastors, teachers, and serious students."
                        features={premiumFeatures}
                        isPremiumPlan
                        isCurrentPlan={isPremium}
                    />
                </div>
            
                <div className="text-center mt-12 space-y-2">
                    <p className="text-sm text-gray-500">
                        Translation availability, display, export, and offline use depend on the configured source and its license.
                    </p>
                    <p className="text-sm text-gray-500">
                        AI output is a draft aid. Verify Scripture wording, context, citations, and theological claims before teaching.
                    </p>
                    <p className="text-sm text-gray-500">
                        Created by Dr. John White
                    </p>
                </div>
            </div>
        </div>
    );
}
