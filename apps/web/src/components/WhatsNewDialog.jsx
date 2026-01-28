import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, CheckCircle2, Zap, BookOpen, Users } from "lucide-react";

const CURRENT_VERSION = "2025-11-19"; // Update this when you add new features

const UPDATES = [
  {
    icon: BookOpen,
    title: "Expanded Denominations",
    description: "Now includes 50+ denominations with detailed subcategories (COGIC, AME, Southern Baptist, Freewill Baptist, and many more)",
    date: "Nov 19, 2025"
  },
  {
    icon: Zap,
    title: "Improved Sermon Saving",
    description: "Fixed sermon save functionality - all sermon data now saves correctly including conclusion and theological notes",
    date: "Nov 19, 2025"
  },
  {
    icon: Users,
    title: "Admin Tools",
    description: "New admin dashboard for user management and system monitoring",
    date: "Nov 19, 2025"
  }
];

export default function WhatsNewDialog({ open, onClose }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-600" />
            What's New in SermonSmith
          </DialogTitle>
          <DialogDescription>
            Check out the latest improvements and features
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {UPDATES.map((update, index) => {
            const Icon = update.icon;
            return (
              <div key={index} className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      {update.title}
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      {update.date}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {update.description}
                  </p>
                </div>
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose}>
            Got it, thanks!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { CURRENT_VERSION };