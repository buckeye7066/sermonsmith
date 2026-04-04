import { Router } from 'express';
import OpenAI from 'openai';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

let _openai = null;
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw Object.assign(new Error('OpenAI API key not configured'), { status: 503 });
  }
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// LLM invocation
router.post('/invoke', authenticateToken, async (req, res, next) => {
  try {
    const openai = getOpenAI();
    const { prompt, system_prompt, response_json_schema, model, max_tokens, temperature } = req.body;

    if (!prompt) {
      return res.status(400).json({ message: 'prompt is required' });
    }

    const messages = [];
    if (system_prompt) {
      messages.push({ role: 'system', content: system_prompt });
    }
    messages.push({ role: 'user', content: prompt });

    const params = {
      model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      max_tokens: max_tokens || 4096,
      temperature: temperature ?? 0.7,
    };

    if (response_json_schema) {
      params.response_format = { type: 'json_object' };
      const schemaIdx = system_prompt ? 0 : messages.length - 1;
      messages[schemaIdx].content += `\n\nRespond ONLY with valid JSON matching this schema: ${JSON.stringify(response_json_schema)}`;
    }

    const completion = await openai.chat.completions.create(params);
    const content = completion.choices[0]?.message?.content || '';

    if (response_json_schema) {
      try {
        res.json(JSON.parse(content));
      } catch {
        res.json({ response: content });
      }
    } else {
      res.json(content);
    }
  } catch (err) {
    next(err);
  }
});

// Image generation
router.post('/image', authenticateToken, async (req, res, next) => {
  try {
    const openai = getOpenAI();
    const { prompt, size } = req.body;

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: size || '1024x1024',
    });

    res.json({ url: response.data[0].url });
  } catch (err) {
    next(err);
  }
});

// Email integration — uses the shared email service
router.post('/email', authenticateToken, async (req, res, next) => {
  try {
    const { sendEmail } = await import('../services/email.js');
    const to = req.body.to || req.body.email;
    if (!to) return res.status(400).json({ message: 'to/email is required' });
    await sendEmail({
      to,
      subject: req.body.subject || 'SermonSmith Notification',
      html: req.body.html || `<p>${req.body.body || req.body.message || ''}</p>`,
      text: req.body.text || req.body.body || req.body.message || '',
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/sms', authenticateToken, async (req, res) => {
  console.log('[SMS] Would send to:', req.body.to || req.body.phone);
  res.json({ success: true, message: 'SMS sending not yet configured — add Twilio' });
});

router.post('/upload', authenticateToken, async (req, res) => {
  res.json({ success: true, message: 'File upload not yet configured — add S3 or Cloudflare R2' });
});

router.post('/extract', authenticateToken, async (req, res) => {
  res.json({ success: true, message: 'File extraction not yet configured' });
});

export default router;
