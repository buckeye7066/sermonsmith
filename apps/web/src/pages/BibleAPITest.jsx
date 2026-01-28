import React from "react";
import BiblePassageTest from "../components/bible/BiblePassageTest";

export default function BibleAPITest() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            📖 Bible API Test
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Testing the new on-demand Bible passage fetching system
          </p>
        </div>
        
        <BiblePassageTest />
      </div>
    </div>
  );
}