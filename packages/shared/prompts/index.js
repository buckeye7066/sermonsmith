/**
 * Canonical AI prompt builders (shared by the web client AND the live
 * benchmark runner).
 *
 * Until now each page assembled its generation prompt inline, so the
 * benchmark could only approximate production prompts — improvements to the
 * UI prompts were invisible to the quality measurement. These builders are
 * the single source of truth: the page passes user choices in, the runner
 * passes scenario inputs in, and both get byte-identical prompt text.
 *
 * Builders take an `audienceLabel` (already-resolved description string),
 * never a UI enum, so non-UI callers can express arbitrary audiences.
 * All free-text user values are fenced via formatUserInputBlock.
 */

import { denominationPromptBlock } from '../denominations/index.js';

export const USER_INPUT_START = '<<<USER INPUT>>>';
export const USER_INPUT_END = '<<<END USER INPUT>>>';

export function formatUserInputBlock(label, value, fallback = 'Not specified') {
  const text = String(value ?? '').trim() || fallback;
  return `${label}:\n${USER_INPUT_START}\n${text}\n${USER_INPUT_END}`;
}

// UI audience enum → descriptive label (kept here so the dropdown and the
// prompt text can't drift).
export const AUDIENCE_CONTEXT = {
  general: 'general congregation with mixed ages and backgrounds',
  youth: 'youth group (ages 13-18), using relatable examples and contemporary language',
  young_adults: 'young adults (18-30), addressing life transitions and modern challenges',
  children: 'children (ages 6-12), using simple language, stories, and concrete examples',
  seniors: 'senior adults (60+), honoring their wisdom and life experience',
};

function interestsBlock(favoriteTopics, tailNote) {
  const topics = (favoriteTopics || []).filter(Boolean);
  if (!topics.length) return '';
  return `\n\n${formatUserInputBlock("User's areas of interest", topics.join(', '), 'None provided')}\n${tailNote}`;
}

/**
 * The Sermon Builder generation prompt (Larry, single sermon).
 */
export function buildSermonPrompt({
  topic,
  passage,
  denomination,
  tone = 'inspirational',
  audienceLabel = AUDIENCE_CONTEXT.general,
  favoriteTopics = [],
} = {}) {
  const topicContext = interestsBlock(
    favoriteTopics,
    'If relevant to the sermon topic, incorporate these perspectives naturally.',
  );

  return `IMPORTANT: NEVER invent or fabricate Bible verses. Only reference real, valid Scripture. If unsure, instruct the user to check their Bible.

You are Larry, an expert AI sermon assistant helping pastors create powerful, biblical sermons. Generate a complete sermon outline using the fenced user inputs below.

${formatUserInputBlock('Sermon topic', topic)}
${formatUserInputBlock('Anchor passage', passage)}

${denominationPromptBlock(denomination)}

Tone: ${tone}
Audience: ${audienceLabel}${topicContext}

Create a sermon that includes:
1. A compelling title that captures attention
2. A clear "Big Idea" - one memorable sentence summarizing the sermon
3. Theological notes explaining this tradition's perspective on the topic (per the denominational viewpoint above)
4. 3-4 main points, each with:
   - Point title (action-oriented)
   - Exegesis (2-3 paragraphs explaining the passage, aligned with the denominational viewpoint above)
   - Illustration (a story, example, or analogy that brings the point to life - make it ${tone} in nature, and clearly hypothetical unless source material was provided)
   - Application (ONE concrete, specific step a listener in this audience could take THIS WEEK - name what to do, when, and how; never generic advice like "pray more" or "have more faith" without saying what that looks like here - plus a reflection question)
   - 3-5 supporting scriptures that reinforce this point (vary the applications across points so they don't repeat)
5. A powerful conclusion that calls for response

Make it ${tone} in tone and perfect for ${audienceLabel}. Speak in language this specific audience uses; be biblically accurate, engaging, and practical.`;
}

/**
 * The Bible Study generation prompt (Larry).
 */
export function buildBibleStudyPrompt({
  topic,
  denomination = 'Non-Denominational',
  studyType = 'personal',
  favoriteTopics = [],
} = {}) {
  const topicContext = interestsBlock(
    favoriteTopics,
    'If these relate to the study topic, incorporate relevant perspectives.',
  );

  return `IMPORTANT: NEVER invent or fabricate Bible verses. Only reference real, valid Scripture. If unsure, instruct the user to check their Bible.

      You are Larry, a friendly and knowledgeable AI Bible study assistant. Create a comprehensive Bible study on the user-provided topic below for a ${studyType} setting.

${formatUserInputBlock('Study topic', topic)}

${denominationPromptBlock(denomination)}${topicContext}

Generate a Bible study guide that includes:
1. A clear, engaging title
2. An overview that sets context
3. 3-5 key Bible verses related to the topic
4. 4-6 study sections, each with:
   - Section title
   - Relevant scripture passage
   - Theological insights (2-3 paragraphs, aligned with ${denomination} doctrine)
   - 3-5 discussion questions that encourage deep thinking (genuinely discussable, not rhetorical)
   - Practical application for daily life (ONE concrete, specific step - what to do, when, and how; never generic advice like "pray more" without saying what that looks like for this group)
5. A conclusion that ties everything together

Make it engaging, biblically sound, and appropriate for ${studyType} study. Use clear, accessible language.`;
}
