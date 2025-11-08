
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  BookOpen,
  Sparkles,
  Bot,
  Layers,
  Users,
  GraduationCap,
  Search,
  Presentation,
  Zap,
  Crown,
  Clock,
  Heart,
  CheckCircle2,
  ArrowRight,
  Star,
  Mic,
  Languages,
  MessageSquare,
  TrendingUp,
  Lightbulb,
  Globe,
  Download,
  Share2,
  Settings // Added Settings icon for the new feature
} from "lucide-react";
import { motion } from "framer-motion";
import VerseOfTheDay from "@/components/reader/VerseOfTheDay";
import OnboardingWizard from "@/components/OnboardingWizard"; // Assuming this component exists at this path

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      // Show onboarding for new users
      if (currentUser && !currentUser.onboarding_completed) {
        setTimeout(() => setShowOnboarding(true), 2000);
      }
    } catch (error) {
      console.log("User not logged in");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: Bot,
      title: "Larry - AI Sermon Assistant",
      description: "Generate complete sermons in 30 seconds with exegesis, illustrations, and applications",
      color: "blue",
      link: "SermonBuilder"
    },
    {
      icon: Layers,
      title: "Arlynn - Series Specialist",
      description: "Create 3-12 week sermon series with theological trajectories and discussion questions",
      color: "purple",
      link: "SermonBuilder"
    },
    {
      icon: BookOpen,
      title: "Bible Reader",
      description: "Fast scripture search with highlighting, notes, and verse-by-verse study tools",
      color: "green",
      link: "Reader"
    },
    {
      icon: Presentation,
      title: "Live Preaching Assistant",
      description: "Real-time AI help, vocal feedback, and audience engagement suggestions while preaching",
      color: "red",
      link: "SermonBuilder"
    },
    {
      icon: GraduationCap,
      title: "Bible Study Generator",
      description: "Create comprehensive study guides for personal, group, youth, or children's studies",
      color: "indigo",
      link: "BibleStudy"
    },
    {
      icon: Search,
      title: "Deep Exegesis",
      description: "Original language analysis, historical context, and theological interpretation",
      color: "orange",
      link: "SermonBuilder"
    }
  ];

  const aiCapabilities = [
    { icon: Sparkles, text: "Full sermon generation in 30 seconds", highlight: true },
    { icon: Lightbulb, text: "AI-powered illustrations and anecdotes" },
    { icon: BookOpen, text: "Scripture suggestions and cross-references" },
    { icon: Users, text: "Audience adaptation (youth, adults, seniors)" },
    { icon: Languages, text: "Multi-language translation (50+ languages)" },
    { icon: TrendingUp, text: "Theological trajectory planning" },
    { icon: Mic, text: "Real-time vocal feedback while preaching" },
    { icon: MessageSquare, text: "Counter-arguments and Q&A prep" }
  ];

  const stats = [
    { number: "30 sec", label: "Sermon Generation", icon: Clock },
    { number: "95%", label: "Time Saved", icon: Zap },
    { number: "50+", label: "Bible Translations", icon: Globe },
    { number: "AI×2", label: "Smart Assistants", icon: Bot }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 dark:from-indigo-500/5 dark:via-purple-500/5 dark:to-pink-500/5"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <Badge className="mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-2 text-base">
              <Sparkles className="w-4 h-4 mr-2 inline" />
              Powered by AI
            </Badge>
            
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white mb-6">
              SermonSmith
            </h1>
            
            <p className="text-2xl md:text-3xl text-gray-600 dark:text-gray-300 mb-4">
              AI-Powered <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Bible Study</span> & 
              <span className="text-purple-600 dark:text-purple-400 font-semibold"> Sermon Builder</span>
            </p>
            
            <p className="text-xl text-gray-500 dark:text-gray-400 max-w-3xl mx-auto mb-12">
              Meet <strong className="text-blue-600">Larry</strong> and <strong className="text-purple-600">Arlynn</strong> - 
              your AI sermon assistants. Generate complete sermons in 30 seconds, create multi-week series, 
              and get real-time help while preaching.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {!user ? (
                <>
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-lg px-8 py-6"
                    onClick={() => base44.auth.redirectToLogin()}
                  >
                    <Zap className="w-5 h-5 mr-2" />
                    Get Started Free
                  </Button>
                  <Link to={createPageUrl('Pricing')}>
                    <Button
                      size="lg"
                      variant="outline"
                      className="text-lg px-8 py-6 border-2"
                    >
                      <Crown className="w-5 h-5 mr-2" />
                      View Pricing
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link to={createPageUrl('SermonBuilder')}>
                    <Button
                      size="lg"
                      className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-lg px-8 py-6"
                    >
                      <Bot className="w-5 h-5 mr-2" />
                      Create Sermon
                    </Button>
                  </Link>
                  <Link to={createPageUrl('Reader')}>
                    <Button
                      size="lg"
                      variant="outline"
                      className="text-lg px-8 py-6 border-2"
                    >
                      <BookOpen className="w-5 h-5 mr-2" />
                      Read Bible
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-20"
          >
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card key={index} className="text-center bg-white/50 dark:bg-gray-800/50 backdrop-blur border-0 shadow-lg">
                  <CardContent className="pt-6">
                    <Icon className="w-8 h-8 mx-auto mb-3 text-indigo-600" />
                    <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                      {stat.number}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {stat.label}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </motion.div>
        </div>
      </div>

      {/* Personalized Welcome for Logged In Users */}
      {user && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-300">
            <CardContent className="pt-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
                  Welcome back, {user.full_name || 'friend'}! 👋
                </h2>
                {user.denomination && (
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    {user.denomination} • {user.study_preferences?.preferredAudience || 'General'} Ministry
                  </p>
                )}
                {user.content_preferences?.favoriteTopics?.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2 mt-3">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Your topics:</span>
                    {user.content_preferences.favoriteTopics.slice(0, 5).map((topic, index) => (
                      <Badge key={index} variant="secondary">{topic}</Badge>
                    ))}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row justify-center gap-3 mt-4">
                  <Link to={createPageUrl('SermonBuilder')}>
                    <Button className="bg-indigo-600 hover:bg-indigo-700">
                      Create {user.study_preferences?.preferredSermonTone || 'Teaching'} Sermon
                    </Button>
                  </Link>
                  <Link to={createPageUrl('Settings')}>
                    <Button variant="outline" className="border-indigo-600 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                      <Settings className="w-4 h-4 mr-2" />
                      Update Preferences
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Verse of the Day - For Logged In Users */}
      {user && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <VerseOfTheDay user={user} />
        </div>
      )}

      {/* Meet Your AI Team */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Meet Your AI Team
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Two specialized AI assistants designed to revolutionize your sermon preparation
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Larry Card */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <Card className="h-full bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800 hover:shadow-2xl transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-4 bg-blue-600 rounded-2xl">
                    <Bot className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-3xl text-blue-900 dark:text-blue-100">Larry</CardTitle>
                    <CardDescription className="text-lg">The Sermon Assistant</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-700 dark:text-gray-300 text-lg">
                  Your personal sermon writer. Larry generates complete, biblical sermons in 30 seconds.
                </p>
                
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">Full Sermon Generation</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">3-4 points with exegesis, illustrations, applications</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">Live Preaching Help</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Real-time suggestions, vocal feedback, timing cues</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">Theological Depth</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Original languages, context, denominational views</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">Enhancement Tools</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Improve illustrations, add scriptures, adapt audiences</div>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <Badge className="bg-blue-600 text-white">Perfect for Individual Sermons</Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Arlynn Card */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <Card className="h-full bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-purple-200 dark:border-purple-800 hover:shadow-2xl transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-4 bg-purple-600 rounded-2xl">
                    <Layers className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-3xl text-purple-900 dark:text-purple-100">Arlynn</CardTitle>
                    <CardDescription className="text-lg">The Series Specialist</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-700 dark:text-gray-300 text-lg">
                  Your strategic planner. Arlynn creates comprehensive sermon series and detailed outlines.
                </p>
                
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-purple-600 mt-1 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">Multi-Week Series</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">3-12 week series that build on each other</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-purple-600 mt-1 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">Detailed Outlines</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Big idea, points, scriptures, applications, illustrations</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-purple-600 mt-1 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">Theological Trajectory</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">How each sermon builds toward culmination</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-purple-600 mt-1 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">Discussion Questions</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Small group questions for each sermon</div>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <Badge className="bg-purple-600 text-white">Perfect for Sermon Series</Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* AI Capabilities */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Powered by Advanced AI
            </h2>
            <p className="text-xl text-indigo-100 max-w-3xl mx-auto">
              Cutting-edge artificial intelligence that understands theology, context, and your congregation
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {aiCapabilities.map((capability, index) => {
              const Icon = capability.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card className={`bg-white/10 backdrop-blur border-0 ${capability.highlight ? 'ring-2 ring-yellow-400' : ''}`}>
                    <CardContent className="pt-6 text-center">
                      <Icon className="w-8 h-8 mx-auto mb-3 text-white" />
                      <p className="text-white font-medium">{capability.text}</p>
                      {capability.highlight && (
                        <Star className="w-4 h-4 mx-auto mt-2 text-yellow-400" />
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Everything You Need
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            From Bible reading to sermon delivery, SermonSmith has you covered
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const colorClasses = {
              blue: 'from-blue-500 to-indigo-500',
              purple: 'from-purple-500 to-pink-500',
              green: 'from-green-500 to-emerald-500',
              red: 'from-red-500 to-orange-500',
              indigo: 'from-indigo-500 to-purple-500',
              orange: 'from-orange-500 to-yellow-500'
            };

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Link to={createPageUrl(feature.link)}>
                  <Card className="h-full hover:shadow-2xl transition-all duration-300 cursor-pointer group">
                    <CardHeader>
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${colorClasses[feature.color]} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                        <Icon className="w-8 h-8 text-white" />
                      </div>
                      <CardTitle className="text-xl group-hover:text-indigo-600 transition-colors">
                        {feature.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
                      <div className="flex items-center text-indigo-600 dark:text-indigo-400 mt-4 group-hover:translate-x-2 transition-transform">
                        <span className="text-sm font-medium">Learn more</span>
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-gray-100 dark:bg-gray-800 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              From idea to pulpit in minutes, not hours
            </p>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: "1", title: "Choose Your Topic", description: "Enter a scripture passage or sermon theme", icon: BookOpen },
              { step: "2", title: "AI Generates Content", description: "Larry or Arlynn creates your sermon in 30 seconds", icon: Sparkles },
              { step: "3", title: "Customize & Enhance", description: "Review, edit, and add your personal touches", icon: Lightbulb },
              { step: "4", title: "Present with AI", description: "Use live presentation mode with real-time assistance", icon: Presentation }
            ].map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.2 }}
                  viewport={{ once: true }}
                  className="text-center"
                >
                  <div className="relative mb-6">
                    <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-3xl font-bold text-white">
                      {step.step}
                    </div>
                    <Icon className="w-8 h-8 absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 rounded-full p-1 text-indigo-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{step.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{step.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              More Time for Ministry
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
              Stop spending 10-15 hours on sermon prep. Let AI handle the research and structure 
              so you can focus on what matters most - shepherding your flock.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Save 95% of Prep Time</h3>
                  <p className="text-gray-600 dark:text-gray-400">What took 12 hours now takes 30 minutes</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <Heart className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Better Quality Sermons</h3>
                  <p className="text-gray-600 dark:text-gray-400">Access to theological depth and multiple perspectives</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Focus on People</h3>
                  <p className="text-gray-600 dark:text-gray-400">More time for counseling, visitation, and relationships</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-3xl transform rotate-3"></div>
            <Card className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur border-0 shadow-2xl">
              <CardContent className="p-8">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Traditional Prep</span>
                    <span className="text-2xl font-bold text-red-600">12 hours</span>
                  </div>
                  <div className="h-3 bg-red-200 dark:bg-red-900/30 rounded-full overflow-hidden">
                    <div className="h-full bg-red-600 w-full"></div>
                  </div>

                  <div className="flex items-center justify-between mt-8">
                    <span className="text-gray-600 dark:text-gray-400">With SermonSmith</span>
                    <span className="text-2xl font-bold text-green-600">30 min</span>
                  </div>
                  <div className="h-3 bg-green-200 dark:bg-green-900/30 rounded-full overflow-hidden">
                    <div className="h-full bg-green-600 w-[4%]"></div>
                  </div>

                  <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-indigo-600 mb-2">11.5 hours</div>
                      <div className="text-gray-600 dark:text-gray-400">saved per week for ministry</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to Transform Your Ministry?
            </h2>
            <p className="text-xl text-indigo-100 mb-10">
              Join thousands of pastors who are preaching better sermons with less stress
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {!user ? (
                <>
                  <Button
                    size="lg"
                    className="bg-white text-indigo-600 hover:bg-gray-100 text-lg px-10 py-7"
                    onClick={() => base44.auth.redirectToLogin()}
                  >
                    <Zap className="w-5 h-5 mr-2" />
                    Start Free Today
                  </Button>
                  <Link to={createPageUrl('Pricing')}>
                    <Button
                      size="lg"
                      variant="outline"
                      className="text-white border-2 border-white hover:bg-white/10 text-lg px-10 py-7"
                    >
                      <Crown className="w-5 h-5 mr-2" />
                      View Pricing
                    </Button>
                  </Link>
                </>
              ) : (
                <Link to={createPageUrl('SermonBuilder')}>
                  <Button
                    size="lg"
                    className="bg-white text-indigo-600 hover:bg-gray-100 text-lg px-10 py-7"
                  >
                    <Bot className="w-5 h-5 mr-2" />
                    Create Your First Sermon
                  </Button>
                </Link>
              )}
            </div>

            <p className="text-indigo-100 mt-6">
              No credit card required • Works on all devices • 50+ Bible translations
            </p>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-bold text-xl mb-4">SermonSmith</h3>
              <p className="text-gray-400">AI-powered sermon preparation for modern ministry</p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Features</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link to={createPageUrl('SermonBuilder')} className="hover:text-white transition-colors">Sermon Builder</Link></li>
                <li><Link to={createPageUrl('Reader')} className="hover:text-white transition-colors">Bible Reader</Link></li>
                <li><Link to={createPageUrl('BibleStudy')} className="hover:text-white transition-colors">Bible Study</Link></li>
                <li><Link to={createPageUrl('Community')} className="hover:text-white transition-colors">Community</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link to={createPageUrl('Pricing')} className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link to={createPageUrl('Settings')} className="hover:text-white transition-colors">Settings</Link></li>
                <li><Link to={createPageUrl('Downloads')} className="hover:text-white transition-colors">Downloads</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Platform</h4>
              <div className="flex gap-3 mb-4">
                <Badge variant="outline" className="text-white border-white">
                  <Globe className="w-3 h-3 mr-1" />
                  Web
                </Badge>
                <Badge variant="outline" className="text-white border-white">
                  <Download className="w-3 h-3 mr-1" />
                  iOS
                </Badge>
                <Badge variant="outline" className="text-white border-white">
                  <Download className="w-3 h-3 mr-1" />
                  Android
                </Badge>
              </div>
              <p className="text-gray-400 text-sm">Works on all your devices</p>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>© 2024 SermonSmith. Created by Dr. John White. All rights reserved.</p>
          </div>
        </div>
      </div>

      <OnboardingWizard
        open={showOnboarding}
        onClose={() => {
          setShowOnboarding(false);
          loadUser(); // Reload user to reflect onboarding_completed status
        }}
        user={user}
      />
    </div>
  );
}
