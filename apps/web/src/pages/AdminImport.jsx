import React, { useState } from 'react';
import { api } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Database, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [, setFile] = useState(null);

  const importFromAPI = async () => {
    setIsImporting(true);
    setProgress('Starting Bible import from bible-api.com...');
    
    try {
      const result = await api.functions.invoke('importFullBible', {
        translation: 'KJV'
      });
      
      if (result.message) {
        setProgress(result.message);
      } else {
        setProgress('Import complete');
      }

      toast.success('Bible import completed!');
    } catch (error) {
      toast.error('Import failed: ' + error.message);
      setProgress('Error: ' + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  const importFromScriptureAPI = async () => {
    setIsImporting(true);
    setProgress('Starting import from Scripture API...');
    
    try {
      const result = await api.functions.invoke('importFromScriptureAPI', {
        bibleId: 'de4e12af7f28f599-02' // KJV
      });
      
      if (result.message) {
        setProgress(result.message);
      } else {
        setProgress('Import complete');
      }

      toast.success('Scripture API import completed!');
    } catch (error) {
      toast.error('Import failed: ' + error.message);
      setProgress('Error: ' + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) {
      toast.error('No file uploaded. Please select a CSV file to upload.');
      return;
    }

    setFile(uploadedFile);
    setIsImporting(true);
    setProgress('Uploading and processing CSV file...');

    try {
      // Upload file
      
      
      // Parse CSV and extract verses
      const text = await uploadedFile.text();
      const lines = text.split('\n');
      const verses = [];
      
      // Skip header row
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Expected format: book_name,chapter,verse,text,translation
        const parts = line.split(',');
        if (parts.length >= 5) {
          verses.push({
            book_name: parts[0],
            chapter: parseInt(parts[1]),
            verse: parseInt(parts[2]),
            text: parts[3],
            translation: parts[4]
          });
        }

        // Batch insert every 100 verses
        if (verses.length >= 100) {
          try {
            await api.entities.Verse.bulkCreate(verses);
            setProgress(`Imported ${i} verses...`);
          } catch (insertError) {
            toast.error('Batch insert failed at line: ' + i + '. Error: ' + insertError.message);
            setProgress('Batch insert error: ' + insertError.message);
          }
          verses.length = 0;
        }
      }

      // Insert remaining verses
      if (verses.length > 0) {
        try {
          await api.entities.Verse.bulkCreate(verses);
        } catch (insertError) {
          toast.error('Final insert failed. Error: ' + insertError.message);
          setProgress('Final insert error: ' + insertError.message);
        }
      }

      toast.success('CSV import completed!');
      setProgress(`Successfully imported ${lines.length - 1} verses`);
    } catch (error) {
      toast.error('CSV import failed: ' + error.message);
      setProgress('Error: ' + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold mb-6">Bible Data Import (Admin Only)</h1>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Option 1: Auto-Import from Bible API
            </CardTitle>
            <CardDescription>
              Automatically import the complete KJV Bible (31,102 verses)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={importFromAPI} 
              disabled={isImporting}
              className="w-full"
            >
              {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Import Full KJV Bible
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Option 2: Import from Scripture API
            </CardTitle>
            <CardDescription>
              Requires SCRIPTURE_API_KEY environment variable. Get free API key at scripture.api.bible
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={importFromScriptureAPI} 
              disabled={isImporting}
              className="w-full"
              variant="outline"
            >
              {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Import via Scripture API
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Option 3: Upload CSV File
            </CardTitle>
            <CardDescription>
              Upload a CSV file with format: book_name,chapter,verse,text,translation
              <br />
              Download sample CSVs from: https://github.com/scrollmapper/bible_databases
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input 
              type="file" 
              accept=".csv"
              onChange={handleFileUpload}
              disabled={isImporting}
            />
            <div className="text-sm text-gray-500">
              <strong>CSV Format Example:</strong>
              <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded mt-2">
{`book_name,chapter,verse,text,translation
Genesis,1,1,In the beginning God created the heaven and the earth.,KJV
Genesis,1,2,And the earth was without form and void...,KJV`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {progress && (
          <Card className="border-blue-500">
            <CardContent className="pt-6">
              <p className="text-sm font-mono">{progress}</p>
            </CardContent>
          </Card>
        )}

        <Card className="bg-yellow-50 dark:bg-yellow-900/20">
          <CardHeader>
            <CardTitle className="text-yellow-800 dark:text-yellow-200">Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><strong>Option 1 (Easiest):</strong> Click "Import Full KJV Bible" - waits for Deno functions to deploy</p>
            <p><strong>Option 2 (Most Reliable):</strong> Set SCRIPTURE_API_KEY in Dashboard → Settings → Environment Variables, then click import</p>
            <p><strong>Option 3 (Manual):</strong> Download CSV from GitHub link above, then upload here</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
