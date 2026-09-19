import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {PassThrough,Writable} from 'node:stream'
import {runCodexSession} from './codexAppServer.mjs'
const base={system:'Trusted scientific-honesty rules.',prompt:'Untrusted task text.',format:'text',maxTokens:100,timeoutMs:1000}
function protocol({account='chatgpt',model='gpt-6-astra',tool=false,stall=false,reroute=false,answer='Complete answer'}={}) {
  const requests=[];let child
  const spawnImpl=(_exe,args,options)=>{
    child=new EventEmitter();child.pid=undefined;child.stdout=new PassThrough();child.stderr=new PassThrough();child.killed=false
    child.kill=()=>{if(!child.killed){child.killed=true;queueMicrotask(()=>child.emit('close',0,null))}return true}
    const emit=value=>child.stdout.write(JSON.stringify(value)+'\n')
    child.stdin=new Writable({write(chunk,_encoding,done){for(const line of chunk.toString().trim().split('\n')){const r=JSON.parse(line);requests.push(r);queueMicrotask(()=>{
      if(r.method==='initialize')emit({id:r.id,result:{userAgent:'fixture'}})
      if(r.method==='account/read')emit({id:r.id,result:{account:{type:account},requiresOpenaiAuth:true}})
      if(r.method==='thread/start')emit({id:r.id,result:{thread:{id:'thread-fixture',ephemeral:true},model,modelProvider:'openai',approvalPolicy:'never',sandbox:{type:'readOnly',networkAccess:false},instructionSources:[]}})
      if(r.method==='turn/start'){
        emit({id:r.id,result:{turn:{id:'turn-fixture',status:'inProgress',items:[]}}})
        if(stall)return
        if(reroute)emit({method:'model/rerouted',params:{threadId:'thread-fixture',turnId:'turn-fixture',fromModel:model,toModel:'another-model'}})
        const item=tool?{id:'tool',type:'commandExecution',command:'not permitted'}:{id:'answer',type:'agentMessage',phase:'final_answer',text:answer}
        emit({method:'item/started',params:{threadId:'thread-fixture',turnId:'turn-fixture',item}})
        emit({method:'item/completed',params:{threadId:'thread-fixture',turnId:'turn-fixture',item}})
        emit({method:'thread/tokenUsage/updated',params:{threadId:'thread-fixture',turnId:'turn-fixture',tokenUsage:{last:{inputTokens:20,cachedInputTokens:0,outputTokens:30,reasoningOutputTokens:20}}}})
        emit({method:'turn/completed',params:{threadId:'thread-fixture',turn:{id:'turn-fixture',status:'completed',items:[item],error:null}}})
      }
    })}done()},final(done){done();child.kill()}})
    return child
  }
  return {requests,spawnImpl,get child(){return child}}
}
const opts=fixture=>({env:{CODEX_HOME:process.cwd()+'/fixture-empty-home',PATH:process.env.PATH},cwd:process.cwd(),model:'gpt-6-astra',features:['shell_tool','unified_exec'],spawnImpl:fixture.spawnImpl,platform:'linux'})
test('privileged instructions and actual selected model remain separate from user text',async()=>{
 const fixture=protocol();const answer=await runCodexSession(base,opts(fixture))
 assert.equal(answer?.model,'gpt-6-astra');assert.equal(answer?.model_source,'app_server_configuration')
 assert.equal(answer?.raw,'Complete answer');assert.equal(answer?.usage.output_tokens,30)
 const thread=fixture.requests.find(r=>r.method==='thread/start');const turn=fixture.requests.find(r=>r.method==='turn/start')
 assert.equal(thread.params.developerInstructions,base.system)
 assert.equal(turn.params.input[0].text.includes(base.prompt),true)
 assert.equal(turn.params.input[0].text.includes(base.system),false)
 assert.equal(thread.params.ephemeral,true);assert.equal(thread.params.sandbox,'read-only')
 assert.equal(fixture.child.killed,true)
})
for(const [name,settings]of [['API authentication',{account:'apiKey'}],['different selected model',{model:'another-model'}],['unexpected tool execution',{tool:true}],['model reroute',{reroute:true}]]){
 test('rejects '+name+' without reporting a valid subscription result',async()=>{
  const fixture=protocol(settings);assert.equal(await runCodexSession(base,opts(fixture)),null)
  if(settings.account||settings.model)assert.equal(fixture.requests.some(r=>r.method==='turn/start'),false)
 })
}
test('pre-cancelled request starts no child',async()=>{
 const fixture=protocol();assert.equal(await runCodexSession(base,{...opts(fixture),signal:AbortSignal.abort()}),null)
 assert.equal(fixture.child,undefined)
})
test('deadline ends an unresponsive worker and yields no success',async()=>{
 const fixture=protocol({stall:true});assert.equal(await runCodexSession({...base,timeoutMs:20},opts(fixture)),null)
 assert.equal(fixture.child.killed,true)
})

for (const raw of ['[]', '[{"ok":true}]', 'null', '"text"', '1']) {
 test(`structured Codex jobs reject non-object roots: ${raw}`,async()=>{
  const fixture=protocol({answer:raw});assert.equal(await runCodexSession({...base,format:'json'},opts(fixture)),null)
 })
}
test('structured Codex jobs preserve a valid object',async()=>{
 const fixture=protocol({answer:'{"ok":true}'});assert.equal((await runCodexSession({...base,format:'json'},opts(fixture)))?.raw,'{"ok":true}')
})
for (const failure of ['spawn-error','nonzero-exit','throws']) {
 test(`Windows cleanup falls back to the owned child after taskkill ${failure}`, {timeout:2000}, async()=>{
  const child=new EventEmitter();child.pid=54321;child.stdout=new PassThrough();child.stderr=new PassThrough()
  child.stdin=new Writable({write(_chunk,_encoding,done){done()},final(done){done()}})
  let directKills=0;child.kill=()=>{directKills++;queueMicrotask(()=>child.emit('close',1));return true}
  const spawnImpl=(executable)=>{
    if(!executable.endsWith('taskkill.exe'))return child
    if(failure==='throws')throw new Error('fixture spawn failure')
    const killer=new EventEmitter()
    queueMicrotask(()=>failure==='spawn-error'?killer.emit('error',new Error('fixture')):killer.emit('close',1))
    return killer
  }
  const pending=runCodexSession({...base,timeoutMs:10},{...opts({spawnImpl}),platform:'win32'})
  let failSafeUsed=false;const failSafe=setTimeout(()=>{failSafeUsed=true;child.kill()},800)
  try{assert.equal(await pending,null);assert.equal(directKills,1);assert.equal(failSafeUsed,false)}finally{clearTimeout(failSafe)}
 })
}

test('uses supported strict configuration while keeping containment controls',async()=>{
 const fixture=protocol();let args;
 const spawnImpl=(exe,argv,options)=>{args=argv;return fixture.spawnImpl(exe,argv,options)};
 assert.ok(await runCodexSession(base,{...opts(fixture),spawnImpl}));
 assert.equal(args.includes('tools.update_plan.enabled=false'),false);
 assert.equal(args.includes('agents.enabled=false'),false);
 assert.ok(args.includes('--strict-config'));assert.ok(args.includes('forced_login_method=chatgpt'));
 assert.ok(args.includes('web_search="disabled"'));assert.ok(args.includes('shell_tool'));
});
test('never reports an output beyond the caller token budget as a completed result',async()=>{
 const fixture=protocol();assert.equal(await runCodexSession({...base,maxTokens:2},opts(fixture)),null);
});
