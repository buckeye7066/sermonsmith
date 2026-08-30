import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const colors = [
  { name: 'yellow', label: 'Yellow', class: 'bg-yellow-400' },
  { name: 'blue', label: 'Blue', class: 'bg-blue-400' },
  { name: 'green', label: 'Green', class: 'bg-green-400' },
  { name: 'pink', label: 'Pink', class: 'bg-pink-400' },
  { name: 'purple', label: 'Purple', class: 'bg-purple-400' }
];

export default function HighlightDrawer({ open, onClose, onSave, verse }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Highlight Verse</DialogTitle>
          <DialogDescription>
            {verse && (
              <Badge variant="outline">
                {verse.book_name} {verse.chapter}:{verse.verse}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {verse && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                "{verse.text}"
              </p>
            </div>
          )}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Choose highlight color:
            </p>
            <div className="grid grid-cols-5 gap-2">
              {colors.map((color) => (
                <Button
                  key={color.name}
                  variant="outline"
                  className="h-12 flex flex-col items-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => typeof onSave === 'function' && onSave(color.name)}
                >
                  <div className={`w-4 h-4 rounded-full ${color.class}`} />
                  <span className="text-xs">{color.label}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}