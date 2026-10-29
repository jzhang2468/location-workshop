/* Point-agent walking model for Common Ground, independent of rendering and clocks.
 * A selected direct friendship takes priority. Selected nonfriends wander alone;
 * everyone else keeps an available partner or chooses one direct friend in ID order.
 * Meeting uses a common route, then partners follow one trail with a 3 m path gap.
 * This is an explicit simulation rule, not a prediction of real social behavior.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SocialMotion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const EPS = 1e-7;
  const copy = p => ({x:p.x,z:p.z});
  const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
  const length = path => path.slice(1).reduce((sum,p,i)=>sum+distance(path[i],p),0);
  const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.z);

  function create({ids,router,bounds,speed=1.4,random=Math.random}) {
    if (!Array.isArray(ids) || new Set(ids).size!==ids.length) throw new TypeError('Visitor IDs must be unique.');
    if (!router || !['route','pointStatus','segmentClear'].every(k=>typeof router[k]==='function')) throw new TypeError('A walking router is required.');
    if (!bounds || !['minX','maxX','minZ','maxZ'].every(k=>Number.isFinite(bounds[k])) || bounds.maxX<=bounds.minX || bounds.maxZ<=bounds.minZ) throw new TypeError('Walking bounds must have positive dimensions.');
    if (!Number.isFinite(speed) || speed<=0 || typeof random!=='function') throw new TypeError('Walking speed must be positive and random must be a function.');
    ids=ids.slice();
    const rank=new Map(ids.map((id,i)=>[id,i]));
    const gap=3, maxStep=.1;
    let positions=null, pairs=new Map(), solos=new Map(), saved=new Map(), elapsed=0,origins=null;
    const pairKey=(a,b)=>JSON.stringify(rank.get(a)<rank.get(b)?[a,b]:[b,a]);
    const pairIds=(a,b)=>rank.get(a)<rank.get(b)?[a,b]:[b,a];
    const valid=id=>finitePoint(positions[id]) && router.pointStatus(positions[id])==='ok';
    function remember() { saved=new Map(ids.map(id=>[id,copy(positions[id])])); }
    function routeBetween(a,b) {
      if (!finitePoint(a) || !finitePoint(b) || router.pointStatus(a)!=='ok' || router.pointStatus(b)!=='ok') return null;
      const result=router.route(a,b);
      if (result.status!=='ok' || !result.path.length) return null;
      const path=result.path.map(copy);
      if (distance(path[0],a)>EPS || distance(path[path.length-1],b)>EPS || path.some((p,i)=>i && !router.segmentClear(path[i-1],p))) return null;
      return path;
    }
    function randomUnit() {
      const value=random();
      if (!Number.isFinite(value)) throw new TypeError('random() must return a finite number.');
      return Math.max(0,Math.min(1-Number.EPSILON,value));
    }
    function randomRoute(start,heading) {
      const inset=Math.min(5,(bounds.maxX-bounds.minX)/10,(bounds.maxZ-bounds.minZ)/10);
      let fallback=null;
      // Rejection sampling selects actual clear ground, not a prescribed waypoint loop.
      // Prefer a forward departure to avoid a couple doubling back over its own trail.
      for(let attempt=0;attempt<40;attempt++) {
        const target={x:bounds.minX+inset+randomUnit()*(bounds.maxX-bounds.minX-2*inset),z:bounds.minZ+inset+randomUnit()*(bounds.maxZ-bounds.minZ-2*inset)};
        if(distance(start,target)<Math.min(16,(bounds.maxX-bounds.minX)/4,(bounds.maxZ-bounds.minZ)/4) || router.pointStatus(target)!=='ok')continue;
        const path=routeBetween(start,target);
        if(!path || path.length<2)continue;
        if(!fallback)fallback=path;
        const first=path.find(p=>distance(p,start)>EPS);
        if(!heading || !first || (first.x-start.x)*heading.x+(first.z-start.z)*heading.z>=0)return path;
      }
      return fallback;
    }
    function newSolo(id) {return {id,route:[],heading:null,mode:'wandering',retry:0};}
    function newPair(members) {
      const [a,b]=members;
      const path=routeBetween(positions[a],positions[b]);
      if(!path)return {ids:members,mode:'waiting',retry:1};
      const total=length(path),meet=Math.max(0,(total-gap)/2);
      return {ids:members,mode:total<=gap+EPS?'together':'approaching',
        left:{points:path.slice(1).map(copy)},right:{points:path.slice(0,-1).reverse().map(copy)},
        approachRemaining:meet,trail:total<=gap+EPS?path.slice(1).map(copy):[],trailLength:total,
        route:[],heading:null,retry:0};
    }
    function safeBudget(id,queue,budget) {
      let start=positions[id],spent=0;
      for(const target of queue) {
        const remaining=distance(start,target);
        if(remaining<=EPS){start=target;continue;}
        const amount=Math.min(budget-spent,remaining),ratio=amount/remaining;
        if(amount<=EPS)break;
        const next={x:start.x+(target.x-start.x)*ratio,z:start.z+(target.z-start.z)*ratio};
        // Pause at a corner when the displayed frame's straight sweep would clip it.
        // The next frame continues from that corner; no time step can cut a building.
        if(!router.segmentClear(start,next) || (origins && !router.segmentClear(origins.get(id),next)))break;
        spent+=amount;start=next;
        if(spent>=budget-EPS)break;
      }
      return spent;
    }
    // Walk each actual piece of a polyline. No position is snapped to a destination.
    // The returned trace records turns, so the follower never cuts across obstacles.
    function travel(id,queue,budget) {
      budget=safeBudget(id,queue,budget);
      let moved=0;
      const trace=[];
      while(queue.length && budget>EPS) {
        const start=positions[id],target=queue[0],remaining=distance(start,target);
        if(remaining<=EPS){queue.shift();continue;}
        const amount=Math.min(budget,remaining),ratio=amount/remaining;
        const next={x:start.x+(target.x-start.x)*ratio,z:start.z+(target.z-start.z)*ratio};
        if(!router.segmentClear(start,next))break;
        positions[id].x=next.x;positions[id].z=next.z;
        trace.push(next);moved+=amount;budget-=amount;
        if(amount>=remaining-EPS)queue.shift();
      }
      return {moved,trace};
    }
    function beginTogether(pair) {
      const [follower,leader]=pair.ids;
      // The unconsumed first route starts at the follower and contains the leader.
      // Slice it at the leader, preserving every corner between the two people.
      const route=[copy(positions[follower]),...pair.left.points.map(copy)];
      let remaining=gap,trail=[];
      for(let i=1;i<route.length && remaining>EPS;i++) {
        const d=distance(route[i-1],route[i]);
        if(d<=remaining+EPS){trail.push(copy(route[i]));remaining-=d;}
        else {trail.push({x:route[i-1].x+(route[i].x-route[i-1].x)*remaining/d,z:route[i-1].z+(route[i].z-route[i-1].z)*remaining/d});remaining=0;}
      }
      // Both walkers advanced the same route distance, so this is their shared path.
      if(trail.length)trail[trail.length-1]=copy(positions[leader]);
      else if(distance(positions[follower],positions[leader])>EPS)trail.push(copy(positions[leader]));
      pair.trail=trail;pair.trailLength=length([positions[follower],...trail]);
      pair.mode='together';pair.route=[];pair.heading=null;
      delete pair.left;delete pair.right;
    }
    function advancePair(pair,dt) {
      const [follower,leader]=pair.ids;
      if(!valid(follower)||!valid(leader)){pair.mode='waiting';return;}
      if(pair.mode==='waiting') {
        pair.retry-=dt;
        if(pair.retry<=0)Object.assign(pair,newPair(pair.ids));
        return;
      }
      if(pair.mode==='approaching') {
        const requested=Math.min(speed*dt,pair.approachRemaining);
        const amount=Math.min(safeBudget(follower,pair.left.points,requested),safeBudget(leader,pair.right.points,requested));
        const left=travel(follower,pair.left.points,amount),right=travel(leader,pair.right.points,amount);
        if(left.moved+EPS<amount || right.moved+EPS<amount){pair.mode='waiting';pair.retry=1;return;}
        pair.approachRemaining=Math.max(0,pair.approachRemaining-amount);
        if(pair.approachRemaining<=EPS)beginTogether(pair);
        return;
      }
      if(!pair.route.length) {
        pair.retry-=dt;
        if(pair.retry<=0) {
          const route=randomRoute(positions[leader],pair.heading);
          pair.route=route?route.slice(1):[];pair.retry=pair.route.length?0:1;
        }
      }
      // A leader waits at most one small step ahead when the follower negotiates a
      // corner, preventing the pair separating during a long or delayed frame.
      const budget=Math.min(speed*dt,Math.max(0,gap+speed*maxStep-pair.trailLength));
      const before=copy(positions[leader]),walk=travel(leader,pair.route,budget);
      for(const point of walk.trace) {
        const last=pair.trail.length?pair.trail[pair.trail.length-1]:positions[follower];
        if(distance(last,point)>EPS)pair.trail.push(copy(point));
      }
      if(walk.moved>EPS)pair.heading={x:positions[leader].x-before.x,z:positions[leader].z-before.z};
      pair.trailLength+=walk.moved;
      const follow=travel(follower,pair.trail,Math.min(speed*dt,Math.max(0,pair.trailLength-gap)));
      pair.trailLength=Math.max(0,pair.trailLength-follow.moved);
    }
    function advanceSolo(solo,dt) {
      if(!valid(solo.id)){solo.mode='waiting';return;}
      if(!solo.route.length) {
        solo.retry-=dt;
        if(solo.retry<=0) {
          const route=randomRoute(positions[solo.id]);
          solo.route=route?route.slice(1):[];solo.retry=solo.route.length?0:1;
        }
      }
      solo.mode=solo.route.length?'wandering':'waiting';
      travel(solo.id,solo.route,speed*dt);
    }
    function sync({positions:nextPositions,edges=[],preferredPair=[]}) {
      if(!nextPositions || ids.some(id=>!finitePoint(nextPositions[id])))throw new TypeError('Every visitor needs finite coordinates.');
      const replaced=positions!==nextPositions;
      const changed=new Set(ids.filter(id=>replaced||!saved.has(id)||distance(saved.get(id),nextPositions[id])>EPS));
      positions=nextPositions;
      const links=new Set(edges.filter(edge=>Array.isArray(edge)&&edge.length===2&&rank.has(edge[0])&&rank.has(edge[1])&&edge[0]!==edge[1]).map(([a,b])=>pairKey(a,b)));
      const used=new Set(),selected=preferredPair.filter(id=>rank.has(id)).slice(0,2),matches=[];
      function add(a,b) {used.add(a);used.add(b);matches.push(pairIds(a,b));}
      if(selected.length===2 && selected[0]!==selected[1] && links.has(pairKey(...selected)))add(...selected);
      else selected.forEach(id=>used.add(id));
      for(const pair of pairs.values()) {
        const [a,b]=pair.ids;
        if(!used.has(a)&&!used.has(b)&&links.has(pairKey(a,b)))add(a,b);
      }
      for(const a of ids)if(!used.has(a)) {
        const b=ids.find(b=>a!==b&&!used.has(b)&&links.has(pairKey(a,b)));
        if(b!==undefined)add(a,b);
      }
      const nextPairs=new Map(),paired=new Set();
      for(const members of matches) {
        const key=pairKey(...members),old=pairs.get(key);
        nextPairs.set(key,old&&!members.some(id=>changed.has(id))?old:newPair(members));
        members.forEach(id=>paired.add(id));
      }
      const nextSolos=new Map();
      for(const id of ids)if(!paired.has(id))nextSolos.set(id,!changed.has(id)&&solos.has(id)?solos.get(id):newSolo(id));
      pairs=nextPairs;solos=nextSolos;remember();
      return status();
    }
    function step(seconds) {
      if(!Number.isFinite(seconds)||seconds<0)throw new TypeError('Simulation time must be finite and nonnegative.');
      if(!positions)throw new Error('Call sync() before stepping the walking model.');
      origins=new Map(ids.map(id=>[id,copy(positions[id])]));
      // Bounded substeps keep motion stable at 1×, 4×, 8× and after a delayed frame.
      let remaining=seconds;
      while(remaining>EPS) {
        const dt=Math.min(maxStep,remaining);
        for(const pair of pairs.values())advancePair(pair,dt);
        for(const solo of solos.values())advanceSolo(solo,dt);
        remaining-=dt;elapsed+=dt;
      }
      origins=null;
      remember();
    }
    function status() {
      const agents={};
      for(const id of ids)agents[id]={mode:solos.get(id)?.mode||'waiting',partner:null};
      const current=[];
      for(const pair of pairs.values()) {
        const [a,b]=pair.ids;
        agents[a]={mode:pair.mode,partner:b};agents[b]={mode:pair.mode,partner:a};
        current.push({ids:pair.ids.slice(),mode:pair.mode,gap:pair.mode==='together'?pair.trailLength:null});
      }
      return {agents,pairs:current,elapsed,speed,followingGap:gap};
    }
    return {sync,step,status};
  }
  return {create};
});
