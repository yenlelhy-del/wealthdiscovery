'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('KYC form does not persist or restore browser drafts',()=>{
const content=fs.readFileSync(path.join(__dirname,'..','public','index.html'),'utf8');
assert.doesNotMatch(content,/localStorage\.setItem\(/);
assert.doesNotMatch(content,/localStorage\.getItem\(/);
assert.match(content,/localStorage\.removeItem\('finpeace-wealth-discovery-draft'\)/);
});
