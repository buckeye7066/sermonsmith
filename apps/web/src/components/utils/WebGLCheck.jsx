import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { SafeImg } from '@/components/ui/SafeImg';

/**
 * WebGL availability checker and fallback component
 */
export function useWebGLAvailable() {
  const [webGLAvailable, setWebGLAvailable] = useState(true);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      setWebGLAvailable(!!gl);
    } catch (e) {
      setWebGLAvailable(false);
    }
    setChecked(true);
  }, []);

  return { webGLAvailable, checked };
}

export function WebGLFallback({ fallbackImage, altText = "3D content unavailable", children }) {
  const { webGLAvailable, checked } = useWebGLAvailable();

  if (!checked) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!webGLAvailable) {
    if (fallbackImage) {
      return (
        <div className="relative">
          <SafeImg
            src={fallbackImage}
            alt={altText}
            className="w-full h-64 object-cover rounded-lg"
          />
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
            Static Image (WebGL unavailable)
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-64 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg p-6">
        <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
        <h3 className="font-semibold text-gray-800 mb-1">3D View Unavailable</h3>
        <p className="text-gray-600 text-sm text-center">
          Your browser doesn't support 3D graphics. Please try Chrome, Safari, or Firefox.
        </p>
      </div>
    );
  }

  return children;
}

export default WebGLFallback;