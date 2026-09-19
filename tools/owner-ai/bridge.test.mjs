import test from 'node:test'
import assert from 'node:assert/strict'
import {deliverResult} from './bridge.mjs'
test('a transient delivery error retries the same completed result without new inference',async()=>{
 let time=0;const bodies=[];const body={id:'job',lease:'lease',result:{raw:'complete'}}
 const post=async(route,value)=>{assert.equal(route,'result');bodies.push(value);if(bodies.length===1)throw new Error('temporary');return {received:true}}
 assert.equal(await deliverResult(post,body,{deadline:1000,now:()=>time,wait:async ms=>{time+=ms}}),true)
 assert.equal(bodies.length,2);assert.equal(bodies[0],bodies[1])
})
test('expired and revoked result deliveries stop without an unbounded retry loop',async()=>{
 let count=0;const post=async()=>{count++;throw Object.assign(new Error('revoked'),{status:409})}
 assert.equal(await deliverResult(post,{},{deadline:1000,now:()=>0}),false);assert.equal(count,1)
 assert.equal(await deliverResult(post,{},{deadline:0,now:()=>1}),false);assert.equal(count,1)
})

import * as sharedApi from '../../packages/shared/api/index.js';
test('shared worker transport preserves the full allowed escaped prompt envelope',async()=>{
 assert.equal(typeof sharedApi.createOwnerWorkerClient,'function');
 const job={prompt:'\u0000'.repeat(131072),system:'',maxTokens:2000};
 job.prompt='\u0000';
 job.prompt=String.fromCharCode(0).repeat(131072);
 const payload=JSON.stringify({job});assert.ok(Buffer.byteLength(payload)>196608);
 const calls=[];
 const client=sharedApi.createOwnerWorkerClient({baseUrl:'https://api.example.test',token:'fixture-only-'.repeat(4),fetchImpl:async(url,options)=>{calls.push({url,options});return new Response(payload)}});
 assert.deepEqual(await client.post('poll',{providers:{codex:'ready'}}),{job});
 assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.credentials,'omit');
 assert.equal(calls[0].url,'https://api.example.test/api/owner-ai/worker/poll');
 await assert.rejects(client.post('../other',{}),/operation/);
});
test('shared worker transport cancels oversized bodies and preserves HTTP refusal status',async()=>{
 assert.equal(typeof sharedApi.createOwnerWorkerClient,'function');
 let cancelled=false;
 const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(1048577))},cancel(){cancelled=true}});
 const client=sharedApi.createOwnerWorkerClient({baseUrl:'https://api.example.test',token:'fixture-only-'.repeat(4),fetchImpl:async()=>new Response(stream)});
 await assert.rejects(client.post('poll',{}),/limit/);assert.equal(cancelled,true);
 const refused=sharedApi.createOwnerWorkerClient({baseUrl:'https://api.example.test',token:'fixture-only-'.repeat(4),fetchImpl:async()=>new Response('',{status:403})});
 await assert.rejects(refused.post('result',{}),error=>error.status===403);
});
