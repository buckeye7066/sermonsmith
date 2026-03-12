import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Edit3, Lock, Users } from "lucide-react";
import { api } from '@/api/apiClient';
import { toast } from "sonner";

export default function CollaborativeEditor({ 
  sermon, 
  field, 
  value, 
  onChange, 
  user,
  multiline = false,
  label 
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [activeEditors, setActiveEditors] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (sermon) {
      checkLocks();
      const interval = setInterval(checkLocks, 3000); // Check every 3 seconds
      return () => clearInterval(interval);
    }
  }, [sermon, field]);

  const checkLocks = async () => {
    try {
      const edits = await api.entities.SermonEdit.filter({ 
        sermon_id: sermon.id,
        field: field
      });

      const now = new Date();
      const activeEdits = edits.filter(e => new Date(e.locked_until) > now);
      
      setActiveEditors(activeEdits);
      setIsLocked(activeEdits.some(e => e.user_id !== user.id));
    } catch (error) {
      console.error("Error checking locks:", error);
    }
  };

  const acquireLock = async () => {
    try {
      const lockUntil = new Date(Date.now() + 30000); // 30 second lock
      
      await api.entities.SermonEdit.create({
        sermon_id: sermon.id,
        user_id: user.id,
        user_name: user.full_name || user.email,
        field: field,
        locked_until: lockUntil.toISOString()
      });

      setIsEditing(true);
      startLockRenewal();
    } catch (error) {
      console.error("Error acquiring lock:", error);
      toast.error("Failed to start editing");
    }
  };

  const isEditingRef = React.useRef(false);

  React.useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  const startLockRenewal = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    const tick = async () => {
      if (!isEditingRef.current) return;
      try {
        const edits = await api.entities.SermonEdit.filter({
          sermon_id: sermon.id,
          user_id: user.id,
          field: field
        });

        for (const edit of edits) {
          const lockUntil = new Date(Date.now() + 30000);
          await api.entities.SermonEdit.update(edit.id, {
            locked_until: lockUntil.toISOString()
          });
        }
      } catch (error) {
        console.error("Error renewing lock:", error);
      }
      if (isEditingRef.current) {
        timeoutRef.current = setTimeout(tick, 20000);
      }
    };
    timeoutRef.current = setTimeout(tick, 20000);
  };

  const releaseLock = async () => {
    try {
      const edits = await api.entities.SermonEdit.filter({
        sermon_id: sermon.id,
        user_id: user.id,
        field: field
      });

      for (const edit of edits) {
        await api.entities.SermonEdit.delete(edit.id);
      }

      setIsEditing(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    } catch (error) {
      console.error("Error releasing lock:", error);
    }
  };

  const handleFocus = () => {
    if (!isLocked && !isEditing) {
      acquireLock();
    }
  };

  const handleBlur = () => {
    releaseLock();
  };

  const handleChange = (e) => {
    onChange(e.target.value);
  };

  const InputComponent = multiline ? Textarea : Input;

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">{label}</label>
          {activeEditors.length > 0 && (
            <div className="flex items-center gap-2">
              {activeEditors.map((editor) => (
                <Badge key={editor.id} variant="secondary" className="text-xs">
                  <Edit3 className="w-3 h-3 mr-1" />
                  {editor.user_name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <InputComponent
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={isLocked}
          rows={multiline ? 4 : undefined}
          className={isLocked ? "bg-gray-100 cursor-not-allowed" : ""}
        />
        
        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-90 rounded">
            <div className="flex items-center gap-2 text-sm">
              <Lock className="w-4 h-4 text-gray-600" />
              <span className="text-gray-600">
                {activeEditors[0]?.user_name} is editing
              </span>
            </div>
          </div>
        )}
      </div>

      {isEditing && (
        <p className="text-xs text-green-600">✓ You're editing this field</p>
      )}
    </div>
  );
}