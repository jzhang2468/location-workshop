'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const D=require('../src/distance-math.js');
const near=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`);
const rect=(left,bottom,right,top)=>[[left,bottom],[right,bottom],[right,top],[left,top]];
const p=(x,z)=>({x,z});
let assertions=0;
function test(name,run){run();assertions++;console.log('✓ '+name);}
function checkRoute(router,a,b) {
  const result=router.route(a,b);
  assert.equal(result.status,'ok');assert.ok(Number.isFinite(result.distance));
  assert.deepEqual(result.path[0],p(...a));assert.deepEqual(result.path.at(-1),p(...b));
  near(result.distance,D.pathLength(result.path));
  assert.ok(result.distance+1e-7>=D.euclidean(a,b));
  for(let i=1;i<result.path.length;i++)assert.ok(router.segmentClear(result.path[i-1],result.path[i]));
  const reverse=router.route(b,a);near(result.distance,reverse.distance);
  assert.deepEqual(reverse.path,result.path.slice().reverse());
  return result;
}
test('browser global and CommonJS expose the same pure API',()=>{
  const context={};vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/distance-math.js'),'utf8'),context);
  assert.deepEqual(Object.keys(context.DistanceMath).sort(),Object.keys(D).sort());
  near(context.DistanceMath.euclidean([0,0],[3,4]),5);
});
test('Euclidean distance satisfies identity, symmetry and triangle inequality',()=>{
  const points=[p(0,0),p(3,4),p(-8,17),p(40,-2),p(.2,.9)];
  points.forEach(a=>points.forEach(b=>{
    near(D.euclidean(a,b),D.euclidean(b,a));
    assert.equal(D.euclidean(a,b)===0,a===b);
    points.forEach(c=>assert.ok(D.euclidean(a,c)<=D.euclidean(a,b)+D.euclidean(b,c)+1e-10));
  }));
  near(D.euclidean([0,0],[3,4]),5);
  assert.throws(()=>D.euclidean({x:NaN,z:0},p(0,0)),TypeError);
});
test('social graph uses shortest undirected hops, including a shorter alternate path',()=>{
  const nodes=['a','b','c','d','e','f'],edges=[['a','b'],['b','c'],['c','d'],['d','e'],['a','e']];
  assert.deepEqual(D.socialPath(nodes,edges,'a','d'),{distance:2,path:['a','e','d'],connected:true});
  assert.equal(D.socialPath(nodes,edges,'b','a').distance,1);
  assert.deepEqual(D.socialPath(nodes,edges,'f','f'),{distance:0,path:['f'],connected:true});
  assert.deepEqual(D.socialPath(nodes,edges,'a','f'),{distance:Infinity,path:[],connected:false});
  assert.equal(D.socialPath(nodes,edges,'unknown','unknown').distance,Infinity);
  for(const a of nodes)for(const b of nodes) {
    const ab=D.socialPath(nodes,edges,a,b).distance;
    assert.equal(ab,D.socialPath(nodes,edges,b,a).distance);
    for(const c of nodes)assert.ok(D.socialPath(nodes,edges,a,c).distance<=ab+D.socialPath(nodes,edges,b,c).distance);
  }
  assert.throws(()=>D.socialPath(nodes,[['a','unknown']],'a','b'),TypeError);
});
test('social ties can change independently of ground positions',()=>{
  const nodes=['a','b','c'],a=[0,0],b=[100,0];
  assert.equal(D.socialPath(nodes,[['a','b']],'a','b').distance,1);
  assert.equal(D.socialPath(nodes,[['a','c'],['c','b']],'a','b').distance,2);
  near(D.euclidean(a,b),100);
});
test('unobstructed walking returns the exact straight-line distance',()=>{
  const router=D.createRouter({boundary:rect(-20,-20,20,20),gridSize:2});
  const result=checkRoute(router,[0,0],[3,4]);near(result.distance,5);assert.equal(result.path.length,2);
  assert.deepEqual(router.route([3,4],[3,4]).path,[p(3,4)]);
  assert.equal(router.route([30,0],[0,0]).status,'outside');
});
test('walking avoids a polygon obstacle and reports the actual multi-segment sum',()=>{
  const router=D.createRouter({boundary:rect(-20,-20,20,20),obstacles:[rect(-4,-4,4,4)],gridSize:1});
  assert.equal(router.segmentClear([-10,0],[10,0]),false);
  assert.equal(router.pointStatus([0,0]),'blocked');
  assert.equal(router.route([0,0],[10,0]).status,'blocked');
  const result=checkRoute(router,[-10,0],[10,0]);assert.ok(result.path.length>=3);
  const exactPolygonDistance=2*Math.hypot(6,4)+8;
  assert.ok(result.distance>=exactPolygonDistance-1e-7);
  assert.ok(result.distance<exactPolygonDistance+2);
  assert.equal(router.segmentClear([-10,4],[10,4]),true); // legal tangency
});
test('circle collision is exact, including tiny trunks between grid samples',()=>{
  const router=D.createRouter({boundary:rect(-20,-20,20,20),circles:[{x:0,z:0,radius:4},{x:10,z:1,radius:.15}],gridSize:2});
  assert.equal(router.segmentClear([-10,0],[10,0]),false);
  assert.equal(router.segmentClear([10,0],[10,2]),false);
  assert.equal(router.segmentClear([-10,4],[10,4]),true);
  const result=checkRoute(router,[-10,0],[10,0]);assert.ok(result.distance>20);
  const exactCircleDistance=2*Math.sqrt(100-16)+4*(Math.PI-2*Math.acos(.4));
  assert.ok(result.distance>=exactCircleDistance-1e-7);
  assert.ok(result.distance<exactCircleDistance+3);
});
test('route stays inside a concave park instead of cutting across its exterior',()=>{
  const router=D.createRouter({boundary:[[0,0],[20,0],[20,6],[6,6],[6,20],[0,20]],gridSize:1});
  assert.equal(router.segmentClear([18,3],[3,18]),false);
  const result=checkRoute(router,[18,3],[3,18]);assert.ok(result.distance>D.euclidean([18,3],[3,18]));
  assert.ok(result.path.some(v=>v.x<=6&&v.z<=6));
});
test('thin polygon barriers cannot be crossed between grid samples',()=>{
  const router=D.createRouter({boundary:rect(-10,-10,10,10),obstacles:[rect(-.1,-11,.1,11)],gridSize:2});
  assert.equal(router.segmentClear([-2,0],[2,0]),false);
  assert.equal(router.route([-5,0],[5,0]).status,'unreachable');
});
test('the gap between two buildings remains traversable while their interiors block walking',()=>{
  const router=D.createRouter({boundary:rect(-30,-30,30,30),obstacles:[rect(-9.75,-3.65,-4.57,3.65),rect(4.57,-3.65,9.75,3.65)],gridSize:2});
  near(checkRoute(router,[0,-20],[0,20]).distance,40);
  assert.equal(router.segmentClear([-7,-20],[-7,20]),false);
  assert.ok(checkRoute(router,[-7,-20],[-7,20]).distance>40);
});
test('route result copies protect cached geometry from callers',()=>{
  const router=D.createRouter({boundary:rect(-10,-10,10,10)});
  const first=router.route([0,0],[5,5]);first.path[0].x=999;
  assert.deepEqual(router.route([0,0],[5,5]).path[0],p(0,0));
});
test('invalid grid and obstacle specifications fail explicitly',()=>{
  assert.throws(()=>D.createRouter({boundary:rect(-10,-10,10,10),gridSize:0}),TypeError);
  assert.throws(()=>D.createRouter({boundary:rect(-10,-10,10,10),circles:[{x:0,z:0,radius:-1}]}),TypeError);
  assert.throws(()=>D.createRouter({boundary:rect(-1000,-1000,1000,1000),gridSize:.1}),RangeError);
});
console.log(`${assertions} distance checks passed.`);
