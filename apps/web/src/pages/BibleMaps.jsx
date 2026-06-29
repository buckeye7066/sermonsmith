import React, { useState } from "react";
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { SafeImg } from '@/components/ui/SafeImg';
import { LARRY_SYSTEM_PROMPT } from '@/ai/personas';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Navigation, Clock, Book, Loader2, Crown, Search, Image as ImageIcon, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import PrintButton from "@/components/common/PrintButton";

import InteractiveMap from "../components/maps/InteractiveMap";
import TimelineViewer from "../components/maps/TimelineViewer";

const biblicalJourneys = [
  {
    id: 1,
    title: "Abraham's Journey",
    description: "From Ur to the Promised Land",
    locations: [
      { name: "Ur", lat: 30.96, lng: 46.1, description: "Abraham's birthplace" },
      { name: "Haran", lat: 36.87, lng: 39.03, description: "Where Abraham's father died" },
      { name: "Hebron", lat: 31.53, lng: 35.09, description: "Where Abraham settled" }
    ],
    color: "#3b82f6"
  },
  {
    id: 2,
    title: "Exodus Route",
    description: "Israel's journey from Egypt to Canaan",
    locations: [
      { name: "Goshen", lat: 30.88, lng: 31.46, description: "Where Israelites lived in Egypt" },
      { name: "Red Sea Crossing", lat: 29.5, lng: 32.75, description: "Miraculous crossing" },
      { name: "Mount Sinai", lat: 28.54, lng: 33.97, description: "Where Moses received the Law" },
      { name: "Jericho", lat: 31.86, lng: 35.44, description: "First conquest in Canaan" }
    ],
    color: "#ef4444"
  },
  {
    id: 3,
    title: "Jesus' Ministry",
    description: "Key locations in Jesus' earthly ministry",
    locations: [
      { name: "Bethlehem", lat: 31.7, lng: 35.2, description: "Jesus' birthplace" },
      { name: "Nazareth", lat: 32.7, lng: 35.3, description: "Where Jesus grew up" },
      { name: "Capernaum", lat: 32.88, lng: 35.57, description: "Center of Jesus' ministry" },
      { name: "Jerusalem", lat: 31.78, lng: 35.23, description: "Where Jesus was crucified and resurrected" }
    ],
    color: "#10b981"
  },
  {
    id: 4,
    title: "Paul's Missionary Journeys",
    description: "Paul's three missionary trips",
    locations: [
      { name: "Damascus", lat: 33.51, lng: 36.29, description: "Where Paul was converted" },
      { name: "Antioch", lat: 36.2, lng: 36.15, description: "First Christian mission base" },
      { name: "Athens", lat: 37.98, lng: 23.73, description: "Where Paul preached to philosophers" },
      { name: "Rome", lat: 41.9, lng: 12.5, description: "Paul's final destination" }
    ],
    color: "#8b5cf6"
  }
];

const biblicalTimelines = [
  {
    id: 1,
    title: "Old Testament Overview",
    description: "Key events from Creation to the return from exile",
    events: [
      { event: "Creation", date: "Beginning", description: "God creates the heavens, earth, and humanity", scripture: "Genesis 1-2" },
      { event: "The Fall", date: "Beginning", description: "Adam and Eve disobey God in the Garden of Eden", scripture: "Genesis 3" },
      { event: "The Flood", date: "~2300 BC", description: "God judges the earth with a flood; Noah and his family are saved", scripture: "Genesis 6-9" },
      { event: "Call of Abraham", date: "~2000 BC", description: "God calls Abram and promises to make him a great nation", scripture: "Genesis 12:1-3" },
      { event: "The Exodus", date: "~1446 BC", description: "God delivers Israel from slavery in Egypt through Moses", scripture: "Exodus 12-14" },
      { event: "The Law at Sinai", date: "~1446 BC", description: "God gives the Ten Commandments and the Law to Moses", scripture: "Exodus 19-20" },
      { event: "Conquest of Canaan", date: "~1406 BC", description: "Joshua leads Israel into the Promised Land", scripture: "Joshua 1-12" },
      { event: "United Kingdom", date: "~1050-930 BC", description: "Saul, David, and Solomon rule over a united Israel", scripture: "1 Samuel – 1 Kings 11" },
      { event: "Kingdom Divides", date: "930 BC", description: "Israel splits into northern (Israel) and southern (Judah) kingdoms", scripture: "1 Kings 12" },
      { event: "Fall of Israel", date: "722 BC", description: "Assyria conquers the northern kingdom of Israel", scripture: "2 Kings 17" },
      { event: "Fall of Judah", date: "586 BC", description: "Babylon destroys Jerusalem and the temple; exile begins", scripture: "2 Kings 25" },
      { event: "Return from Exile", date: "538 BC", description: "Cyrus allows Jews to return and rebuild the temple", scripture: "Ezra 1" }
    ]
  },
  {
    id: 2,
    title: "Life of Jesus Christ",
    description: "Major events from birth to ascension",
    events: [
      { event: "Birth of Jesus", date: "~4 BC", description: "Jesus is born in Bethlehem to Mary and Joseph", scripture: "Luke 2:1-20" },
      { event: "Flight to Egypt", date: "~4 BC", description: "Joseph takes the family to Egypt to escape Herod", scripture: "Matthew 2:13-15" },
      { event: "Baptism by John", date: "~AD 26", description: "Jesus is baptized in the Jordan River; the Spirit descends like a dove", scripture: "Matthew 3:13-17" },
      { event: "Temptation in the Wilderness", date: "~AD 26", description: "Jesus fasts 40 days and is tempted by Satan", scripture: "Matthew 4:1-11" },
      { event: "Sermon on the Mount", date: "~AD 27", description: "Jesus delivers his most famous teaching on the kingdom of God", scripture: "Matthew 5-7" },
      { event: "Feeding the 5,000", date: "~AD 29", description: "Jesus multiplies five loaves and two fish to feed a multitude", scripture: "John 6:1-14" },
      { event: "Transfiguration", date: "~AD 29", description: "Jesus is glorified on the mountain before Peter, James, and John", scripture: "Matthew 17:1-9" },
      { event: "Triumphal Entry", date: "~AD 30", description: "Jesus enters Jerusalem on a donkey; crowds shout Hosanna", scripture: "Matthew 21:1-11" },
      { event: "Last Supper", date: "~AD 30", description: "Jesus shares the Passover meal and institutes communion", scripture: "Luke 22:14-20" },
      { event: "Crucifixion", date: "~AD 30", description: "Jesus is crucified at Golgotha for the sins of the world", scripture: "John 19:16-30" },
      { event: "Resurrection", date: "~AD 30", description: "Jesus rises from the dead on the third day", scripture: "Matthew 28:1-10" },
      { event: "Ascension", date: "~AD 30", description: "Jesus ascends to heaven from the Mount of Olives", scripture: "Acts 1:9-11" }
    ]
  },
  {
    id: 3,
    title: "Early Church & Apostolic Age",
    description: "From Pentecost through the spread of Christianity",
    events: [
      { event: "Day of Pentecost", date: "~AD 30", description: "The Holy Spirit falls on the disciples; 3,000 are saved", scripture: "Acts 2" },
      { event: "Stoning of Stephen", date: "~AD 34", description: "Stephen becomes the first Christian martyr", scripture: "Acts 7:54-60" },
      { event: "Conversion of Paul", date: "~AD 34", description: "Saul encounters the risen Christ on the road to Damascus", scripture: "Acts 9:1-19" },
      { event: "Gospel to the Gentiles", date: "~AD 40", description: "Peter's vision leads to Cornelius's household receiving the Spirit", scripture: "Acts 10" },
      { event: "Paul's First Journey", date: "~AD 47-48", description: "Paul and Barnabas plant churches in Cyprus and Asia Minor", scripture: "Acts 13-14" },
      { event: "Council of Jerusalem", date: "~AD 49", description: "Church leaders decide Gentiles need not follow the Law of Moses", scripture: "Acts 15" },
      { event: "Paul's Second Journey", date: "~AD 49-52", description: "Paul brings the gospel to Europe: Philippi, Thessalonica, Corinth", scripture: "Acts 15:36-18:22" },
      { event: "Paul's Third Journey", date: "~AD 53-57", description: "Paul strengthens churches in Asia Minor and Greece; writes Romans", scripture: "Acts 18:23-21:17" },
      { event: "Paul's Arrest & Trials", date: "~AD 57-59", description: "Paul is arrested in Jerusalem and appeals to Caesar", scripture: "Acts 21-26" },
      { event: "Paul Arrives in Rome", date: "~AD 60", description: "Paul reaches Rome under house arrest; preaches freely", scripture: "Acts 28" },
      { event: "Destruction of the Temple", date: "AD 70", description: "Roman armies destroy Jerusalem and the Second Temple", scripture: "Matthew 24:1-2 (prophesied)" },
      { event: "John Writes Revelation", date: "~AD 95", description: "The apostle John receives the Revelation on the island of Patmos", scripture: "Revelation 1:9-11" }
    ]
  }
];

export default function BibleMaps() {
  // Centralised auth — drives both `user` and the loading state.
  const { user, isLoadingAuth: loading } = useAuth();
  const [selectedJourney, setSelectedJourney] = useState(biblicalJourneys[0]);
  const [selectedTimeline, setSelectedTimeline] = useState(biblicalTimelines[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [viewMode, setViewMode] = useState("preset"); // "preset", "search"
  const [presetTab, setPresetTab] = useState("journeys"); // "journeys", "timelines"

  const isPremium = user?.subscription_tier === 'premium' || 
                    user?.premium_override === true ||
                    (user?.premium_until && new Date(user.premium_until) > new Date());

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    setIsSearching(true);
    setSearchResult(null);

    try {
      // First, determine what type of query this is
      const classificationPrompt = `Analyze this biblical search query and classify it into one of these types:
1. "location" - queries about places, maps, geographical locations (e.g., "Garden of Eden location", "where is Mount Sinai")
2. "timeline" - queries about chronological events, sequences, prophecy timelines (e.g., "timeline of exodus", "rapture to judgment")
3. "visual" - queries about appearance, how something looks, descriptions (e.g., "what does a cherubim look like", "show me the tabernacle")

Query: "${searchQuery}"

Respond with just one word: location, timeline, or visual`;

      const classification = await api.integrations.Core.InvokeLLM({
        system_prompt: LARRY_SYSTEM_PROMPT,
        prompt: classificationPrompt
      });

      const queryType = classification.toLowerCase().trim();

      if (queryType.includes('location')) {
        // Generate map data
        const mapPrompt = `Based on the query "${searchQuery}", provide biblical and scholarly information about relevant locations. Include 3-5 locations with:
1. Name of the location
2. Approximate latitude and longitude (use scholarly consensus)
3. Brief description and biblical significance
4. Scripture references if applicable

Format as JSON:
{
  "title": "Brief title for this search",
  "description": "2-3 sentence overview",
  "locations": [
    {
      "name": "Location Name",
      "lat": 31.7,
      "lng": 35.2,
      "description": "Description and biblical significance",
      "scripture": "Genesis 2:8-14"
    }
  ]
}`;

        const mapData = await api.integrations.Core.InvokeLLM({
          system_prompt: LARRY_SYSTEM_PROMPT,
          prompt: mapPrompt,
          response_json_schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              locations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    lat: { type: "number" },
                    lng: { type: "number" },
                    description: { type: "string" },
                    scripture: { type: "string" }
                  }
                }
              }
            }
          }
        });

        setSearchResult({
          type: "location",
          data: { ...mapData, color: "#f59e0b" }
        });

      } else if (queryType.includes('timeline')) {
        // Generate timeline data
        const timelinePrompt = `Based on the query "${searchQuery}", create a biblical timeline with 5-8 key events. Include:
1. Event name
2. Approximate date or time period (BC/AD or relative timing)
3. Brief description
4. Scripture references if applicable

Format as JSON:
{
  "title": "Title for this timeline",
  "description": "Overview of this timeline",
  "events": [
    {
      "event": "Event name",
      "date": "Date or time period",
      "description": "What happened",
      "scripture": "Scripture reference"
    }
  ]
}`;

        const timelineData = await api.integrations.Core.InvokeLLM({
          system_prompt: LARRY_SYSTEM_PROMPT,
          prompt: timelinePrompt,
          response_json_schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              events: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    event: { type: "string" },
                    date: { type: "string" },
                    description: { type: "string" },
                    scripture: { type: "string" }
                  }
                }
              }
            }
          }
        });

        setSearchResult({
          type: "timeline",
          data: timelineData
        });

      } else if (queryType.includes('visual')) {
        // Generate visual description and image
        const descriptionPrompt = `Based on the query "${searchQuery}", provide a detailed biblical description. Include:
1. Physical appearance based on biblical text
2. Symbolic meaning
3. Scripture references
4. Historical/theological context

Be detailed and descriptive for creating a visual representation.`;

        const description = await api.integrations.Core.InvokeLLM({
          system_prompt: LARRY_SYSTEM_PROMPT,
          prompt: descriptionPrompt
        });

        // Generate image
        const imagePrompt = `Biblical illustration: ${searchQuery}. Detailed, reverent, historically accurate artistic depiction based on Scripture. High quality, appropriate for religious study.`;

        const imageResult = await api.integrations.Core.GenerateImage({
          prompt: imagePrompt
        });

        setSearchResult({
          type: "visual",
          data: {
            title: searchQuery,
            description: description,
            imageUrl: imageResult.url
          }
        });
      }

      setViewMode("search");
      toast.success("Search complete!");

    } catch (error) {
      console.error("Search error:", error);
      toast.error("Failed to process search. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleBackToPresets = () => {
    setViewMode("preset");
    setSearchResult(null);
    setSearchQuery("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!isPremium) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-8 text-white text-center">
            <MapPin className="w-16 h-16 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-4">Biblical Visual Explorer</h2>
            <p className="text-lg mb-6">
              Explore biblical locations, timelines, and visual aids with AI-powered search.
            </p>
            <Link to={createPageUrl('Pricing')}>
              <Button className="bg-white text-indigo-600 hover:bg-gray-100">
                <Crown className="w-4 h-4 mr-2" />
                Upgrade to Premium
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto" data-print-full-width data-print-section>
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <MapPin className="w-8 h-8 text-blue-500" />
              Biblical Visual Explorer
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Search for locations, timelines, and visual aids from Scripture.
            </p>
          </div>
          <PrintButton label="Print View" className="w-fit shrink-0" />
        </div>

        {/* AI Search Bar */}
        <Card className="shadow-lg mb-6" data-print-hidden>
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  placeholder='Try: "Garden of Eden location" or "Timeline of end times" or "What does a cherubim look like"'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="text-base"
                />
              </div>
              <Button 
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              <Badge variant="outline" className="cursor-pointer" onClick={() => setSearchQuery("possible locations of the Garden of Eden")}>
                <MapPin className="w-3 h-3 mr-1" />
                Garden of Eden
              </Badge>
              <Badge variant="outline" className="cursor-pointer" onClick={() => setSearchQuery("timeline from rapture to great white throne judgment")}>
                <Calendar className="w-3 h-3 mr-1" />
                End Times Timeline
              </Badge>
              <Badge variant="outline" className="cursor-pointer" onClick={() => setSearchQuery("what does a cherubim look like")}>
                <ImageIcon className="w-3 h-3 mr-1" />
                Cherubim Appearance
              </Badge>
              <Badge variant="outline" className="cursor-pointer" onClick={() => setSearchQuery("locations of the seven churches in Revelation")}>
                <MapPin className="w-3 h-3 mr-1" />
                Seven Churches
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Search Results */}
        {viewMode === "search" && searchResult && (
          <div className="space-y-6">
            <Button variant="outline" onClick={handleBackToPresets} data-print-hidden>
              ← Back to Preset Journeys
            </Button>

            {searchResult.type === "location" && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" data-print-layout>
                <div className="lg:col-span-1">
                  <Card className="shadow-lg" data-print-break-inside-avoid>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-orange-500" />
                        Search Results
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-semibold text-lg">{searchResult.data.title}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{searchResult.data.description}</p>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-medium flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            Locations ({searchResult.data.locations.length})
                          </h4>
                          {searchResult.data.locations.map((location, index) => (
                            <div key={index} className="p-2 bg-gray-50 dark:bg-gray-800 rounded break-words">
                              <div className="font-medium text-sm break-words">{location.name}</div>
                              <div className="text-xs text-gray-600 dark:text-gray-400 break-words">{location.description}</div>
                              {location.scripture && (
                                <Badge variant="outline" className="text-xs mt-1 break-words">
                                  {location.scripture}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                <div className="lg:col-span-3">
                  <Card className="shadow-lg h-full" data-print-break-inside-avoid>
                    <CardHeader>
                      <CardTitle>{searchResult.data.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <InteractiveMap journey={searchResult.data} />
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {searchResult.type === "timeline" && (
              <Card className="shadow-lg" data-print-break-inside-avoid>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-500" />
                    {searchResult.data.title}
                  </CardTitle>
                  <CardDescription>{searchResult.data.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <TimelineViewer events={searchResult.data.events} />
                </CardContent>
              </Card>
            )}

            {searchResult.type === "visual" && (
              <Card className="shadow-lg" data-print-break-inside-avoid>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-purple-500" />
                    {searchResult.data.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <SafeImg
                        src={searchResult.data.imageUrl}
                        alt={searchResult.data.title}
                        className="w-full rounded-lg shadow-md"
                      />
                    </div>
                    <div className="prose dark:prose-invert max-w-none">
                      <h3 className="text-xl font-semibold mb-4">Biblical Description</h3>
                      <div className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                        {searchResult.data.description}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Preset Content (Journeys & Timelines) */}
        {viewMode === "preset" && (
          <div>
            {/* Tab toggle for journeys vs timelines */}
            <div className="flex gap-2 mb-6 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit" data-print-hidden>
              <Button
                variant={presetTab === "journeys" ? "default" : "ghost"}
                size="sm"
                onClick={() => setPresetTab("journeys")}
              >
                <Navigation className="w-4 h-4 mr-1" />
                Map Journeys
              </Button>
              <Button
                variant={presetTab === "timelines" ? "default" : "ghost"}
                size="sm"
                onClick={() => setPresetTab("timelines")}
              >
                <Clock className="w-4 h-4 mr-1" />
                Timelines
              </Button>
            </div>

            {/* Journeys tab */}
            {presetTab === "journeys" && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" data-print-layout>
                <div className="lg:col-span-1" data-print-hidden>
                  <Card className="shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Navigation className="w-5 h-5 text-green-500" />
                        Preset Journeys
                      </CardTitle>
                      <CardDescription>
                        Select a classic biblical journey.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {biblicalJourneys.map((journey) => (
                          <Button
                            key={journey.id}
                            variant={selectedJourney.id === journey.id ? "default" : "outline"}
                            className="w-full justify-start h-auto p-3 text-left"
                            onClick={() => setSelectedJourney(journey)}
                          >
                            <div className="flex flex-col gap-1 min-w-0 flex-1">
                              <div className="font-medium truncate">{journey.title}</div>
                              <div className="text-xs opacity-70 break-words whitespace-normal">{journey.description}</div>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="lg:col-span-3 space-y-6">
                  <Card className="shadow-lg" data-print-break-inside-avoid>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-blue-500" />
                          {selectedJourney.title}
                        </div>
                        <Badge variant="outline" style={{ color: selectedJourney.color }}>
                          {selectedJourney.locations.length} locations
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <InteractiveMap journey={selectedJourney} />
                    </CardContent>
                  </Card>

                  <Card className="shadow-lg" data-print-break-inside-avoid>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Book className="w-5 h-5 text-purple-500" />
                        Journey Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-semibold text-lg">{selectedJourney.title}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{selectedJourney.description}</p>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-medium flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            Key Locations ({selectedJourney.locations.length})
                          </h4>
                          {selectedJourney.locations.map((location, index) => (
                            <div key={index} className="p-2 bg-gray-50 dark:bg-gray-800 rounded break-words">
                              <div className="font-medium text-sm break-words">{location.name}</div>
                              <div className="text-xs text-gray-600 dark:text-gray-400 break-words">{location.description}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Timelines tab */}
            {presetTab === "timelines" && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" data-print-layout>
                <div className="lg:col-span-1" data-print-hidden>
                  <Card className="shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-blue-500" />
                        Biblical Timelines
                      </CardTitle>
                      <CardDescription>
                        Explore key events in biblical history.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {biblicalTimelines.map((timeline) => (
                          <Button
                            key={timeline.id}
                            variant={selectedTimeline.id === timeline.id ? "default" : "outline"}
                            className="w-full justify-start h-auto p-3 text-left"
                            onClick={() => setSelectedTimeline(timeline)}
                          >
                            <div className="flex flex-col gap-1 min-w-0 flex-1">
                              <div className="font-medium truncate">{timeline.title}</div>
                              <div className="text-xs opacity-70 break-words whitespace-normal">
                                {timeline.events.length} events
                              </div>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="lg:col-span-3">
                  <Card className="shadow-lg" data-print-break-inside-avoid>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-blue-500" />
                        {selectedTimeline.title}
                      </CardTitle>
                      <CardDescription>{selectedTimeline.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <TimelineViewer events={selectedTimeline.events} />
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
