import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Settings, Type, Palette } from "lucide-react";

const themes = [
  { id: 'light', name: 'Light', bg: 'bg-white', text: 'text-gray-900', description: 'Clean white background' },
  { id: 'dark', name: 'Dark', bg: 'bg-gray-900', text: 'text-gray-100', description: 'Easy on the eyes at night' },
  { id: 'sepia', name: 'Sepia', bg: 'bg-amber-50', text: 'text-amber-900', description: 'Warm, book-like reading' },
  { id: 'cream', name: 'Cream', bg: 'bg-yellow-50', text: 'text-gray-900', description: 'Soft, warm tone' },
  { id: 'blue', name: 'Blue', bg: 'bg-blue-50', text: 'text-blue-900', description: 'Cool and calming' }
];

export default function ReaderSettings({ open, onClose, settings, onSettingsChange }) {
  const handleFontSizeChange = (value) => {
    onSettingsChange({ ...settings, fontSize: value[0] });
  };

  const handleThemeChange = (themeId) => {
    onSettingsChange({ ...settings, theme: themeId });
  };

  const handleLineHeightChange = (value) => {
    onSettingsChange({ ...settings, lineHeight: value[0] });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Reader Settings
          </DialogTitle>
          <DialogDescription>
            Customize your reading experience
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Font Size */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Type className="w-4 h-4" />
                Font Size
              </Label>
              <span className="text-sm text-gray-600">{settings.fontSize}px</span>
            </div>
            <Slider
              value={[settings.fontSize]}
              onValueChange={handleFontSizeChange}
              min={14}
              max={28}
              step={2}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Small</span>
              <span>Medium</span>
              <span>Large</span>
            </div>
          </div>

          {/* Line Height */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Line Spacing</Label>
              <span className="text-sm text-gray-600">{settings.lineHeight}</span>
            </div>
            <Slider
              value={[settings.lineHeight]}
              onValueChange={handleLineHeightChange}
              min={1.4}
              max={2.2}
              step={0.2}
              className="w-full"
            />
          </div>

          {/* Theme */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Reading Theme
            </Label>
            <RadioGroup value={settings.theme} onValueChange={handleThemeChange}>
              <div className="space-y-2">
                {themes.map((theme) => (
                  <div
                    key={theme.id}
                    className="flex items-center space-x-3 p-3 rounded-lg border hover:border-blue-500 transition-colors cursor-pointer"
                    onClick={() => handleThemeChange(theme.id)}
                  >
                    <RadioGroupItem value={theme.id} id={theme.id} />
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-12 h-12 rounded ${theme.bg} ${theme.text} flex items-center justify-center text-xs font-medium border`}>
                        Aa
                      </div>
                      <div className="flex-1">
                        <Label htmlFor={theme.id} className="cursor-pointer font-medium">
                          {theme.name}
                        </Label>
                        <p className="text-xs text-gray-500">{theme.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          {/* Preview */}
          <div className="border rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-2">Preview</p>
            <div 
              className={`${themes.find(t => t.id === settings.theme)?.bg} ${themes.find(t => t.id === settings.theme)?.text} p-4 rounded`}
              style={{ 
                fontSize: `${settings.fontSize}px`,
                lineHeight: settings.lineHeight
              }}
            >
              "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life."
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onClose}>
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}