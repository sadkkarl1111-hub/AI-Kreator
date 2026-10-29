import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAdGeneratorAccess } from '../dist/middleware/requireAdGeneratorAccess.js';
test('free, paid and admin accounts pass the free gate; guests remain blocked',()=>{
  for(const user of [undefined,{id:'free'},{id:'paid'},{id:'admin'}]){
    let status=200,next=0,cache;const res={set:(_key,value)=>{cache=value;},status:value=>{status=value;return res;},json:()=>{}};
    createAdGeneratorAccess()({authUser:user},res,()=>next++);
    assert.equal(status,user?200:401);assert.equal(next,user?1:0);assert.equal(cache,'no-store');
  }
});
