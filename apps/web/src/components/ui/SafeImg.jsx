import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';

export function SafeImg({ fallback, onError, alt = 'image', useFallbackIcon = false, ...props }) {
  const [src, setSrc] = useState(props.src);
  const [hasError, setHasError] = useState(false);

  const handleError = (e) => {
    if (fallback && src !== fallback) {
      setSrc(fallback);
    } else {
      setHasError(true);
    }
    onError?.(e);
  };

  // If image failed and we should use an icon fallback
  if (hasError && useFallbackIcon) {
    return (
      <div 
        className={props.className} 
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <BookOpen className="w-full h-full text-blue-600" />
      </div>
    );
  }

  return (
    <img
      {...props}
      src={src}
      onError={handleError}
      alt={alt}
    />
  );
}