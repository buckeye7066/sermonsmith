import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Palette, Type, Layout, Sun, Moon, RotateCcw } from "lucide-react";
import { useTheme } from "@/utils/themeContext";

const FONT_OPTIONS = [
  { value: 'system', label: 'System Default', preview: 'Aa' },
  { value: 'serif', label: 'Serif (Georgia)', preview: 'Aa' },
  { value: 'sans', label: 'Sans-serif (Inter)', preview: 'Aa' },
  { value: 'mono', label: 'Monospace (Code)', preview: 'Aa' },
  { value: 'openDyslexic', label: 'OpenDyslexic', preview: 'Aa' }
];

const FONT_SIZE_OPTIONS = [
  { value: 'small', label: 'Small', size: '14px' },
  { value: 'medium', label: 'Medium', size: '16px' },
  { value: 'large', label: 'Large', size: '18px' },
  { value: 'xlarge', label: 'Extra Large', size: '20px' }
];

const COLOR_OPTIONS = [
  { value: 'indigo', label: 'Indigo', color: '#4f46e5' },
  { value: 'blue', label: 'Blue', color: '#3b82f6' },
  { value: 'purple', label: 'Purple', color: '#9333ea' },
  { value: 'green', label: 'Green', color: '#10b981' },
  { value: 'red', label: 'Red', color: '#ef4444' },
  { value: 'orange', label: 'Orange', color: '#f97316' },
  { value: 'pink', label: 'Pink', color: '#ec4899' },
  { value: 'teal', label: 'Teal', color: '#14b8a6' }
];

const BACKGROUND_OPTIONS = [
  { value: 'solid', label: 'Solid Color', description: 'Clean, simple background' },
  { value: 'gradient', label: 'Gradient', description: 'Smooth color transition' },
  { value: 'subtle', label: 'Subtle Pattern', description: 'Light, textured look' },
  { value: 'warm', label: 'Warm Gradient', description: 'Cozy, inviting feel' },
  { value: 'cool', label: 'Cool Gradient', description: 'Fresh, calming vibe' }
];

export default function AppearanceSettings() {
  const { theme, updateTheme, resetTheme } = useTheme();

  return (
    <div className="space-y-6">
      {/* Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {theme.mode === 'light' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            Display Mode
          </CardTitle>
          <CardDescription>Choose between light and dark mode</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={theme.mode} onValueChange={(value) => updateTheme({ mode: value })}>
            <div className="grid grid-cols-2 gap-4">
              <div 
                className={`flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  theme.mode === 'light' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => theme.mode !== 'light' && updateTheme({ mode: 'light' })}
              >
                <RadioGroupItem value="light" id="light" />
                <Label htmlFor="light" className="cursor-pointer flex items-center gap-3 flex-1">
                  <Sun className="w-5 h-5" />
                  <div>
                    <div className="font-medium">Light Mode</div>
                    <div className="text-xs text-gray-500">Bright and clear</div>
                  </div>
                </Label>
              </div>

              <div 
                className={`flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  theme.mode === 'dark' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => theme.mode !== 'dark' && updateTheme({ mode: 'dark' })}
              >
                <RadioGroupItem value="dark" id="dark" />
                <Label htmlFor="dark" className="cursor-pointer flex items-center gap-3 flex-1">
                  <Moon className="w-5 h-5" />
                  <div>
                    <div className="font-medium">Dark Mode</div>
                    <div className="text-xs text-gray-500">Easy on the eyes</div>
                  </div>
                </Label>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Typography */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="w-5 h-5" />
            Typography
          </CardTitle>
          <CardDescription>Customize fonts and text size</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">Font Family</Label>
            <RadioGroup value={theme.fontFamily} onValueChange={(value) => updateTheme({ fontFamily: value })}>
              <div className="space-y-2">
                {FONT_OPTIONS.map((font) => (
                  <div
                    key={font.value}
                    className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      theme.fontFamily === font.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                    }`}
                    onClick={() => updateTheme({ fontFamily: font.value })}
                  >
                    <RadioGroupItem value={font.value} id={font.value} />
                    <Label htmlFor={font.value} className="cursor-pointer flex-1">
                      {font.label}
                    </Label>
                    <span className="text-2xl font-medium">{font.preview}</span>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="fontSize" className="mb-2 block">Base Font Size</Label>
            <Select value={theme.fontSize} onValueChange={(value) => updateTheme({ fontSize: value })}>
              <SelectTrigger id="fontSize">
                <SelectValue>{FONT_SIZE_OPTIONS.find(option => option.value === theme.fontSize)?.label || 'Default Font Size'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {FONT_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size.value} value={size.value}>
                    {size.label} ({size.size})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Color Scheme
          </CardTitle>
          <CardDescription>Choose your primary and accent colors</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">Primary Color</Label>
            <div className="grid grid-cols-4 gap-3">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => updateTheme({ primaryColor: color.value })}
                  className={`p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                    theme.primaryColor === color.value ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
                  }`}
                >
                  <div
                    className="w-full h-12 rounded mb-2"
                    style={{ backgroundColor: color.color }}
                  />
                  <p className="text-xs font-medium text-center">{color.label}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Accent Color</Label>
            <div className="grid grid-cols-4 gap-3">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => updateTheme({ accentColor: color.value })}
                  className={`p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                    theme.accentColor === color.value ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
                  }`}
                >
                  <div
                    className="w-full h-12 rounded mb-2"
                    style={{ backgroundColor: color.color }}
                  />
                  <p className="text-xs font-medium text-center">{color.label}</p>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Background */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layout className="w-5 h-5" />
            Background Style
          </CardTitle>
          <CardDescription>Choose your app background appearance</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={theme.backgroundStyle} onValueChange={(value) => updateTheme({ backgroundStyle: value })}>
            <div className="space-y-2">
              {BACKGROUND_OPTIONS.map((bg) => (
                <div
                  key={bg.value}
                  className={`flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    theme.backgroundStyle === bg.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                  }`}
                  onClick={() => updateTheme({ backgroundStyle: bg.value })}
                >
                  <RadioGroupItem value={bg.value} id={bg.value} />
                  <Label htmlFor={bg.value} className="cursor-pointer flex-1">
                    <div className="font-medium">{bg.label}</div>
                    <div className="text-xs text-gray-500">{bg.description}</div>
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>See how your customizations look</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
            <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--primary-color)' }}>
              Sample Heading
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              This is a preview of how text will appear with your selected font and size. 
              The quick brown fox jumps over the lazy dog.
            </p>
            <Button style={{ backgroundColor: 'var(--primary-color, #4f46e5)' }}>
              Primary Button
            </Button>
            <Button className="ml-2" variant="outline" style={{ borderColor: 'var(--accent-color, #3b82f6)', color: 'var(--accent-color, #3b82f6)' }}>
              Accent Button
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reset */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={resetTheme} className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4" />
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}