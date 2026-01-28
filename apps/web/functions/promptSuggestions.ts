import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * UNIFIED RESPONSE ENVELOPE:
 * All responses follow: { ok: boolean, error: string|null, data: any }
 */

const SUGGESTIONS = {
  sermon: [
    "Grace and Forgiveness",
    "Living a Life of Faith",
    "The Power of Prayer",
    "Walking in God's Love",
    "Overcoming Adversity"
  ],
  study: [
    "Fruit of the Spirit",
    "The Gospel of John",
    "Old Testament Prophecy",
    "Christian Ethics",
    "Prayer and Fasting"
  ],
  quiz: [
    "New Testament Books",
    "Life of Jesus",
    "The Apostle Paul",
    "Miracles in the Bible",
    "Old Testament Heroes"
  ]
};

async function safeRun(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  
  if (!user) {
    return { ok: false, error: 'Unauthorized', data: null };
  }

  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { type, _selfTest } = body;

  // Self-test mode
  if (_selfTest) {
    return { ok: true, selfTest: true, message: 'promptSuggestions is operational', data: null };
  }

  const suggestions = SUGGESTIONS[type] || SUGGESTIONS.sermon;

  return {
    ok: true,
    error: null,
    data: { suggestions }
  };
}

Deno.serve(async (req) => {
  try {
    const result = await safeRun(req);
    return Response.json(result);
  } catch (err) {
    console.error("[promptSuggestions] CRITICAL ERROR:", err);
    return Response.json({
      ok: false,
      error: err?.message ?? "Unknown error",
      data: null
    });
  }
});