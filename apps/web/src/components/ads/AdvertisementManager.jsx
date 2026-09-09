import React, { useEffect, useState } from 'react';
import { advertisements } from '@/api/apiClient';
const fresh = () => ({advertiser:'',headline:'',body:'',creative:'',url:'',seconds:15,active:false,startsAt:new Date().toISOString().slice(0,10),endsAt:'',duration:'1w'});
const field = 'w-full rounded border p-2 bg-transparent';
export default function AdvertisementManager() {
  const [allowed,setAllowed] = useState(false);
  const [rows,setRows] = useState([]);
  const [draft,setDraft] = useState(fresh);
  const [files,setFiles] = useState([]);
  const [fileVersion,setFileVersion] = useState(0);
  const [id,setId] = useState(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const refresh = () => advertisements.list().then(setRows);
  useEffect(() => { let alive=true; advertisements.capabilities().then(r=>{if(alive){setAllowed(r.canManage);if(r.canManage) refresh().catch(()=>{});}}).catch(()=>{}); return()=>{alive=false;}; },[]);
  if (!allowed) return null;
  const change = (key,value) => setDraft(d=>({...d,[key]:value}));
  const reset = () => {setDraft(fresh());setId(null);setFiles([]);setFileVersion(v=>v+1);};
  async function save(e) {
    e.preventDefault();setBusy(true);setError('');
    let saved = 0;
    let submitted = false;
    try {
      if (!id && !files.length) throw new Error('Choose at least one picture. Each picture is a separate creative.');
      if (files.length > 10) throw new Error('Choose up to 10 pictures per upload.');
      if (files.some(file=>file.size > 1048576 || !['image/png','image/jpeg','image/webp'].includes(file.type))) throw new Error('Use PNG, JPEG or WebP files under 1 MB each.');
      for (const file of files.length ? files : [null]) {
        let image;
        if (file) {
          image = await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
        }
        submitted = true;
        await advertisements.save(id,{...draft,...(image?{image,creative:file.name}: {})});
        saved += 1;
      }
      reset();await refresh();
    } catch(e) {
      if (submitted) {
        setFiles([]);setFileVersion(v=>v+1);
        const refreshed = await refresh().then(()=>true).catch(()=>false);
        setError(`${saved} creative(s) confirmed saved. ${e.message || 'Save failed.'} ${refreshed ? 'Review the refreshed list before selecting only missing pictures again.' : 'Reload the page and review saved creatives before retrying; the last request may have completed.'}`);
      } else setError(e.message || 'Could not save advertisement.');
    } finally {setBusy(false);}
  }
  async function action(fn) {setBusy(true);setError('');try{await fn();await refresh();}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <section className="print:hidden my-6 border rounded-xl p-4 space-y-4" aria-label="Advertisement management">
    <h2 className="text-xl font-semibold">Advertisements</h2>
    <p className="text-sm">Upload pictures, set their purchased run dates, and review actual views and clicks. Each picture rotates as a separate creative.</p>
    <form onSubmit={save} className="grid sm:grid-cols-2 gap-3">
      {['advertiser','headline','body','url'].map(key=><label key={key} className="text-sm capitalize">{key === 'url' ? 'Advertiser web address' : key}<input className={field} value={draft[key]} required={key!=='body'} maxLength={key==='url'?2000:key==='body'?220:key==='advertiser'?80:90} onChange={e=>change(key,e.target.value)} type={key==='url'?'url':'text'} /></label>)}
      <label className="text-sm">Pictures (PNG, JPEG, WebP; 1 MB each)<input key={fileVersion} className={field} type="file" accept="image/png,image/jpeg,image/webp" multiple={!id} onChange={e=>setFiles(Array.from(e.target.files || []))} /></label>
      <label className="text-sm">Slide duration<select className={field} value={[15,30].includes(draft.seconds)?draft.seconds:'custom'} onChange={e=>change('seconds',e.target.value==='custom'?20:Number(e.target.value))}><option value="15">15 seconds</option><option value="30">30 seconds</option><option value="custom">Custom</option></select><input aria-label="Custom slide seconds" className={field} type="number" min="3" max="120" value={draft.seconds} onChange={e=>change('seconds',Number(e.target.value))}/></label>
      <label className="text-sm">Purchased run<select className={field} value={draft.duration} onChange={e=>change('duration',e.target.value)}><option value="1w">One week</option><option value="2w">Two weeks</option><option value="1m">One month</option><option value="custom">Custom dates</option></select></label>
      <label className="text-sm">Start date (UTC)<input className={field} type="date" required value={draft.startsAt} onChange={e=>change('startsAt',e.target.value)}/></label>
      {draft.duration==='custom' && <label className="text-sm">Last day (inclusive, UTC)<input className={field} type="date" required value={draft.endsAt} onChange={e=>change('endsAt',e.target.value)}/></label>}
      <label className="text-sm flex gap-2 items-center"><input type="checkbox" checked={draft.active} onChange={e=>change('active',e.target.checked)}/>Published during purchased dates</label>
      <div className="flex gap-3"><button className="rounded bg-indigo-600 text-white px-4 py-2" disabled={busy}>{busy?'Saving…':id?'Save creative':'Add creatives'}</button>{id && <button type="button" onClick={reset}>Cancel edit</button>}</div>
    </form>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    <div className="space-y-3">{rows.map(row=><article key={row.id} className="border rounded p-3 space-y-2">
      <h3 className="font-semibold">{row.advertiser} — {row.creative || row.headline}</h3>
      <p className="text-sm">{row.removed?'Removed':row.active?'Published':'Paused'} · {row.startsAt} through {row.endsAt} · {row.seconds}s</p>
      <p className="text-sm">{row.stats.impressions} views · {row.stats.clicks} clicks · {row.stats.viewers} unique viewers</p>
      {!row.removed && <div className="flex flex-wrap gap-4 text-sm"><button onClick={()=>{setId(row.id);setDraft({...row,duration:'custom'});setFiles([]);}}>Edit</button><button disabled={busy} onClick={()=>action(()=>advertisements.save(row.id,{...row,active:!row.active,duration:'custom'}))}>{row.active?'Pause':'Publish'}</button><button disabled={busy} onClick={()=>action(()=>advertisements.remove(row.id))}>Remove</button></div>}
      <details><summary className="text-sm cursor-pointer">Daily statistics (UTC)</summary><div className="overflow-x-auto"><table className="text-sm w-full"><thead><tr><th>Date</th><th>Event</th><th>Count</th><th>Unique viewers</th></tr></thead><tbody>{row.daily.map(d=><tr key={d.day+d.kind}><td>{d.day}</td><td>{d.kind}</td><td>{d.n}</td><td>{d.viewers}</td></tr>)}</tbody></table></div></details>
    </article>)}</div>
  </section>;
}
