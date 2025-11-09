
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, Star, Zap, Settings, ExternalLink, Loader2, Crown } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { usePremiumAccess } from '../components/hooks/usePremiumAccess';

const freeFeatures = [
    "KJV Bible Reader",
    "Highlighting & Notes",
    "Denomination-Specific AI Content",
    "AI Sermon Builder",
    "AI Bible Study Generator",
    "AI Quiz Generator",
    "Save Unlimited Sermons & Studies"
];

const premiumFeatures = [
    "All Free features, plus:",
    "Access to All Bible Translations",
    "Multi-Language Verse Translation (50+ Languages)",
    "Export Sermons to PDF & PPTX",
    "Interactive Bible Maps & Journeys",
    "Advanced AI Study Tools",
    "Priority Support",
    "Cloud Sync Across Devices"
];

export default function Pricing() {
    const [user, setUser] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const { isPremium, devOverride, loading: accessLoading } = usePremiumAccess();

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const userData = await base44.auth.me();
                setUser(userData);
            } catch (e) {
                console.log("User not logged in", e);
            } finally {
                setIsLoading(false); // Corrected from setLoading(false) as per state variable name
            }
        };
        fetchUser();
    }, []);
    
    const handleUpgrade = async () => {
        if (!user) {
            toast.error("Please log in or sign up to upgrade your account.");
            return;
        }
        
        // Developer backdoor - check emails and phone
        const devEmails = [
            'buckeye7066@gmail.com',
            'anyawhite@rocketmail.com',
            'whiterobert1201@icloud.com',
            'tishka1201@icloud.com'
        ];
        
        const devPhones = ['9319981779', '+19319981779', '931-998-1779', '(931) 998-1779'];
        
        // Check for email match, ensuring user.email is not null/undefined
        const emailMatch = user.email && devEmails.includes(user.email.toLowerCase());

        // Check for phone match, normalizing both user.phone and developer phone numbers
        const phoneMatch = user.phone && devPhones.some(p => 
            user.phone.replace(/[\s\-\(\)]/g, '').includes(p.replace(/[\s\-\(\)\+]/g, ''))
        );
        
        if (emailMatch || phoneMatch) {
            setIsProcessing(true);
            try {
                // If the user is a developer but already premium, just inform them
                if (isPremium) {
                    toast.info("Developer premium access active", {
                        description: "You already have full premium access"
                    });
                } else {
                    // Activate premium for the developer via backend
                    await base44.auth.updateMe({ subscription_tier: 'premium' });
                    toast.success("Developer premium access activated! 🎉");
                    // Refresh user data to reflect the new premium status
                    const updatedUser = await base44.auth.me();
                    setUser(updatedUser);
                }
                setIsProcessing(false);
                return;
            } catch (error) {
                console.error("Error activating developer premium access:", error);
                toast.error("Failed to activate premium access via developer backdoor.");
                setIsProcessing(false);
                return;
            }
        }
        
        // Existing checks for devOverride and isPremium (from usePremiumAccess hook)
        // These checks should happen AFTER the email/phone based backdoor attempt,
        // as the backdoor attempts to *grant* premium if applicable.
        if (devOverride) {
            toast.info("Developer premium access active", {
                description: "You already have full premium access"
            });
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
            const response = await base44.functions.invoke('createCheckoutSession');
            
            if (response.data.error) {
                throw new Error(response.data.error);
            }

            const { url, isPreview } = response.data;
            
            const inIframe = window.self !== window.top;
            
            if (inIframe || isPreview) {
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

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
                        Choose Your Plan
                    </h1>
                    <p className="text-xl text-gray-600 dark:text-gray-400">
                        Unlock the full power of SermonSmith for your ministry
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
                        price="$9.99"
                        description="The complete toolkit for pastors, teachers, and serious students."
                        features={premiumFeatures}
                        isPremiumPlan
                        isCurrentPlan={isPremium}
                    />
                </div>
            
                <div className="text-center mt-12">
                    <p className="text-sm text-gray-500">
                        Created by Dr. John White
                    </p>
                </div>
            </div>
        </div>
    );
}
