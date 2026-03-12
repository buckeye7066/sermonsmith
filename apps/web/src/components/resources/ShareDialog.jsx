import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Share2, Copy, Check, ExternalLink, Loader2 } from "lucide-react";
import { api } from '@/api/apiClient';
import { toast } from "sonner";

export default function ShareDialog({ open, onClose, resourceType, resourceId, title }) {
  const [shareUrl, setShareUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareTitle, setShareTitle] = useState(title || '');
  const [description, setDescription] = useState('');
  const [accessLevel, setAccessLevel] = useState('view');
  const [expiresInDays, setExpiresInDays] = useState('');

  const handleGenerateLink = async () => {
    setIsGenerating(true);
    try {
      const response = await api.functions.invoke('createShareableLink', {
        resourceType,
        resourceId,
        title: shareTitle,
        description,
        accessLevel,
        expiresInDays: expiresInDays ? parseInt(expiresInDays) : null
      });

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setShareUrl(response.data.shareUrl);
      toast.success("Share link generated!");
    } catch (error) {
      console.error('Error generating link:', error);
      toast.error("Failed to generate share link");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenLink = () => {
    window.open(shareUrl, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-500" />
            Share {resourceType}
          </DialogTitle>
          <DialogDescription>
            Create a shareable link that others can access
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!shareUrl ? (
            <>
              <div>
                <label className="text-sm font-medium mb-2 block">Title</label>
                <Input
                  placeholder="What are you sharing?"
                  value={shareTitle}
                  onChange={(e) => setShareTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Description (Optional)</label>
                <Textarea
                  placeholder="Add context for recipients..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Access Level</label>
                  <Select value={accessLevel} onValueChange={setAccessLevel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">View Only</SelectItem>
                      <SelectItem value="copy">View & Copy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Expires In (Days)</label>
                  <Input
                    type="number"
                    placeholder="Never"
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(e.target.value)}
                    min="1"
                  />
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  💡 <strong>Tip:</strong> Anyone with the link can access this {resourceType}. 
                  Set an expiration date for temporary sharing.
                </p>
              </div>

              <Button
                onClick={handleGenerateLink}
                disabled={isGenerating || !shareTitle.trim()}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Link...
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 mr-2" />
                    Generate Share Link
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Share Link</label>
                <div className="flex gap-2">
                  <Input
                    value={shareUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleOpenLink}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">
                  ✅ Link Generated Successfully!
                </h4>
                <ul className="text-sm text-green-800 dark:text-green-200 space-y-1">
                  <li>• Share this link with anyone</li>
                  <li>• Access level: <strong>{accessLevel === 'view' ? 'View Only' : 'View & Copy'}</strong></li>
                  {expiresInDays && (
                    <li>• Expires in <strong>{expiresInDays} days</strong></li>
                  )}
                  {!expiresInDays && (
                    <li>• Link <strong>never expires</strong></li>
                  )}
                </ul>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShareUrl('');
                    setShareTitle(title || '');
                    setDescription('');
                  }}
                  className="flex-1"
                >
                  Create Another
                </Button>
                <Button onClick={onClose} className="flex-1">
                  Done
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}