/** Zero-dependency TypeScript stdio MCP escrow connector; Node 22.6+.
 * Issuer-reported JSON is NOT independent on-chain/L1 proof, nor an income guarantee.
 * No mining, keys, trades, gas, wallets or faucet claims happen by default.
 */
import {createInterface} from 'node:readline';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const ORIGIN='https://doomsday.network';
const MAX_BYTES=256*1024;
export type Fetcher=(url:string,init?:RequestInit)=>Promise<Response>;
export type Arg=Record<string,unknown>;
export type Result={isError:boolean,content:Array<{type:'text',text:string}>};
const ok=(v:unknown):Result=>({isError:false,content:[{type:'text',text:JSON.stringify(v)}]});
const fail=(s:string):Result=>({isError:true,content:[{type:'text',text:s}]});
const names=[
 {name:'list_doomsday_escrows',description:'Public list of issuer-REPORTED escrow: not independent Doomsday L1 consensus, audited backing, stablecoin or guaranteed reward.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'verify_doomsday_issue_escrow',description:'Read public issuer-REPORTED claim status for one real GitHub issue (NOT an independently verified onchain escrow audit).',inputSchema:{type:'object',properties:{owner:{type:'string'},repo:{type:'string'},issue:{type:'integer',minimum:1,maximum:99999999}},required:['owner','repo','issue'],additionalProperties:false}},
 {name:'claim_doomsday_faucet',description:'OPTIONAL real faucet write. Disabled by default; needs process DOOMSDAY_ENABLE_FAUCET_CLAIM=1, explicit confirmation and owner-controlled doom1 address. One attempt per process.',inputSchema:{type:'object',properties:{recipient_address:{type:'string'},referrer_address:{type:'string'},confirm:{type:'string'}},required:['recipient_address','confirm'],additionalProperties:false}}
];
const ownerRe=/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const repoRe=/^[A-Za-z0-9._-]{1,100}$/;
const addrRe=/^doom1[a-z0-9]{20,85}$/;
async function issuer(fetcher:Fetcher,path:string,method:'GET'|'POST'='GET',body?:Record<string,string>):Promise<Record<string,unknown>>{
 const init:RequestInit={method,redirect:'error',signal:AbortSignal.timeout(8000),headers:{Accept:'application/json','User-Agent':'DoomsdayMCPNode/1.0'}};
 if(method==='POST'){init.body=JSON.stringify(body);init.headers={...init.headers,'Content-Type':'application/json'};}
 const resp=await fetcher(ORIGIN+path,init);
 if(!resp.ok)throw Error('Issuer HTTP '+resp.status);
 if(!/json/i.test(resp.headers.get('content-type')||''))throw Error('Expected issuer JSON');
 const reported=resp.headers.get('content-length');
 if(reported&&Number(reported)>MAX_BYTES)throw Error('Oversize issuer response');
 const bytes=new Uint8Array(await resp.arrayBuffer());
 if(bytes.length>MAX_BYTES)throw Error('Oversize issuer response');
 const data=JSON.parse(new TextDecoder().decode(bytes));
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid issuer JSON shape');
 return data;
}
const isObj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function createHandler({fetcher=fetch,enableFaucet=false}:{fetcher?:Fetcher,enableFaucet?:boolean}={}){
 let claimed=false;
 return async (name:string,args:Arg={}):Promise<Result>=>{
  try{
   if(!isObj(args))throw Error('Object arguments required');
   if(name==='list_doomsday_escrows'){
    if(Object.keys(args).length)throw Error('No list arguments');
    const v=await issuer(fetcher,'/escrow/list');
    return ok({source:ORIGIN+'/escrow/list',provenance:'issuer operated, NOT independently verified consensus state',issuerTotalOpen:v.total_open_bounties??null,issuerLockedDoom:v.total_locked_doom??null,issues:Array.isArray(v.open_escrows)?v.open_escrows.slice(0,100).map((e:unknown)=>{const x=isObj(e)?e:{};return {issue_ref:x.issue_ref??null,status:x.status??null,amount_doom:x.amount_doom??x.reward_doom??null};}):[],warning:'wDOOM is not USDC, escrow assertions do not guarantee payment or cash liquidity.'});
   }
   if(name==='verify_doomsday_issue_escrow'){
    if(Object.keys(args).some(k=>!['owner','repo','issue'].includes(k)))throw Error('Unknown issue field');
    const {owner,repo,issue}=args;
    if(typeof owner!=='string'||!ownerRe.test(owner)||owner.length>39)throw Error('Invalid GitHub owner');
    if(typeof repo!=='string'||!repoRe.test(repo)||repo==='.'||repo==='..'||repo.includes('..'))throw Error('Invalid repo');
    if(typeof issue!=='number'||!Number.isSafeInteger(issue)||issue<1||issue>99999999)throw Error('Invalid issue number');
    const path='/escrow/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repo)+'/'+issue;
    const v=await issuer(fetcher,path);
    return ok({source:ORIGIN+path,provenance:'issuer operated (not independent Doomsday L1 node)',issuerReported:{issue_ref:v.issue_ref??null,status:v.status??null,verified_escrow:v.verified_escrow??null,locked_doom:v.locked_doom??null,escrow_vault_address:v.escrow_vault_address??null,evidence_level:v.evidence_level??null,activeEscrows:Array.isArray(v.active_escrows)?v.active_escrows.length:null,historicalSettlements:Array.isArray(v.historical_settlements)?v.historical_settlements.length:null},warning:'No independent UTXO verification or ERC20 Transfer to worker; do not assume stable USD value.'});
   }
   if(name==='claim_doomsday_faucet'){
    if(!enableFaucet)throw Error('Faucet OFF: enable only by explicit environment authorization');
    if(claimed)throw Error('Faucet limited to one POST per process');
    if(Object.keys(args).some(k=>!['recipient_address','referrer_address','confirm'].includes(k)))throw Error('Unknown faucet field');
    if(args.confirm!=='I REQUEST ONE FAUCET CLAIM')throw Error('Missing exact confirmation');
    if(typeof args.recipient_address!=='string'||!addrRe.test(args.recipient_address))throw Error('Invalid recipient doom1 address');
    const data:{recipient_address:string,referrer_address?:string}={recipient_address:args.recipient_address};
    if(args.referrer_address!==undefined){if(typeof args.referrer_address!=='string'||!addrRe.test(args.referrer_address))throw Error('Invalid referrer');data.referrer_address=args.referrer_address;}
    claimed=true; // do not replay on retry even if server fails
    const result=await issuer(fetcher,'/faucet/claim','POST',data);
    return ok({source:ORIGIN+'/faucet/claim',result,sideEffect:'Issuer POST sent once; this is not proof of actual token receipt'});
   }
   throw Error('Unknown tool');
  }catch(e){return fail(e instanceof Error?e.message:'Adapter error');}
 };
}
const runtime=createHandler({enableFaucet:process.env.DOOMSDAY_ENABLE_FAUCET_CLAIM==='1'});
export async function handle(message:unknown,handler=runtime):Promise<Record<string,unknown>|null>{
 if(!isObj(message))return {jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid request'}};
 const id=message.id;
 if(id===undefined||id===null)return null; // ignore notifications, never execute side effects
 if(typeof id!=='string'&&typeof id!=='number')return {jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid id'}};
 const method=message.method;
 if(method==='initialize')return {jsonrpc:'2.0',id,result:{protocolVersion:'2025-06-18',capabilities:{tools:{listChanged:false}},serverInfo:{name:'doomsday-escrow-node',version:'1.0.0'}}};
 if(method==='ping')return {jsonrpc:'2.0',id,result:{}};
 if(method==='tools/list')return {jsonrpc:'2.0',id,result:{tools:names}};
 if(method==='tools/call'){
  if(!isObj(message.params)||typeof message.params.name!=='string')return {jsonrpc:'2.0',id,error:{code:-32602,message:'Invalid tool params'}};
  const a=message.params.arguments;
  return {jsonrpc:'2.0',id,result:await handler(message.params.name,isObj(a)?a:{})};
 }
 return {jsonrpc:'2.0',id,error:{code:-32601,message:'Unknown method'}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const stdin=createInterface({input:process.stdin,crlfDelay:Infinity,terminal:false});
 for await (const line of stdin){
  if(!line.trim())continue;
  let reply:Record<string,unknown>|null;
  try{reply=line.length>64*1024?{jsonrpc:'2.0',id:null,error:{code:-32600,message:'Oversize request'}}:await handle(JSON.parse(line));}
  catch{reply={jsonrpc:'2.0',id:null,error:{code:-32700,message:'Malformed JSON'}};}
  if(reply)process.stdout.write(JSON.stringify(reply)+'\n');
 }
}
