import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough,Writable} from 'node:stream';
import {createOwnerSubscription} from '../../services/api/src/lib/ownerSubscription.js';
import {runChild} from './officialCli.mjs';
const env={OWNER_AI_USER_ID:'owner-id',OWNER_AI_EMAIL:'owner@example.test',OWNER_AI_BRIDGE_ENABLED:'true',OWNER_AI_BRIDGE_TOKEN:'x'.repeat(48)};
const identity={id:'owner-id',email:'owner@example.test',role:'admin'};
const result={ok:true,complete:true,provider:'subscription:codex',billing_mode:'subscription',model:'gpt-6-astra',model_source:'app_server_configuration',raw:'{}',usage:{input_tokens:8,cached_input_tokens:0,output_tokens:3}};
for(const role of ['admin','dev','owner','super_admin','user']){
 test(`subscription authority agrees with administrative role ${role}`,()=>{
  const runtime=createOwnerSubscription({env});runtime.scope(new EventEmitter(),()=>{
   runtime.identify({...identity,role});assert.equal(runtime.isOwner(),['admin','dev'].includes(role));
  });
 });
}
for(const raw of ['[]','[{"value":1}]','null','"value"']){
 test(`broker refuses non-object structured result ${raw}`,async()=>{
  const runtime=createOwnerSubscription({env});runtime.poll({providers:{codex:'ready'}});
  await runtime.scope(new EventEmitter(),async()=>{
   runtime.identify(identity);const pending=runtime.complete({prompt:'fixture',format:'json',timeoutMs:1000});
   const {job}=runtime.poll({providers:{codex:'ready'}});runtime.result({id:job.id,lease:job.lease,result:{...result,raw}});
   await assert.rejects(pending,/did not complete/);
  });
 });
}
for(const executable of ['codex','/usr/local/bin/codex','codex.exe']){
 test(`authentication metadata from ${executable} includes its stderr, not inference stderr`,async()=>{
  function spawnImpl(){const c=new EventEmitter();c.stdout=new PassThrough();c.stderr=new PassThrough();c.stdin=new Writable({write(_c,_e,done){done()},final(done){done();queueMicrotask(()=>{c.stderr.write('Logged in using ChatGPT\n');c.emit('close',0);});}});return c;}
  const status=await runChild(executable,['login','status'],{captureAuthMetadata:true,env:{},spawnImpl,platform:'linux'});
  assert.equal(status.trim(),'Logged in using ChatGPT');
  const inference=await runChild(executable,['exec'],{captureAuthMetadata:true,input:'fixture',env:{},spawnImpl,platform:'linux'});
  assert.equal(inference,'');
 });
}

test('broker refuses results whose verified output usage exceeds the requested limit',async()=>{
 const runtime=createOwnerSubscription({env});runtime.poll({providers:{codex:'ready'}});
 await runtime.scope(new EventEmitter(),async()=>{
  runtime.identify(identity);const pending=runtime.complete({prompt:'fixture',maxTokens:2,timeoutMs:1000});
  const {job}=runtime.poll({providers:{codex:'ready'}});runtime.result({id:job.id,lease:job.lease,result});
  await assert.rejects(pending,/did not complete/);
 });
});
