import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Sparkles, 
  Users, 
  Heart, 
  ArrowRight,
  CheckCircle2,
  Baby,
  GraduationCap,
  User as UserIcon
} from "lucide-react";
import { api } from '@/api/apiClient';
import { toast } from "sonner";

const DENOMINATION_CATEGORIES = {
  "Pentecostal": [
    "Assemblies of God",
    "Church of God (Cleveland, TN)",
    "Church of God of Prophecy",
    "Church of God in Christ (COGIC)",
    "International Pentecostal Holiness Church",
    "Pentecostal Assemblies of the World",
    "United Pentecostal Church International",
    "Foursquare Church",
    "Other Pentecostal"
  ],
  "Baptist": [
    "Southern Baptist",
    "American Baptist",
    "National Baptist",
    "Progressive National Baptist",
    "Freewill Baptist",
    "Primitive Baptist",
    "Independent Baptist",
    "Missionary Baptist",
    "Other Baptist"
  ],
  "Methodist": [
    "United Methodist",
    "African Methodist Episcopal (AME)",
    "African Methodist Episcopal Zion (AME Zion)",
    "Christian Methodist Episcopal (CME)",
    "Free Methodist",
    "Wesleyan",
    "Other Methodist"
  ],
  "Church of Christ": [
    "Church of Christ (a cappella)",
    "Church of Christ (instrumental)",
    "International Church of Christ",
    "United Church of Christ",
    "Other Church of Christ"
  ],
  "Presbyterian": [
    "Presbyterian Church (USA)",
    "Presbyterian Church in America (PCA)",
    "Orthodox Presbyterian Church",
    "Cumberland Presbyterian",
    "Other Presbyterian"
  ],
  "Lutheran": [
    "Evangelical Lutheran Church in America (ELCA)",
    "Lutheran Church-Missouri Synod",
    "Wisconsin Evangelical Lutheran Synod",
    "Other Lutheran"
  ],
  "Anglican/Episcopal": [
    "Episcopal Church",
    "Anglican Church in North America (ACNA)",
    "Other Anglican"
  ],
  "Catholic": [
    "Roman Catholic",
    "Eastern Catholic",
    "Other Catholic"
  ],
  "Orthodox": [
    "Eastern Orthodox",
    "Greek Orthodox",
    "Russian Orthodox",
    "Other Orthodox"
  ],
  "Reformed": [
    "Christian Reformed Church",
    "Reformed Church in America",
    "Dutch Reformed",
    "Other Reformed"
  ],
  "Holiness": [
    "Church of the Nazarene",
    "Church of God (Anderson, IN)",
    "Salvation Army",
    "Pilgrim Holiness Church",
    "Other Holiness"
  ],
  "Other": [
    "Non-Denominational",
    "Interdenominational",
    "Seventh-day Adventist",
    "Mennonite",
    "Amish",
    "Brethren",
    "Church of the Brethren",
    "Quaker (Friends)",
    "Moravian"
  ]
};

const SERMON_TONES = [
  { value: "teaching", label: "Teaching", icon: "📖", description: "Deep, expository" },
  { value: "inspirational", label: "Inspirational", icon: "✨", description: "Uplifting, encouraging" },
  { value: "evangelistic", label: "Evangelistic", icon: "🌍", description: "Gospel-centered" },
  { value: "pastoral", label: "Pastoral", icon: "❤️", description: "Caring, compassionate" }
];

const AUDIENCES = [
  { value: "general", label: "General Congregation", icon: Users },
  { value: "youth", label: "Youth (13-18)", icon: GraduationCap },
  { value: "children", label: "Children (6-12)", icon: Baby },
  { value: "young_adults", label: "Young Adults (18-30)", icon: UserIcon },
  { value: "seniors", label: "Seniors (60+)", icon: Heart }
];

const POPULAR_TOPICS = [
  "Prayer", "Faith", "Grace", "Love", "Forgiveness", "Hope",
  "Anxiety", "Relationships", "Purpose", "Identity", "Worship",
  "Scripture", "Holy Spirit", "Church", "Service", "Evangelism"
];

export default function OnboardingWizard({ open, onClose, user }) {
  const [step, setStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [preferences, setPreferences] = useState({
    denomination: user?.denomination || "",
    preferredSermonTone: "teaching",
    preferredAudience: "general",
    favoriteTopics: [],
    defaultTranslation: "en-kjv"
  });

  const handleTopicToggle = (topic) => {
    setPreferences(prev => ({
      ...prev,
      favoriteTopics: prev.favoriteTopics.includes(topic)
        ? prev.favoriteTopics.filter(t => t !== topic)
        : [...prev.favoriteTopics, topic]
    }));
  };

  const handleComplete = async () => {
    try {
      await api.auth.updateMe({
        denomination: preferences.denomination,
        study_preferences: {
          preferredStudyType: "personal",
          preferredSermonTone: preferences.preferredSermonTone,
          preferredAudience: preferences.preferredAudience,
          studyDuration: "medium"
        },
        reading_preferences: {
          fontSize: 18,
          lineHeight: 1.8,
          theme: "light",
          defaultTranslation: preferences.defaultTranslation
        },
        content_preferences: {
          favoriteTopics: preferences.favoriteTopics,
          avoidTopics: [],
          preferredTestaments: ["both"]
        },
        onboarding_completed: true
      });

      toast.success("Welcome to SermonSmith! 🎉");
      onClose();
      window.location.reload();
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error("Failed to save preferences");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-600" />
            Welcome to SermonSmith!
          </DialogTitle>
          <DialogDescription>
            Let's personalize your experience (Step {step} of 4)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step 1: Denomination */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">What's your denomination?</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  This helps us align AI content with your theological perspective
                </p>
              </div>
              
              {!selectedCategory ? (
                // Step 1a: Category Selection
                <>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Select your denomination family:</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.keys(DENOMINATION_CATEGORIES).map((category) => (
                      <Button
                        key={category}
                        variant="outline"
                        className="h-auto py-3"
                        onClick={() => setSelectedCategory(category)}
                      >
                        {category}
                      </Button>
                    ))}
                  </div>
                </>
              ) : (
                // Step 1b: Specific Denomination Selection
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {selectedCategory} Denominations:
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCategory("");
                        setPreferences(prev => ({ ...prev, denomination: "" }));
                      }}
                    >
                      ← Back to Categories
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                    {DENOMINATION_CATEGORIES[selectedCategory].map((denom) => (
                      <Button
                        key={denom}
                        variant={preferences.denomination === denom ? 'default' : 'outline'}
                        className="h-auto py-3 justify-start"
                        onClick={() => setPreferences(prev => ({ ...prev, denomination: denom }))}
                      >
                        {denom}
                      </Button>
                    ))}
                  </div>
                </>
              )}
              
              <div className="pt-4 border-t">
                <Label htmlFor="custom-denom" className="text-sm">Or enter your own:</Label>
                <Input
                  id="custom-denom"
                  placeholder="Type your denomination..."
                  value={preferences.denomination}
                  onChange={(e) => {
                    setPreferences(prev => ({ ...prev, denomination: e.target.value }));
                    setSelectedCategory("");
                  }}
                />
              </div>
            </div>
          )}

          {/* Step 2: Sermon Style */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">What sermon style do you prefer?</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Larry will use this as your default when generating sermons
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {SERMON_TONES.map((tone) => (
                  <Card
                    key={tone.value}
                    className={`cursor-pointer transition-all ${
                      preferences.preferredSermonTone === tone.value
                        ? 'border-indigo-500 border-2 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'hover:border-indigo-300'
                    }`}
                    onClick={() => setPreferences(prev => ({ ...prev, preferredSermonTone: tone.value }))}
                  >
                    <CardContent className="pt-6 text-center">
                      <div className="text-4xl mb-2">{tone.icon}</div>
                      <div className="font-semibold mb-1">{tone.label}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {tone.description}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Primary Audience */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Who do you primarily minister to?</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  We'll customize illustrations and applications for your audience
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {AUDIENCES.map((audience) => {
                  const Icon = audience.icon;
                  return (
                    <Card
                      key={audience.value}
                      className={`cursor-pointer transition-all ${
                        preferences.preferredAudience === audience.value
                          ? 'border-purple-500 border-2 bg-purple-50 dark:bg-purple-900/20'
                          : 'hover:border-purple-300'
                      }`}
                      onClick={() => setPreferences(prev => ({ ...prev, preferredAudience: audience.value }))}
                    >
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <Icon className="w-6 h-6 text-purple-600" />
                          <div className="font-semibold">{audience.label}</div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 4: Favorite Topics */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">What topics interest you most?</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Select 3-5 topics for personalized recommendations (optional)
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {POPULAR_TOPICS.map((topic) => (
                  <Badge
                    key={topic}
                    variant={preferences.favoriteTopics.includes(topic) ? 'default' : 'outline'}
                    className="cursor-pointer px-4 py-2 text-sm"
                    onClick={() => handleTopicToggle(topic)}
                  >
                    {preferences.favoriteTopics.includes(topic) && (
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                    )}
                    {topic}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-gray-500 text-center">
                {preferences.favoriteTopics.length} selected
              </p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1}
            >
              Back
            </Button>
            
            {step < 4 ? (
              <Button onClick={() => setStep(step + 1)}>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Complete Setup
              </Button>
            )}
          </div>

          {/* Progress Indicator */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-2 w-12 rounded-full ${
                  s === step ? 'bg-indigo-600' :
                  s < step ? 'bg-green-600' :
                  'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}