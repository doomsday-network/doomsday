import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHandler,handle,type Fetcher} from './server.mts';

const jsonResponse=(v:unknown,status=200,headers:Record<string,string>={}):Response=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json',...headers}});
const read=(x:{content:Array<{text:string}>})=>JSON.parse(x.content[0].text);

test('escrow list is strictly a pinned GET and labels issuer evidence, not USD collateral',async()=>{
 const seen:Array<{url:string,method?:string}>=[];
 const fetcher:Fetcher=async(u,init)=>{seen.push({url:u,method:init?.method});return jsonResponse({total_open_bounties:3,total_locked_doom:5500,open_escrows:[{issue_ref:'doomsday-network/doomsday#11',status:'OPEN',amount_doom:3000}]});};
 const h=createHandler({fetcher});const out=await h('list_doomsday_escrows',{});
 assert.equal(out.isError,false);
 const v=read(out);assert.equal(v.issues[0].issue_ref,'doomsday-network/doomsday#11');
 assert.match(v.provenance,/NOT independently verified/);
 assert.match(v.warning,/not USDC/);
 assert.deepEqual(seen,[{url:'https://doomsday.network/escrow/list',method:'GET'}]);
});

test('single issue GET only, the issuer escrow claim is NOT silently promoted to independent consensus',async()=>{
 const seen:string[]=[];
 const fetcher:Fetcher=async(u)=>{seen.push(u);return jsonResponse({issue_ref:'doomsday-network/doomsday#11',status:'OPEN',verified_escrow:true,locked_doom:3000,escrow_vault_address:'doom1vault',active_escrows:[{},{}],historical_settlements:[{}]});};
 const h=createHandler({fetcher});const r=await h('verify_doomsday_issue_escrow',{owner:'doomsday-network',repo:'doomsday',issue:11});
 assert.equal(r.isError,false);const v=read(r);assert.equal(v.issuerReported.locked_doom,3000);
 assert.equal(v.issuerReported.activeEscrows,2);
 assert.match(v.provenance,/not independent/);
 assert.deepEqual(seen,['https://doomsday.network/escrow/doomsday-network/doomsday/11']);
});

test('malicious issue strings, path traversal and unrecognized inputs cannot trigger network requests',async()=>{
 let calls=0;const h=createHandler({fetcher:async()=>{calls++;return jsonResponse({})}});
 for(const args of [
  {owner:'evil/redirect',repo:'repo',issue:1},
  {owner:'other',repo:'..',issue:1},
  {owner:'other',repo:'http://private.service',issue:1},
  {owner:'-invalid',repo:'valid',issue:1},
  {owner:'valid',repo:'valid',issue:-1},
  {owner:'valid',repo:'valid',issue:1.01},
  {owner:'valid',repo:'valid',issue:1,unknown:'unexpected'}
 ])assert.equal((await h('verify_doomsday_issue_escrow',args)).isError,true);
 assert.equal((await h('list_doomsday_escrows',{unexpected:true})).isError,true);
 assert.equal(calls,0);
});

test('non-JSON, HTTP errors, redirects and >256KiB payload fail safely and never claim escrow verified',async()=>{
 const scenarios:Array<Fetcher>=[
  async()=>new Response('<h1>fake escrow</h1>',{status:200,headers:{'content-type':'text/html'}}),
  async()=>jsonResponse({error:'server'},503),
  async()=>new Response('',{status:302,headers:{location:'https://unrelated.invalid/evil'}}),
  async()=>jsonResponse({blob:'x'.repeat(256*1024+16)}),
  async()=>new Response('[]',{status:200,headers:{'content-type':'application/json'}}),
  async()=>jsonResponse({valid:'payload'},200,{'content-length':'600000'})
 ];
 for(const fetcher of scenarios){const r=await createHandler({fetcher})('list_doomsday_escrows',{});assert.equal(r.isError,true,r.content[0].text);}
});

test('faucet OFF by default even with explicit-looking content; no URL, no POST',async()=>{
 let count=0;const h=createHandler({fetcher:async()=>{count++;return jsonResponse({})}});
 const r=await h('claim_doomsday_faucet',{recipient_address:'doom1'+('a'.repeat(40)),confirm:'I REQUEST ONE FAUCET CLAIM'});
 assert.equal(r.isError,true);assert.match(r.content[0].text,/OFF/);assert.equal(count,0);
});

test('faucet explicit user-enabled mode has validation, affirmative confirmation, no default referral and one POST ever',async()=>{
 const calls:Array<{url:string,method?:string,body?:string}>=[];
 const fetcher:Fetcher=async(u,init)=>{calls.push({url:u,method:init?.method,body:String(init?.body)});return jsonResponse({status:'accepted_by_test',not_real_token_credit:true});};
 const h=createHandler({enableFaucet:true,fetcher});const addr='doom1'+('a'.repeat(40));
 assert.equal((await h('claim_doomsday_faucet',{recipient_address:addr,confirm:'wrong'})).isError,true);
 assert.equal((await h('claim_doomsday_faucet',{recipient_address:'0x1234',confirm:'I REQUEST ONE FAUCET CLAIM'})).isError,true);
 assert.equal(calls.length,0);
 const reply=await h('claim_doomsday_faucet',{recipient_address:addr,confirm:'I REQUEST ONE FAUCET CLAIM'});
 assert.equal(reply.isError,false);assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://doomsday.network/faucet/claim');
 assert.equal(calls[0].method,'POST');assert.deepEqual(JSON.parse(calls[0].body||'{}'),{recipient_address:addr});
 assert.match(read(reply).sideEffect,/not proof of actual token receipt/);
 assert.equal((await h('claim_doomsday_faucet',{recipient_address:addr,confirm:'I REQUEST ONE FAUCET CLAIM'})).isError,true);
 assert.equal(calls.length,1);
});

test('MCP initializes and lists all exactly three tools; notification cannot trigger mutation',async()=>{
 const h=createHandler({fetcher:async()=>{throw Error('Should never fetch')}});
 const init=await handle({jsonrpc:'2.0',id:1,method:'initialize'},h);assert.equal((init as any)?.result?.protocolVersion,'2025-06-18');
 const list=await handle({jsonrpc:'2.0',id:2,method:'tools/list'},h);assert.equal((list as any)?.result?.tools?.length,3);
 assert.equal(await handle({jsonrpc:'2.0',method:'tools/call',params:{name:'claim_doomsday_faucet',arguments:{}}},h),null);
 const ping=await handle({jsonrpc:'2.0',id:3,method:'ping'},h);assert.deepEqual((ping as any)?.result,{});
 assert.equal((await handle({jsonrpc:'2.0',id:3,method:'unknown'},h) as any)?.error?.code,-32601);
});

test('real Node stdio JSON-RPC process speaks newline-delimited MCP without network',()=>{
 const entry=fileURLToPath(new URL('./server.mts',import.meta.url));
 const input=[{jsonrpc:'2.0',id:1,method:'initialize'},{jsonrpc:'2.0',id:2,method:'tools/list'},{jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'verify_doomsday_issue_escrow',arguments:{owner:'../',repo:'..',issue:-1}}},{jsonrpc:'2.0',id:4,method:'ping'}].map(x=>JSON.stringify(x)).join('\n')+'\n';
 const child=spawnSync(process.execPath,['--experimental-strip-types',entry],{input,encoding:'utf8',timeout:5500,env:{...process.env,DOOMSDAY_ENABLE_FAUCET_CLAIM:'0'}});
 assert.equal(child.status,0,child.stderr);
 const responses=child.stdout.trim().split('\n').map(x=>JSON.parse(x));
 assert.equal(responses.length,4);assert.equal(responses[1].result.tools.length,3);
 assert.equal(responses[2].result.isError,true);
 assert.deepEqual(responses[3].result,{});
 assert.match(child.stdout,/issuer/);
});
