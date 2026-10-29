/* Run with: node scripts/test-social-motion.cjs */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const D=require('../src/distance-math.js');
const Motion=require('../src/social-motion.js');

// Read the real plaza geometry rather than maintaining a separate, easier test map.
const source=fs.readFileSync(path.join(__dirname,'../src/simulation.js'),'utf8');
const start=source.indexOf('  const basePositions ='),end=source.indexOf('  const router =',start);
assert(start>=0&&end>start,'The actual simulation map fixture must be available.');
const fixture=vm.runInNewContext(source.slice(start,end)+';({basePositions,boundary,obstacles,pond})');
const router=D.createRouter({boundary:fixture.boundary,obstacles:fixture.obstacles,circles:[fixture.pond],gridSize:2});
const bounds={minX:0,maxX:240,minZ:0,maxZ:160},ids=Object.keys(fixture.basePositions),speed=1.4;
const clone=value=>JSON.parse(JSON.stringify(value));
const seeded=seed=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
let sweeps=0;
function setup({seed=123,positions=clone(fixture.basePositions),edges=[['a','b']],selected=['a','b'],visitors=ids}={}) {
  const engine=Motion.create({ids:visitors,router,bounds,speed,random:seeded(seed)});
  engine.sync({positions,edges,preferredPair:selected});
  return {engine,positions,visitors};
}
function checkedStep(model,dt) {
  const before=clone(model.positions);
  model.engine.step(dt);
  let moved=0;
  for(const id of model.visitors) {
    const p=model.positions[id],delta=D.euclidean(before[id],p);
    assert.equal(router.pointStatus(p),'ok',`${id} must remain on clear ground`);
    assert(router.segmentClear(before[id],p),`${id}'s complete displayed sweep must avoid buildings and the pond`);
    assert(delta<=speed*dt+1e-6,`${id} must respect the speed limit; ${delta} m in ${dt} s`);
    sweeps++;moved+=delta;
  }
  return moved;
}
function run(model,seconds,dt=.1,visit=()=>{}) {
  let moved=0;
  for(let t=0;t<seconds-1e-7;t+=dt){moved+=checkedStep(model,Math.min(dt,seconds-t));visit(t+dt);}
  return moved;
}
function matching(model) {
  const s=model.engine.status(),seen=new Set();
  for(const pair of s.pairs) {
    assert.equal(pair.ids.length,2);assert.notEqual(pair.ids[0],pair.ids[1]);
    for(const id of pair.ids){assert(!seen.has(id),'A visitor may have only one walking partner');seen.add(id);}
    assert.equal(s.agents[pair.ids[0]].partner,pair.ids[1]);
    assert.equal(s.agents[pair.ids[1]].partner,pair.ids[0]);
  }
  return s;
}

const results=[];
function test(name,fn){fn();results.push(name);console.log('PASS '+name);}

test('Direct friends close a 166.9 m separation, then share a walk for 15 minutes',()=>{
  const model=setup();
  assert(Math.abs(D.euclidean(model.positions.a,model.positions.b)-166.8832)<.001);
  let metAt=null,lastRoute=router.route(model.positions.a,model.positions.b).distance;
  run(model,75,.1,t=>{
    const status=matching(model);
    if(status.agents.a.mode==='approaching') {
      const current=router.route(model.positions.a,model.positions.b).distance;
      // Both approach along one common path; the router's independently simplified
      // shortest-route estimate can vary slightly as its grid attachments change.
      assert(current<=lastRoute+1,'Friends must make progress toward a meeting');lastRoute=current;
    } else if(status.agents.a.mode==='together'&&metAt===null)metAt=t;
  });
  assert(metAt!==null&&metAt<65,'Friends must meet without teleporting');
  let min=Infinity,max=0,travel=0,last=clone(model.positions.a);
  run(model,900,.1,()=>{
    assert.equal(model.engine.status().agents.a.mode,'together');
    const gap=D.euclidean(model.positions.a,model.positions.b);
    assert(gap<=3.15,'Companions must remain close');min=Math.min(min,gap);max=Math.max(max,gap);
    travel+=D.euclidean(last,model.positions.a);last=clone(model.positions.a);
  });
  assert(travel>900,'Companions must continue walking, not simply stop together');
  results.push(`  met at ${metAt.toFixed(1)} s; companion spacing ${min.toFixed(2)}–${max.toFixed(2)} m; traveled ${travel.toFixed(0)} m together`);
});

test('Removing the selected friendship immediately releases both people despite their other ties',()=>{
  const model=setup({edges:[['a','b'],['a','c'],['b','d']]});
  run(model,70);
  const before=clone(model.positions);
  model.engine.sync({positions:model.positions,edges:[['a','c'],['b','d']],preferredPair:['a','b']});
  assert.deepEqual(model.positions,before,'An edited relationship must never move a person instantly');
  const status=matching(model);
  for(const id of ['a','b'])assert.deepEqual(status.agents[id],{mode:'wandering',partner:null});
  run(model,90);
  assert(D.euclidean(model.positions.a,model.positions.b)>20,'The removed pair must no longer follow a shared route');
});

test('Selected nonfriends walk independently even when a friendship path connects them',()=>{
  const model=setup({edges:[['a','c'],['c','d'],['d','b']]});
  const original=clone(model.positions);
  run(model,20);
  const status=matching(model);
  for(const id of ['a','b']){assert.equal(status.agents[id].partner,null);assert.equal(status.agents[id].mode,'wandering');}
  const a={x:model.positions.a.x-original.a.x,z:model.positions.a.z-original.a.z};
  const b={x:model.positions.b.x-original.b.x,z:model.positions.b.z-original.b.z};
  assert(Math.abs(a.x*b.z-a.z*b.x)>1,'Independent walkers should not inherit one common direction');
});

test('Adding the selected tie starts a new gradual rendezvous',()=>{
  const model=setup({edges:[]});run(model,12);
  const before=clone(model.positions);
  model.engine.sync({positions:model.positions,edges:[['a','b']],preferredPair:['a','b']});
  assert.deepEqual(model.positions,before);
  assert.equal(model.engine.status().agents.a.mode,'approaching');
  run(model,140);
  assert.equal(model.engine.status().agents.a.mode,'together');
});

test('Multiple friendships, preferred-pair changes, and unrelated edits preserve exclusive partners',()=>{
  const edges=[['a','b'],['a','c'],['a','d'],['b','e'],['c','f'],['d','e']];
  const model=setup({edges,selected:['a','c']});
  assert.equal(matching(model).agents.a.partner,'c');
  run(model,8);
  const snapshot=clone(model.positions),oldStatus=model.engine.status();
  model.engine.sync({positions:model.positions,edges:[...edges,['b','d']],preferredPair:['a','c']});
  assert.deepEqual(model.positions,snapshot);
  assert.deepEqual(model.engine.status().pairs,oldStatus.pairs,'An unrelated edge must preserve current partnerships');
  model.engine.sync({positions:model.positions,edges,preferredPair:['a','d']});
  const status=matching(model);
  assert.equal(status.agents.a.partner,'d');assert.equal(status.agents.d.partner,'a');
  assert.notEqual(status.agents.c.partner,'a');
  run(model,160);matching(model);
});

test('Selecting the same person never creates a self-partner; isolated visitors keep walking',()=>{
  const model=setup({edges:[['a','b']],selected:['a','a']});
  assert.equal(matching(model).agents.a.partner,null);
  model.engine.sync({positions:model.positions,edges:[],preferredPair:['a','a']});
  const before=clone(model.positions);
  run(model,10);
  const status=matching(model);
  assert.equal(status.pairs.length,0);
  for(const id of ids){assert.equal(status.agents[id].mode,'wandering');assert.equal(status.agents[id].partner,null);assert(D.euclidean(before[id],model.positions[id])>5);}
});

test('Manual relocation and a full reset replan without stale routes or instant movement',()=>{
  const model=setup();run(model,80);
  model.positions.a={x:12,z:140};model.positions.b={x:223,z:8};
  const moved=clone(model.positions);
  model.engine.sync({positions:model.positions,edges:[['a','b']],preferredPair:['a','b']});
  assert.deepEqual(model.positions,moved);assert.equal(model.engine.status().agents.a.mode,'approaching');
  run(model,150);assert.equal(model.engine.status().agents.a.mode,'together');
  model.positions=clone(fixture.basePositions);
  model.engine.sync({positions:model.positions,edges:[['a','b']],preferredPair:['a','b']});
  assert.deepEqual(model.positions,clone(fixture.basePositions));
  assert.equal(model.engine.status().agents.a.mode,'approaching');checkedStep(model,.1);
});

test('A meeting route goes around the actual pond and remains safe with delayed frames',()=>{
  for(const dt of [.025,.4,5,20]) {
    const positions=clone(fixture.basePositions);positions.a={x:77,z:80};positions.b={x:143,z:80};
    assert(!router.segmentClear(positions.a,positions.b));
    const model=setup({positions,seed:42});
    run(model,400,dt,()=>{
      if(model.engine.status().agents.a.mode==='together')assert(D.euclidean(model.positions.a,model.positions.b)<=3.15);
    });
    assert.equal(model.engine.status().agents.a.mode,'together');
  }
});

test('Seeded runs are reproducible, zero time is inert, and invalid time is rejected',()=>{
  const a=setup({seed:77}),b=setup({seed:77});
  const original=clone(a.positions);a.engine.step(0);assert.deepEqual(a.positions,original);
  for(const dt of [.001,.031,.8,3,10,.2,50]){checkedStep(a,dt);checkedStep(b,dt);}
  assert.deepEqual(a.positions,b.positions);assert.deepEqual(a.engine.status(),b.engine.status());
  for(const bad of [-1,NaN,Infinity])assert.throws(()=>a.engine.step(bad),/finite and nonnegative/);
});

test('Coincident friends separate smoothly into a shared walk; disconnected routes wait',()=>{
  const model=setup({visitors:['a','b'],positions:{a:{x:15,z:65},b:{x:15,z:65}}});
  run(model,20);assert.equal(model.engine.status().agents.a.mode,'together');
  assert(D.euclidean(model.positions.a,model.positions.b)>2.9);
  const wallRouter=D.createRouter({boundary:[[0,0],[20,0],[20,20],[0,20]],obstacles:[[[9,-1],[11,-1],[11,21],[9,21]]],gridSize:1});
  const p={a:{x:4,z:10},b:{x:16,z:10}};
  const engine=Motion.create({ids:['a','b'],router:wallRouter,bounds:{minX:0,maxX:20,minZ:0,maxZ:20},random:seeded(1)});
  engine.sync({positions:p,edges:[['a','b']],preferredPair:['a','b']});
  engine.step(10);assert.equal(engine.status().agents.a.mode,'waiting');assert.deepEqual(p,{a:{x:4,z:10},b:{x:16,z:10}});
});

console.log(`\n${results.filter(s=>!s.startsWith('  ')).length} behavior tests passed; ${sweeps.toLocaleString()} safe sweeps checked on actual map geometry.`);
results.filter(s=>s.startsWith('  ')).forEach(s=>console.log(s));
