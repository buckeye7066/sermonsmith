import {it as test} from 'vitest';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createOwnerSubscription} from './ownerSubscription.js';
const env={OWNER_AI_USER_ID:'owner-id',OWNER_AI_EMAIL:'owner@example.test',OWNER_AI_BRIDGE_ENABLED:'true',OWNER_AI_BRIDGE_TOKEN:'x'.repeat(48)};
const result={ok:true,complete:true,provider:'subscription:codex',billing_mode:'subscription',model:'gpt-6-astra',model_source:'explicit_cli_argument',raw:'Fixture answer',usage:{input_tokens:8,cached_input_tokens:0,output_tokens:3}};
test('only a verified owner identity can queue subscription inference',async()=>{
 const runtime=createOwnerSubscription({env});runtime.poll({providers:{codex:'ready'}});
 await assert.rejects(runtime.complete({prompt:'public',maxTokens:100,timeoutMs:1000}),/owner/i);
 await runtime.scope(new EventEmitter(),async()=>{
  runtime.identify({id:'other',email:'owner@example.test',role:'admin'});
  assert.equal(runtime.isOwner(),false);
  runtime.identify({id:'owner-id',email:'owner@example.test',role:'admin'});
  const answer=runtime.complete({prompt:'fixture',maxTokens:100,timeoutMs:1000});
  const {job}=runtime.poll({providers:{codex:'ready'}});
  assert.ok(job);assert.equal(job.prompt,'fixture');
  assert.equal(runtime.result({id:job.id,lease:'wrong',result}),false);
  assert.equal(runtime.result({id:job.id,lease:job.lease,result}),true);
  assert.equal((await answer).billing_mode,'subscription');
  assert.equal(runtime.result({id:job.id,lease:job.lease,result}),false);
 });
});
test('cancellation revokes pending work without changing owner billing identity',async()=>{
 const runtime=createOwnerSubscription({env});const response=new EventEmitter();runtime.poll({providers:{codex:'ready'}});
 await runtime.scope(response,async()=>{
  runtime.identify({id:'owner-id',email:'owner@example.test',role:'admin'});
  const pending=runtime.complete({prompt:'fixture',maxTokens:100,timeoutMs:1000});response.emit('close');
  await assert.rejects(pending);assert.equal(runtime.isOwner(),true);
  assert.equal(runtime.poll({providers:{codex:'ready'}}).job,null);
 });
});


test('a worker cannot inject paid or incomplete model output as a subscription',async()=>{
 for(const patch of [{billing_mode:'paid_api'},{complete:false},{usage:{input_tokens:1,cached_input_tokens:0,output_tokens:100}}]){
  const runtime=createOwnerSubscription({env});runtime.poll({providers:{codex:'ready'}});
  await runtime.scope(new EventEmitter(),async()=>{
   runtime.identify({id:'owner-id',email:'owner@example.test',role:'admin'});
   const pending=runtime.complete({prompt:'fixture',maxTokens:100,timeoutMs:1000});
   const {job}=runtime.poll({providers:{codex:'ready'}});runtime.result({id:job.id,lease:job.lease,result:{...result,...patch}});
   await assert.rejects(pending,/did not complete/);
  });
 }
});
test('worker authentication and status never expose secrets or prompt text',()=>{
 const runtime=createOwnerSubscription({env});assert.equal(runtime.authorized('Bearer '+env.OWNER_AI_BRIDGE_TOKEN),true);
 assert.equal(runtime.authorized('Bearer incorrect'),false);assert.equal(runtime.authorized(null),false);
 assert.equal(JSON.stringify(runtime.status()).includes(env.OWNER_AI_BRIDGE_TOKEN),false);
});


test('parallel customer and owner requests cannot share inference authority',async()=>{
 const runtime=createOwnerSubscription({env});runtime.poll({providers:{codex:'ready'}});
 const owner=runtime.scope(new EventEmitter(),async()=>{runtime.identify({id:'owner-id',email:'owner@example.test',role:'admin'});await new Promise(r=>setImmediate(r));assert.equal(runtime.isOwner(),true);});
 const customer=runtime.scope(new EventEmitter(),async()=>{runtime.identify({id:'customer-id',email:'owner@example.test',role:'admin'});await new Promise(r=>setImmediate(r));assert.equal(runtime.isOwner(),false);await assert.rejects(runtime.complete({prompt:'customer'}),/verified owner/);});
 await Promise.all([owner,customer]);assert.equal(runtime.status().pending,0);
});
test('OpenAI-compatible owner calls preserve validated JSON and buffered stream shapes',async()=>{
 const runtime=createOwnerSubscription({env});runtime.poll({providers:{codex:'ready'}});
 await runtime.scope(new EventEmitter(),async()=>{runtime.identify({id:'owner-id',email:'owner@example.test',role:'admin'});
  const pending=runtime.openAIClient().chat.completions.create({messages:[{role:'user',content:'fixture'}],response_format:{type:'json_object'},max_tokens:100,stream:true});
  const {job}=runtime.poll({providers:{codex:'ready'}});runtime.result({id:job.id,lease:job.lease,result:{...result,raw:'{"ok":true}'}});
  const stream=await pending;assert.equal(stream.billing_mode,'subscription');const chunks=[];for await(const part of stream)chunks.push(part);assert.equal(chunks[0].choices[0].delta.content,'{"ok":true}');assert.equal(chunks[1].choices[0].finish_reason,'stop');
 });
});
