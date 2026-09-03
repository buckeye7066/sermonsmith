import React, { useEffect, useState } from "react";
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
import { Share2, Copy, Check, ExternalLink, Loader2, Link2Off } from "lucide-react";
import { api } from '@/api/apiClient';
import { toast } from "sonner";

export default function ShareDialog({ open, onClose, resourceType, resourceId, title }) {
  const [shareUrl, setShareUrl] = useState('');
  const [shareLinkId, setShareLinkId] = useState(null);
  const [activeLinks, setActiveLinks] = useState([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [revokingId, setRevokingId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareTitle, setShareTitle] = useState(title || '');
  const [description, setDescription] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('');

  useEffect(() => {
    if (!open || !resourceId) return;
    setLinksLoading(true);
    api.functions.shareLinks(resourceId)
      .then((result) => setActiveLinks(result?.links || []))
      .catch((error) => {
        console.error('Error loading share links:', error);
        toast.error('Could not load existing share links');
      })
      .finally(() => setLinksLoading(false));
  }, [open, resourceId]);

  const handleGenerateLink = async () => {
    setIsGenerating(true);
    try {
      const result = await api.functions.invoke('createShareableLink', {
        resourceType,
        resourceId,
        title: shareTitle,
        description,
        accessLevel: 'view',
        expiresInDays: expiresInDays.trim() !== '' ? parseInt(expiresInDays) : null
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setShareUrl(result.shareUrl);
      setShareLinkId(result.id);
      setActiveLinks((current) => [result, ...current.filter((link) => link.id !== result.id)]);
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

  const handleRevokeLink = async (linkId) => {
    setRevokingId(linkId);
    try {
      await api.functions.revokeShareableLink(linkId);
      setActiveLinks((current) => current.filter((link) => link.id !== linkId));
      if (shareLinkId === linkId) {
        setShareLinkId(null);
        setShareUrl('');
      }
      toast.success('Share link revoked');
    } catch (error) {
      console.error('Error revoking share link:', error);
      toast.error(error?.message || 'Failed to revoke share link');
    } finally {
      setRevokingId(null);
    }
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
                  <Input value="View Only" readOnly />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Expires In (Days)</label>
                  <Input
                    type="number"
                    placeholder="Never"
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(e.target.value)}
                    min="1"
                    max="365"
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
                  <li>• Access level: <strong>View Only</strong></li>
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
                  variant="destructive"
                  onClick={() => handleRevokeLink(shareLinkId)}
                  disabled={!shareLinkId || revokingId === shareLinkId}
                >
                  {revokingId === shareLinkId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2Off className="mr-2 h-4 w-4" />}
                  Revoke
                </Button>
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

          <div className="border-t pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-medium">Active links</h4>
              {linksLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
            {!linksLoading && activeLinks.length === 0 ? (
              <p className="text-sm text-gray-500">No active share links.</p>
            ) : (
              <div className="max-h-40 space-y-2 overflow-y-auto">
                {activeLinks.map((link) => (
                  <div key={link.id} className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{link.title || title || resourceType}</p>
                      <p className="text-xs text-gray-500">
                        {link.expiresAt ? `Expires ${new Date(link.expiresAt).toLocaleDateString()}` : 'Does not expire'}
                        {` • ${Number(link.views || 0)} views`}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeLink(link.id)}
                      disabled={revokingId === link.id}
                    >
                      {revokingId === link.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
                      <span className="sr-only">Revoke link</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
