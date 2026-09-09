import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import rateLimit from 'express-rate-limit';
import { prisma, authenticateToken } from '../middleware/auth.js';
import { createDisplayTicket, verifyDisplayTicket } from '../lib/adDisplayTicket.js';
import { isAdOwner, validateAd } from '../lib/adsPolicy.js';

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const owner = (req, res, next) => isAdOwner(req) ? next() : res.status(403).json({ message: 'Owner access required' });
const today = () => new Date().toISOString().slice(0, 10);
const publicAd = (r) => ({ id: r.id, advertiser: r.advertiser, headline: r.headline, body: r.body, creative: r.creative, seconds: r.seconds });
router.use(authenticateToken);
router.use(rateLimit({ windowMs: 60000, max: 120, keyGenerator: req => req.userId, standardHeaders: true, legacyHeaders: false }));
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.get('/capabilities', (req, res) => res.json({ canManage: isAdOwner(req) }));
router.get('/', wrap(async (req, res) => {
  const day = today();
  const rows = await prisma.$queryRaw`SELECT id,advertiser,headline,body,creative,seconds FROM advertisements WHERE active AND NOT removed AND starts_at <= ${day} AND ends_at >= ${day} ORDER BY created_at,id LIMIT 100`;
  res.json(rows.map(r=>({...publicAd(r),ticket:createDisplayTicket(r.id,req.userId)})));
}));
router.get('/:id/image', wrap(async (req, res) => {
  const day = today();
  const rows = await prisma.$queryRaw`SELECT image FROM advertisements WHERE id=${req.params.id} AND NOT removed AND ((${isAdOwner(req)}) OR (active AND starts_at <= ${day} AND ends_at >= ${day}))`;
  if (!rows[0]) return res.status(404).end();
  res.set('Content-Type', 'image/webp').set('X-Content-Type-Options', 'nosniff').send(Buffer.from(rows[0].image));
}));
router.post('/:id/events', wrap(async (req, res) => {
  const kind = req.body?.kind;
  if (!['impression', 'click'].includes(kind)) return res.status(400).json({ message: 'Invalid event' });
  const proof = verifyDisplayTicket(req.body?.ticket,req.params.id,req.userId,kind);
  if (!proof) return res.status(400).json({ message: 'Advertisement display proof expired or invalid' });
  const day = today();
  const rows = await prisma.$queryRaw`SELECT url FROM advertisements WHERE id=${req.params.id} AND active AND NOT removed AND starts_at <= ${day} AND ends_at >= ${day}`;
  if (!rows[0]) return res.status(404).json({ message: 'Advertisement is no longer active' });
  // The keyed pseudonym cannot reveal an account ID and is never returned to
  // the owner. A DB unique key deduplicates across reloads and API replicas.
  const viewer = proof.viewer;
  const bucket = BigInt(Math.floor(Date.now() / 60000));
  const n = await prisma.$executeRaw`INSERT INTO advertisement_events(ad_id,viewer,kind,bucket,day,ticket) VALUES (${req.params.id},${viewer},${kind},${bucket},${day},${proof.nonce}) ON CONFLICT DO NOTHING`;
  res.json({ counted: n > 0, ...(kind === 'click' ? { url: rows[0].url } : {}) });
}));
router.get('/owner/list', owner, wrap(async (_req, res) => {
  const rows = await prisma.$queryRaw`SELECT id,advertiser,headline,body,creative,url,seconds,active,starts_at,ends_at,removed FROM advertisements ORDER BY created_at DESC LIMIT 500`;
  const counts = await prisma.$queryRaw`SELECT ad_id,day,kind,COUNT(*)::integer AS n,COUNT(DISTINCT viewer)::integer AS viewers FROM advertisement_events GROUP BY ad_id,day,kind ORDER BY day DESC`;
  const totals = await prisma.$queryRaw`SELECT ad_id,COUNT(*) FILTER (WHERE kind='impression')::integer AS impressions,COUNT(*) FILTER (WHERE kind='click')::integer AS clicks,COUNT(DISTINCT viewer) FILTER (WHERE kind='impression')::integer AS viewers FROM advertisement_events GROUP BY ad_id`;
  res.json(rows.map(r => ({...r, startsAt:r.starts_at, endsAt:r.ends_at, stats:totals.find(t=>t.ad_id===r.id) || {impressions:0,clicks:0,viewers:0}, daily:counts.filter(t=>t.ad_id===r.id).map(({day,kind,n,viewers})=>({day,kind,n,viewers}))})));
}));
async function imageBytes(value) {
  if (typeof value !== 'string' || value.length > 1500000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)) throw Object.assign(new Error('Upload a PNG, JPEG or WebP image under 1 MB'), {status:400});
  const bytes = Buffer.from(value.slice(value.indexOf(',')+1), 'base64');
  if (bytes.length > 1048576) throw Object.assign(new Error('Image exceeds 1 MB'), {status:400});
  try {
    const decoder = sharp(bytes, {limitInputPixels: 16000000, animated:false});
    const metadata = await decoder.metadata();
    if (!['png','jpeg','webp'].includes(metadata.format)) throw new Error('Unsupported image');
    return await decoder.rotate().resize({width:1600,height:1000,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
  } catch { throw Object.assign(new Error('The file is not a valid raster image'), {status:400}); }
}
router.post('/owner', owner, wrap(async (req,res) => {
  const a = validateAd(req.body);
  const image = await imageBytes(req.body.image);
  const id = randomUUID();
  await prisma.$executeRaw`INSERT INTO advertisements(id,advertiser,headline,body,creative,url,seconds,active,starts_at,ends_at,image) VALUES (${id},${a.advertiser},${a.headline},${a.body},${a.creative},${a.url},${a.seconds},${a.active},${a.startsAt},${a.endsAt},${image})`;
  res.status(201).json({id});
}));
router.put('/owner/:id', owner, wrap(async (req,res) => {
  const a = validateAd(req.body);
  const image = req.body.image ? await imageBytes(req.body.image) : null;
  const n = await prisma.$executeRaw`UPDATE advertisements SET advertiser=${a.advertiser},headline=${a.headline},body=${a.body},creative=${a.creative},url=${a.url},seconds=${a.seconds},active=${a.active},starts_at=${a.startsAt},ends_at=${a.endsAt},image=COALESCE(${image}::bytea,image) WHERE id=${req.params.id} AND NOT removed`;
  res.status(n ? 200 : 404).json({updated:n>0});
}));
router.delete('/owner/:id', owner, wrap(async (req,res) => {
  // Preserve purchased-run statistics when a creative is removed.
  const n = await prisma.$executeRaw`UPDATE advertisements SET removed=TRUE,active=FALSE WHERE id=${req.params.id} AND NOT removed`;
  res.status(n ? 200 : 404).json({removed:n>0});
}));
export default router;
