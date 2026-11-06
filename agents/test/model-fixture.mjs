// Synthetic Responses API seam for isolated workerd tests; never imported by production entry.
export const mockModel={calls:0,mode:'normal',requests:[]};
export async function modelFetch(input,init){const request=new Request(input,init),body=await request.json();if(!request.url.endsWith('/responses'))throw Error('Unexpected model endpoint');mockModel.calls++;mockModel.requests.push({model:body.model,tools:body.tools?.map(t=>t.name),store:body.store});
 if(mockModel.mode==='hold')await new Promise(resolve=>{mockModel.release=resolve;});
 const history=body.input??[],names=history.filter(x=>x.type==='function_call').map(x=>x.name),requester=body.tools?.some(x=>x.name==='catalogue'),userText=history.filter(x=>x.role==='user').map(x=>typeof x.content==='string'?x.content:(x.content??[]).map(c=>c.text??'').join('\n')).join('\n'),extended=requester?/extended|80 credits/i.test(userText):/"mode"\s*:\s*1|"credits"\s*:\s*"?80/.test(userText);
 let name,args,final;
 if(requester){if(!names.includes('catalogue')){name='catalogue';args={};}else if(!names.includes('submit_analysis')){name='submit_analysis';args={mode:extended?1:0};}else final='Signed request submitted for independent assessment.';}
 else if(!names.includes('independent_ens_assessment')){name='independent_ens_assessment';args={};}
 else if(!names.includes('record_decision')){name='record_decision';args={accepted:!extended||mockModel.mode==='accept80',reason:extended?'Extended request exceeds the published per-request limit.':'Basic request is within the independently observed authority.'};}
 else if((!extended||mockModel.mode==='accept80')&&!names.includes('perform_analysis')){name='perform_analysis';args={};}else final=extended&&mockModel.mode!=='accept80'?'Receiver rejected this request.':'Analysis tool returned the retained deterministic result.';
 const id=crypto.randomUUID(),output=name?[{type:'function_call',id:'fc_'+id,call_id:'call_'+id,name,arguments:JSON.stringify(args),status:'completed'}]:[{type:'message',id:'msg_'+id,role:'assistant',status:'completed',content:[{type:'output_text',text:final,annotations:[]}]}];
 return new Response(JSON.stringify({id:'resp_fixture_'+id,object:'response',created_at:Math.floor(Date.now()/1000),status:'completed',model:body.model,output,usage:{input_tokens:10,output_tokens:10,total_tokens:20,input_tokens_details:{cached_tokens:0},output_tokens_details:{reasoning_tokens:0}}}),{headers:{'Content-Type':'application/json','x-request-id':'fixture_'+id}});
}
