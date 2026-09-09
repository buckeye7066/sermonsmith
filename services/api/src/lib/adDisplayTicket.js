import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
const hmac = value => createHmac('sha256',process.env.JWT_SECRET).update(value).digest('hex');
export const adViewer = userId => hmac(`ads-only:${userId}`);
export function createDisplayTicket(adId,userId,now=Date.now()) {
  const payload=Buffer.from(JSON.stringify({adId,viewer:adViewer(userId),issuedAt:now,nonce:randomUUID()})).toString('base64url');
  return `${payload}.${hmac(`ad-display:${payload}`)}`;
}
export function verifyDisplayTicket(ticket,adId,userId,kind,now=Date.now()) {
  if(typeof ticket!=='string'||ticket.length>1000) return null;
  const [payload,signature,...extra]=ticket.split('.');
  if(extra.length||!/^[a-f0-9]{64}$/.test(signature||'')) return null;
  const expected=hmac(`ad-display:${payload}`);
  if(!timingSafeEqual(Buffer.from(signature),Buffer.from(expected))) return null;
  try {
    const data=JSON.parse(Buffer.from(payload,'base64url').toString());
    const age=now-data.issuedAt;
    if(data.adId!==adId||data.viewer!==adViewer(userId)||!Number.isFinite(age)||age<(kind==='impression'?1000:0)||age>120000||typeof data.nonce!=='string') return null;
    return data;
  }catch{return null;}
}
