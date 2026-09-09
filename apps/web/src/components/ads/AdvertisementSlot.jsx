import React, { useEffect, useRef, useState } from 'react';
import { advertisements } from '@/api/apiClient';

export default function AdvertisementSlot() {
  const [ads, setAds] = useState([]);
  const [index, setIndex] = useState(0);
  const [image, setImage] = useState('');
  const [loadedId, setLoadedId] = useState(null);
  const [imageRetry, setImageRetry] = useState(0);
  const imageFailed = useRef(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);
  const ad = ads[index % (ads.length || 1)];
  const adId = ad?.id;
  const seconds = ad?.seconds;
  const revision = ad?.revision;
  const ticket = useRef(null);
  ticket.current = ad?.ticket;
  useEffect(() => {
    let alive = true;
    const refresh = () => advertisements.rotation().then(rows => { if (alive) { setAds(rows); if (imageFailed.current) setImageRetry(n => n + 1); } }).catch(() => { if (alive) setAds([]); });
    const resume = () => { if (document.visibilityState === 'visible') refresh(); };
    refresh(); const timer = setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', resume);
    return () => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', resume); };
  }, []);
  useEffect(() => {
    if (!adId) return;
    let alive = true; let url;
    setImage('');
    setLoadedId(null);
    imageFailed.current = false;
    advertisements.image(adId).then(blob => { url = URL.createObjectURL(blob); if (alive) setImage(url); else URL.revokeObjectURL(url); }).catch(() => { if (alive) imageFailed.current = true; });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [adId, revision, imageRetry]);
  useEffect(() => {
    if (!adId || !ref.current) return;
    let intersecting = false;
    const update = () => setVisible(intersecting && document.visibilityState === 'visible');
    const observer = new IntersectionObserver(([entry]) => { intersecting = entry.intersectionRatio >= 0.5; update(); }, {threshold:0.5});
    observer.observe(ref.current); document.addEventListener('visibilitychange', update);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, [adId]);
  useEffect(() => {
    if (!adId || !visible || !image || loadedId !== adId) return;
    // Count only after a foreground slide has been at least half visible for
    // one second. Hidden tabs and offscreen slots do not rotate or count.
    const impression = setTimeout(() => { advertisements.event(adId, 'impression', ticket.current).catch(() => {}); }, 1000);
    return () => clearTimeout(impression);
  }, [adId, visible, image, index, loadedId]);
  useEffect(() => {
    if (!adId || !visible) return;
    // A failed image must not stop the remaining purchased creatives rotating.
    const rotate = setTimeout(() => setIndex(i => i + 1), seconds * 1000);
    return () => clearTimeout(rotate);
  }, [adId, seconds, visible, index]);
  if (!ad) return null;
  async function click() {
    const target = window.open('about:blank', '_blank');
    if (target) {
      target.opener = null;
      const policy = target.document.createElement('meta');
      policy.name = 'referrer'; policy.content = 'no-referrer';
      target.document.head.appendChild(policy);
    }
    try {
      const result = await advertisements.event(ad.id, 'click', ad.ticket);
      if (/^https?:\/\//.test(result.url)) {
        if (target) target.location.replace(result.url);
        else window.location.assign(result.url);
      } else target?.close();
    } catch { target?.close(); }
  }
  return <aside ref={ref} aria-label="Advertisement" className="print:hidden my-6 rounded-xl border bg-white dark:bg-gray-900 p-4">
    <p className="text-xs text-gray-500 mb-2">Advertisement · {ad.advertiser}</p>
    <button type="button" onClick={click} className="w-full text-left flex flex-col sm:flex-row gap-4 items-start">
      {image && <img src={image} onLoad={() => { imageFailed.current = false; setLoadedId(adId); }} onError={() => { imageFailed.current = true; setLoadedId(null); }} alt={ad.creative || ad.headline} className="w-full sm:w-48 h-32 object-contain rounded" />}
      <span className="min-w-0"><strong className="block text-lg">{ad.headline}</strong><span className="block text-sm mt-1">{ad.body}</span><span className="block text-sm text-indigo-600 mt-3">Visit advertiser ↗</span></span>
    </button>
  </aside>;
}
