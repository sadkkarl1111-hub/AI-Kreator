import { test } from 'node:test';
import assert from 'node:assert/strict';
import {createAdJsonClient} from '../dist/lib/adCreativeAi.js';
test('missing or incomplete usage stays unknown, while usage is captured before JSON parse failure',async t=>{
 const events=[];let usage={};const fetchMock=t.mock.method(globalThis,'fetch',async()=>Response.json({status:'completed',usage,output:[{type:'message',content:[{type:'output_text',text:'bad JSON'}]}]}));
 const client=createAdJsonClient('fake',value=>events.push(value)),req={instructions:'test',input:'test',schema:{type:'OBJECT',properties:{}},signal:new AbortController().signal};
 await assert.rejects(client(req));assert.equal(events.length,0);
 usage={input_tokens:100};await assert.rejects(client(req));assert.equal(events.length,0);
 usage={input_tokens:100,output_tokens:20,input_tokens_details:{cached_tokens:40}};await assert.rejects(client(req));assert.equal(events[0].cachedInputTokens,40);assert.equal(events[0].outputTokens,20);
 fetchMock.mock.restore();
});
