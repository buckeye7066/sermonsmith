import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createOwnerSubscription} from '../../services/api/src/lib/ownerSubscription.js';
const env={NODE_ENV:'test',OWNER_AI_BRIDGE_ENABLED:'true',OWNER_AI_USER_ID:'fixture-owner',OWNER_AI_EMAIL:'owner@example.test'};
const identity={id:'fixture-owner',email:'owner@example.test',role:'admin'};
test('the repository developer role is an owner role only with exact owner identity',()=>{
 const bridge=createOwnerSubscription({env});
 bridge.scope(new EventEmitter(),()=>{
  bridge.identify({...identity,role:'dev'});assert.equal(bridge.isOwner(),true);
  bridge.identify({...identity,id:'different'});assert.throws(()=>bridge.isOwner(),{code:'OWNER_SUBSCRIPTION_UNAVAILABLE'});
  bridge.identify({...identity,role:'user'});assert.equal(bridge.isOwner(),false);
 });
});
for(const raw of ['[]','[1]']){
 test('the API completion boundary rejects arrays for JSON-object output: '+raw,async()=>{
  const bridge=createOwnerSubscription({env});
  await bridge.scope(new EventEmitter(),async()=>{
   bridge.identify(identity);bridge.poll({providers:{codex:'ready'}});
   const completion=bridge.complete({prompt:'fixture',format:'json'});completion.catch(()=>{});
   const job=bridge.poll({providers:{codex:'ready'}}).job;
   bridge.result({id:job.id,lease:job.lease,result:{ok:true,complete:true,provider:'subscription:codex',billing_mode:'subscription',model_source:'app_server_configuration',model:'fixture-model',raw,usage:{input_tokens:1,cached_input_tokens:0,output_tokens:2}}});
   await assert.rejects(completion,/did not complete/);
  });
 });
}
test('unsupported replicated production topology remains disabled',()=>{
 for(const replicas of [undefined,'2'])assert.equal(createOwnerSubscription({env:{...env,NODE_ENV:'production',OWNER_AI_API_REPLICAS:replicas}}).status().enabled,false);
 assert.equal(createOwnerSubscription({env:{...env,NODE_ENV:'production',OWNER_AI_API_REPLICAS:'1'}}).status().enabled,true);
});
