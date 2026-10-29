/* Distance calculations for the workshop's schematic ground plane (x east, z south).
 * Walking routes are approximate: shortest on a fixed sampled grid, then simplified
 * only where a straight segment is collision-free. Social edges are undirected.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DistanceMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const EPS = 1e-8;

  function point(value) {
    const p = Array.isArray(value) ? {x:value[0],z:value[1]} : value;
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) {
      throw new TypeError('A distance endpoint needs finite x and z coordinates.');
    }
    return {x:p.x,z:p.z};
  }
  function euclidean(a, b) {
    a=point(a); b=point(b);
    return Math.hypot(a.x-b.x,a.z-b.z);
  }
  function pathLength(path) {
    let result=0;
    for(let i=1;i<path.length;i++)result+=euclidean(path[i-1],path[i]);
    return result;
  }
  function socialPath(nodeIds, edges, startId, endId) {
    const adjacent=new Map(nodeIds.map(id=>[id,new Set()]));
    edges.forEach(edge=>{
      if(!Array.isArray(edge)||edge.length!==2||!adjacent.has(edge[0])||!adjacent.has(edge[1])) {
        throw new TypeError('Each social tie must connect two declared visitors.');
      }
      adjacent.get(edge[0]).add(edge[1]); adjacent.get(edge[1]).add(edge[0]);
    });
    if(!adjacent.has(startId)||!adjacent.has(endId))return {distance:Infinity,path:[],connected:false};
    const queue=[startId], parent=new Map([[startId,null]]);
    for(let i=0;i<queue.length;i++) {
      const id=queue[i];
      if(id===endId) {
        const path=[];
        for(let current=id;current!==null;current=parent.get(current))path.push(current);
        path.reverse();
        return {distance:path.length-1,path,connected:true};
      }
      adjacent.get(id).forEach(next=>{if(!parent.has(next)){parent.set(next,id);queue.push(next);}});
    }
    return {distance:Infinity,path:[],connected:false};
  }
  function bounds(points) {
    return {minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),
      minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))};
  }
  function bboxContains(box,p) {
    return p.x>=box.minX-EPS&&p.x<=box.maxX+EPS&&p.z>=box.minZ-EPS&&p.z<=box.maxZ+EPS;
  }
  function bboxOverlaps(a,b) {
    return a.maxX>=b.minX-EPS&&a.minX<=b.maxX+EPS&&a.maxZ>=b.minZ-EPS&&a.minZ<=b.maxZ+EPS;
  }
  function cross(ax,az,bx,bz){return ax*bz-az*bx;}
  function onSegment(p,a,b) {
    return Math.abs(cross(b.x-a.x,b.z-a.z,p.x-a.x,p.z-a.z))<=EPS*Math.max(1,Math.hypot(b.x-a.x,b.z-a.z))&&
      bboxContains({minX:Math.min(a.x,b.x),maxX:Math.max(a.x,b.x),minZ:Math.min(a.z,b.z),maxZ:Math.max(a.z,b.z)},p);
  }
  // -1 outside, 0 on boundary, 1 inside. Boundary contact is permitted for a point route.
  function classify(p,poly) {
    if(!bboxContains(poly.box,p))return -1;
    let inside=false;
    for(let i=0,j=poly.points.length-1;i<poly.points.length;j=i++) {
      const a=poly.points[j],b=poly.points[i];
      if(onSegment(p,a,b))return 0;
      if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)inside=!inside;
    }
    return inside?1:-1;
  }
  function polygon(values) {
    const points=values.map(point);
    if(points.length>1&&euclidean(points[0],points[points.length-1])<EPS)points.pop();
    if(points.length<3)throw new TypeError('A route polygon needs at least three vertices.');
    return {points,box:bounds(points)};
  }
  // Split a segment at every polygon edge crossing, including collinear overlaps.
  // Checking each open interval handles concave boundaries and narrow obstacles.
  function segmentInPolygon(a,b,poly,requireInside) {
    const dx=b.x-a.x,dz=b.z-a.z, len2=dx*dx+dz*dz;
    if(len2<EPS*EPS)return requireInside?classify(a,poly)>=0:classify(a,poly)<=0;
    const cuts=[0,1];
    for(let i=0;i<poly.points.length;i++) {
      const c=poly.points[i],d=poly.points[(i+1)%poly.points.length];
      const ex=d.x-c.x,ez=d.z-c.z, ax=c.x-a.x,az=c.z-a.z;
      const denominator=cross(dx,dz,ex,ez);
      if(Math.abs(denominator)>EPS) {
        const t=cross(ax,az,ex,ez)/denominator,u=cross(ax,az,dx,dz)/denominator;
        if(t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS)cuts.push(Math.max(0,Math.min(1,t)));
      } else if(Math.abs(cross(ax,az,dx,dz))<=EPS*Math.max(1,Math.sqrt(len2))) {
        [c,d].forEach(p=>{const t=((p.x-a.x)*dx+(p.z-a.z)*dz)/len2;if(t>0&&t<1)cuts.push(t);});
      }
    }
    cuts.sort((x,y)=>x-y);
    for(let i=1;i<cuts.length;i++) {
      if(cuts[i]-cuts[i-1]<EPS)continue;
      const t=(cuts[i]+cuts[i-1])/2, location=classify({x:a.x+t*dx,z:a.z+t*dz},poly);
      if(requireInside?location<0:location>0)return false;
    }
    return true;
  }
  class MinHeap {
    constructor(){this.values=[];}
    push(value) {
      const list=this.values;let index=list.length;list.push(value);
      while(index>0){const parent=(index-1)>>1;if(list[parent].f<=value.f)break;list[index]=list[parent];index=parent;}
      list[index]=value;
    }
    pop() {
      const list=this.values,first=list[0],last=list.pop();
      if(list.length){let index=0;while(index*2+1<list.length){let child=index*2+1;if(child+1<list.length&&list[child+1].f<list[child].f)child++;if(last.f<=list[child].f)break;list[index]=list[child];index=child;}list[index]=last;}
      return first;
    }
    get length(){return this.values.length;}
  }

  function createRouter(spec) {
    const boundary=polygon(spec.boundary),obstacles=(spec.obstacles||[]).map(polygon);
    const circles=(spec.circles||[]).map(value=>{
      const p=point(value);
      if(!Number.isFinite(value.radius)||value.radius<0)throw new TypeError('An obstacle circle needs a nonnegative radius.');
      return {x:p.x,z:p.z,radius:value.radius,box:{minX:p.x-value.radius,maxX:p.x+value.radius,minZ:p.z-value.radius,maxZ:p.z+value.radius}};
    });
    const gridSize=spec.gridSize===undefined?2:spec.gridSize;
    if(!Number.isFinite(gridSize)||gridSize<=0)throw new TypeError('Route grid size must be positive.');
    function pointStatus(value) {
      const p=point(value);
      if(classify(p,boundary)<0)return 'outside';
      if(obstacles.some(poly=>classify(p,poly)>0)||circles.some(c=>Math.hypot(p.x-c.x,p.z-c.z)<c.radius-EPS))return 'blocked';
      return 'ok';
    }
    function segmentClear(first,second) {
      const a=point(first),b=point(second);
      if(pointStatus(a)!=='ok'||pointStatus(b)!=='ok')return false;
      const segmentBox=bounds([a,b]),dx=b.x-a.x,dz=b.z-a.z,len2=dx*dx+dz*dz;
      if(!segmentInPolygon(a,b,boundary,true))return false;
      for(const poly of obstacles)if(bboxOverlaps(segmentBox,poly.box)&&!segmentInPolygon(a,b,poly,false))return false;
      for(const circle of circles) {
        if(!bboxOverlaps(segmentBox,circle.box))continue;
        const t=len2?Math.max(0,Math.min(1,((circle.x-a.x)*dx+(circle.z-a.z)*dz)/len2)):0;
        if(Math.hypot(a.x+t*dx-circle.x,a.z+t*dz-circle.z)<circle.radius-EPS)return false;
      }
      return true;
    }
    const minX=Math.floor(boundary.box.minX/gridSize)*gridSize,minZ=Math.floor(boundary.box.minZ/gridSize)*gridSize;
    const cols=Math.ceil((boundary.box.maxX-minX)/gridSize)+1,rows=Math.ceil((boundary.box.maxZ-minZ)/gridSize)+1;
    if(cols*rows>250000)throw new RangeError('This route grid exceeds 250,000 samples; increase gridSize.');
    const nodes=new Map(), adjacency=new Map(),routeCache=new Map();
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++) {
      const p={x:minX+col*gridSize,z:minZ+row*gridSize};
      if(pointStatus(p)==='ok')nodes.set(row*cols+col,p);
    }
    function neighbors(id) {
      if(adjacency.has(id))return adjacency.get(id);
      const row=Math.floor(id/cols),col=id%cols,p=nodes.get(id),result=[];
      for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++) {
        if((!dc&&!dr)||col+dc<0||col+dc>=cols||row+dr<0||row+dr>=rows)continue;
        const next=id+dr*cols+dc,q=nodes.get(next);
        // A diagonal may not squeeze between two blocked grid samples.
        if(!q||(dc&&dr&&(!nodes.has(id+dc)||!nodes.has(id+dr*cols))))continue;
        if(segmentClear(p,q))result.push({id:next,cost:Math.hypot(dc,dr)*gridSize});
      }
      adjacency.set(id,result);return result;
    }
    function attachments(p) {
      const col=Math.round((p.x-minX)/gridSize),row=Math.round((p.z-minZ)/gridSize);
      // Expand only if no nearby sampled position can be reached. This also lets
      // a valid endpoint in a narrow pocket connect to the surrounding grid.
      for(const radius of [2,4,8]) {
        const result=[];
        for(let dr=-radius;dr<=radius;dr++)for(let dc=-radius;dc<=radius;dc++) {
          if(col+dc<0||col+dc>=cols||row+dr<0||row+dr>=rows)continue;
          const id=(row+dr)*cols+col+dc,q=nodes.get(id);
          if(q&&segmentClear(p,q))result.push({id,cost:euclidean(p,q)});
        }
        if(result.length)return result;
      }
      return [];
    }
    function simplify(path) {
      const result=[path[0]];let index=0;
      while(index<path.length-1) {
        let next=path.length-1;
        while(next>index+1&&!segmentClear(path[index],path[next]))next--;
        if(euclidean(result[result.length-1],path[next])>EPS)result.push(path[next]);
        index=next;
      }
      return result;
    }
    function calculate(a,b) {
      const aStatus=pointStatus(a),bStatus=pointStatus(b);
      if(aStatus!=='ok'||bStatus!=='ok')return {distance:Infinity,path:[],status:aStatus!=='ok'?aStatus:bStatus};
      if(euclidean(a,b)<EPS)return {distance:0,path:[a],status:'ok'};
      if(segmentClear(a,b))return {distance:euclidean(a,b),path:[a,b],status:'ok'};
      const starts=attachments(a),ends=new Map(attachments(b).map(item=>[item.id,item.cost]));
      if(!starts.length||!ends.size)return {distance:Infinity,path:[],status:'unreachable'};
      const heap=new MinHeap(),distances=new Map(),previous=new Map();
      starts.forEach(item=>{distances.set(item.id,item.cost);previous.set(item.id,null);heap.push({id:item.id,g:item.cost,f:item.cost+euclidean(nodes.get(item.id),b)});});
      let best=Infinity,finish=null;
      while(heap.length) {
        const entry=heap.pop();
        if(entry.f>=best-EPS)break;
        if(entry.g>distances.get(entry.id)+EPS)continue;
        if(ends.has(entry.id)&&entry.g+ends.get(entry.id)<best){best=entry.g+ends.get(entry.id);finish=entry.id;}
        neighbors(entry.id).forEach(next=>{
          const distance=entry.g+next.cost;
          if(distance<(distances.has(next.id)?distances.get(next.id):Infinity)-EPS) {
            distances.set(next.id,distance);previous.set(next.id,entry.id);
            heap.push({id:next.id,g:distance,f:distance+euclidean(nodes.get(next.id),b)});
          }
        });
      }
      if(finish===null)return {distance:Infinity,path:[],status:'unreachable'};
      const path=[b];
      for(let id=finish;id!==null;id=previous.get(id))path.push(nodes.get(id));
      path.push(a);path.reverse();
      const simplified=simplify(path);
      return {distance:pathLength(simplified),path:simplified,status:'ok'};
    }
    function route(first,second) {
      let a=point(first),b=point(second);
      // A canonical direction makes equal-cost choices and simplification symmetric.
      const reversed=a.x>b.x||(a.x===b.x&&a.z>b.z);
      if(reversed){const temp=a;a=b;b=temp;}
      const key=[a.x,a.z,b.x,b.z].join(',');
      if(!routeCache.has(key)) {
        if(routeCache.size>=64)routeCache.delete(routeCache.keys().next().value);
        routeCache.set(key,calculate(a,b));
      }
      const result=routeCache.get(key),path=result.path.map(point);
      if(reversed)path.reverse();
      return {distance:result.distance,path,status:result.status,approximate:true,gridSize};
    }
    return {route,segmentClear,pointStatus,gridSize};
  }
  return {euclidean,pathLength,socialPath,createRouter};
});
