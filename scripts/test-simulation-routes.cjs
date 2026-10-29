'use strict';
// Integration checks read the app's actual geometry, starting positions,
// and preset function, so changing the map also changes this test.
// Only these isolated declarations run in the VM; no DOM/app bootstrap executes.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const D=require('../src/distance-math.js');
const source=fs.readFileSync(path.join(__dirname,'../src/simulation.js'),'utf8');
const dataStart=source.indexOf('  const basePositions =');
const dataEnd=source.indexOf('  const router =',dataStart);
const destinations=[{x:15,z:65},{x:88,z:30},{x:150,z:55},{x:223,z:145},{x:160,z:150},{x:78,z:115},{x:12,z:140},{x:223,z:8}]; // Fixed routing probes; motion samples random destinations.
const presetDeclaration=source.match(/  function preset\(which\) \{[\s\S]*?\n  \}/);
assert.ok(dataStart>=0&&dataEnd>dataStart&&presetDeclaration,
  'Simulation declarations changed; update this test extractor before running.');
const context={structuredClone};
vm.runInNewContext([
  source.slice(dataStart,dataEnd),
  'const state={};',
  'function pause(){} function error(){} function syncControls(){} function refresh(){}',
  presetDeclaration[0],
  "const scenarios=['far','near','detour'].map(name=>{preset(name);return {name,...structuredClone(state)};});",
  'globalThis.fixture={basePositions,defaultEdges,buildings,pond,boundary,obstacles,scenarios};'
].join('\n'),context,{timeout:1000});
const f={...JSON.parse(JSON.stringify(context.fixture)),destinations};
const router=D.createRouter({boundary:f.boundary,obstacles:f.obstacles,circles:[f.pond],gridSize:2});
const ids=Object.keys(f.basePositions);
let routeChecks=0,segmentChecks=0,groundSamples=0;

function validate(a,b) {
  assert.equal(router.pointStatus(a),'ok','Route origin must be clear ground.');
  assert.equal(router.pointStatus(b),'ok','Route destination must be clear ground.');
  const result=router.route(a,b);
  assert.equal(result.status,'ok','Every base position and routing probe must connect.');
  assert.ok(result.distance+1e-7>=D.euclidean(a,b));
  assert.ok(Math.abs(D.pathLength(result.path)-result.distance)<1e-7);
  assert.deepEqual(result.path[0],a);assert.deepEqual(result.path.at(-1),b);
  for(let i=1;i<result.path.length;i++) {
    const p=result.path[i-1],q=result.path[i];
    assert.ok(router.segmentClear(p,q));segmentChecks++;
    // Independent analytical checks: do not rely solely on the router's own
    // collision function to prove that the generated motion avoids obstacles.
    for(let k=0;k<=200;k++) {
      const t=k/200,v={x:p.x+(q.x-p.x)*t,z:p.z+(q.z-p.z)*t};
      const minX=Math.min(...f.boundary.map(p=>p[0])),maxX=Math.max(...f.boundary.map(p=>p[0]));
      const minZ=Math.min(...f.boundary.map(p=>p[1])),maxZ=Math.max(...f.boundary.map(p=>p[1]));
      assert.ok(v.x>=minX-1e-7&&v.x<=maxX+1e-7&&v.z>=minZ-1e-7&&v.z<=maxZ+1e-7,'Route left the rectangular plaza.');
      assert.ok(Math.hypot(v.x-f.pond.x,v.z-f.pond.z)>=f.pond.radius-1e-7,'Route entered the pond.');
      for(const building of f.buildings)assert.ok(!(v.x>building.x+1e-7&&v.x<building.x+building.w-1e-7&&v.z>building.z+1e-7&&v.z<building.z+building.h-1e-7),'Route entered a building.');
      groundSamples++;
    }
  }
  routeChecks++;return result;
}

for(const a of ids)for(const b of ids)validate(f.basePositions[a],f.basePositions[b]);
for(const a of ids)for(const target of f.destinations)validate(f.basePositions[a],target);
for(const a of f.destinations)for(const b of f.destinations)validate(a,b);
const stories=f.scenarios.map(s=>({
  name:s.name,
  spatial:D.euclidean(s.positions[s.a],s.positions[s.b]),
  social:D.socialPath(ids,s.edges,s.a,s.b).distance,
  walking:validate(s.positions[s.a],s.positions[s.b]).distance
}));
const far=stories.find(s=>s.name==='far'),near=stories.find(s=>s.name==='near'),detour=stories.find(s=>s.name==='detour');
assert.ok(far.spatial>40&&far.social===1,'Far-friends example must remain spatially far and socially close.');
assert.ok(near.spatial<=40&&near.social>=3,'Nearby-strangers example must remain spatially near and socially distant.');
assert.ok(detour.walking>detour.spatial+1,'Pond example must require a genuine walking detour.');
assert.equal(D.socialPath(ids,[],ids[0],ids[1]).distance,Infinity);
assert.equal(D.socialPath(ids,[],ids[0],ids[0]).distance,0);
assert.equal(D.euclidean(f.basePositions.a,f.basePositions.a),0);
assert.ok(D.socialPath(ids,f.defaultEdges,'a','b').distance>0,'Distinct co-located people retain their social distance.');
console.log(JSON.stringify({routeChecks,segmentChecks,groundSamples,stories},null,2));
console.log('Actual simulation geometry and preset checks passed.');
