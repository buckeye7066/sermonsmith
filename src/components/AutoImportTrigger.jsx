import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function AutoImportTrigger() {
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    const hasTriggered = localStorage.getItem('bible_import_triggered');
    
    if (!hasTriggered && !triggered) {
      setTriggered(true);
      startImport();
    }
  }, []);

  const startImport = async () => {
    try {
      console.log('🚀 AUTO-TRIGGERING BIBLE IMPORT...');
      
      const response = await base44.functions.invoke('backgroundBibleImport', {});
      
      console.log('✅ Import response:', response.data);
      
      localStorage.setItem('bible_import_triggered', 'true');
      
      toast.success('🚀 Bible Import Started!', {
        description: 'All 51 translations downloading in background. Takes 30-45 minutes.',
        duration: 10000
      });

      toast.info('📖 Check your Bible Reader in 30-45 minutes', {
        description: 'Translations will appear as they finish downloading',
        duration: 8000
      });

    } catch (error) {
      console.error('❌ Import error:', error);
      toast.error('Failed to start import: ' + error.message);
    }
  };

  return null; // This component doesn't render anything
}