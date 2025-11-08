import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, BookOpen } from "lucide-react";

export default function TimelineViewer({ events }) {
  return (
    <div className="space-y-6">
      {events.map((event, index) => (
        <div key={index} className="relative pl-8 pb-8 border-l-2 border-blue-300 dark:border-blue-700">
          {/* Timeline dot */}
          <div className="absolute -left-3 top-0 w-6 h-6 rounded-full bg-blue-500 border-4 border-white dark:border-gray-900 shadow-md" />
          
          {/* Event card */}
          <Card className="ml-4 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="pt-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {event.event}
                </h3>
                <Badge variant="secondary" className="flex items-center gap-1 ml-2">
                  <Calendar className="w-3 h-3" />
                  {event.date}
                </Badge>
              </div>
              
              <p className="text-gray-600 dark:text-gray-300 mb-3">
                {event.description}
              </p>
              
              {event.scripture && (
                <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                  <BookOpen className="w-4 h-4" />
                  <span className="font-medium">{event.scripture}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}