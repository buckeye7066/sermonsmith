import React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowRight } from "lucide-react";

export default function NTOnlyAlert({ translationName, currentBook, onSwitchToMatthew }) {
  return (
    <Alert className="mb-6 bg-amber-50 border-amber-200">
      <BookOpen className="w-4 h-4 text-amber-600" />
      <AlertDescription className="text-amber-800 flex flex-col sm:flex-row sm:items-center gap-3">
        <span>
          <strong>{translationName || "This translation"}</strong> only contains New Testament books. 
          "{currentBook}" is in the Old Testament.
        </span>
        <Button 
          size="sm" 
          variant="outline"
          onClick={onSwitchToMatthew}
          className="border-amber-400 text-amber-700 hover:bg-amber-100 whitespace-nowrap"
        >
          Switch to Matthew <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}