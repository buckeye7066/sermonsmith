import React from 'react';
import Placeholder from '../components/Placeholder.jsx';
import { getPlaceholder } from '../data/placeholders.js';

// 'Present' is not fully built yet, so we show the warm, plain-language
// placeholder instead of a blank or broken page.
export default function Present() {
  const copy = getPlaceholder('/present', 'Present');
  return (
    <Placeholder
      title={copy.title}
      comingSoonMessage={copy.comingSoonMessage}
      whatYouCanDoNow={copy.whatYouCanDoNow}
    />
  );
}
