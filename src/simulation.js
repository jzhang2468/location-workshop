/* Common Ground: a fictional, self-contained location and relationship experiment. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const D = window.DistanceMath;
  const NS = 'http://www.w3.org/2000/svg';
  const names = {a:'Ava',b:'Ben',c:'Cleo',d:'Dev',e:'Emi',f:'Finn'};
  const ids = Object.keys(names);
  const colors = {a:'#176c60',b:'#c05c3c',c:'#6256a0',d:'#426b98',e:'#8b6927',f:'#7e555e'};
  const basePositions = {a:{x:40,z:80},b:{x:205,z:55},c:{x:45,z:85},d:{x:150,z:80},e:{x:65,z:135},f:{x:190,z:125}};
  const defaultEdges = [['a','b'],['b','d'],['d','e'],['e','c'],['d','f']];
  const buildings = [
    {x:30,z:22,w:45,h:27,name:'THE STUDIO'},
    {x:165,z:18,w:43,h:24,name:'READING ROOM'},
    {x:100,z:124,w:44,h:22,name:'CAFÉ'}
  ];
  const pond = {x:110,z:80,radius:23};
  const boundary = [[0,0],[240,0],[240,160],[0,160]];
  const obstacles = buildings.map(b => [[b.x,b.z],[b.x+b.w,b.z],[b.x+b.w,b.z+b.h],[b.x,b.z+b.h]]);
  const router = D.createRouter({boundary, obstacles, circles:[pond], gridSize:2});
  const state = {a:'a',b:'b',positions:structuredClone(basePositions),edges:structuredClone(defaultEdges),playing:false,placing:false,speed:4,scenario:'far'};
  const walks = new Map();
  const destinations = [{x:15,z:65},{x:88,z:30},{x:150,z:55},{x:223,z:145},{x:160,z:150},{x:78,z:115},{x:12,z:140},{x:223,z:8}];
  let lastTime=0,lastMeasure=0;
  const key = (a,b) => [a,b].sort().join('-');
  const fmt = n => Number.isFinite(n) ? n.toFixed(1) : '∞';
  function svg(tag,attrs={},parent) {
    const node=document.createElementNS(NS,tag);
    for(const [k,v] of Object.entries(attrs))node.setAttribute(k,String(v));
    if(parent)parent.appendChild(node);
    return node;
  }
  function label(parent,text,x,y,attrs={}) {
    const node=svg('text',{x,y,...attrs},parent);node.textContent=text;return node;
  }
  function error(message='') { $('error').hidden=!message;$('error').textContent=message; }
  function social(a=state.a,b=state.b) { return D.socialPath(ids,state.edges,a,b); }
  function measure() {
    const a=state.positions[state.a],b=state.positions[state.b];
    return {spatial:D.euclidean(a,b),social:social(),walking:router.route(a,b)};
  }
  function selectedName(id) { return names[id] + (id===state.a&&id===state.b?' · A + B':id===state.a?' · A':id===state.b?' · B':''); }
  function location(p) {return '('+p.x.toFixed(1)+', '+(160-p.z).toFixed(1)+') m';}
  const world=$('world');
  const defs=svg('defs',{},world);
  const pattern=svg('pattern',{id:'grid',width:20,height:20,patternUnits:'userSpaceOnUse'},defs);
  svg('path',{d:'M 20 0 L 0 0 0 20',fill:'none',stroke:'#dfe5da','stroke-width':.35},pattern);
  const map=svg('g',{transform:'translate(44 30) scale(2.8)'},world);
  svg('rect',{x:0,y:0,width:240,height:160,rx:4,fill:'#edf1e8',stroke:'#d4dece','stroke-width':.6},map);
  svg('rect',{x:0,y:0,width:240,height:160,fill:'url(#grid)'},map);
  // Landscape is schematic; pale paving and garden planting are passable.
  svg('path',{d:'M 0 80 H 240 M 110 0 V 160',fill:'none',stroke:'#f8faf3','stroke-width':19},map);
  svg('rect',{x:10,y:104,width:34,height:44,rx:12,fill:'#dbe6d1'},map);
  svg('rect',{x:176,y:70,width:52,height:29,rx:12,fill:'#dbe6d1'},map);
  [[18,115],[22,134],[32,123],[186,85],[204,82],[218,88],[86,10],[151,15]].forEach(([x,z])=>{
    svg('circle',{cx:x,cy:z,r:3.3,fill:'#bbceb1'},map);
    svg('circle',{cx:x-.7,cy:z-.7,r:2.1,fill:'#c9d9c0'},map);
  });
  buildings.forEach(b=>{
    svg('rect',{x:b.x+1,y:b.z+1.7,width:b.w,height:b.h,rx:1.5,fill:'#c4cdc0',opacity:.7},map);
    svg('rect',{x:b.x,y:b.z,width:b.w,height:b.h,rx:1.5,fill:'#fdfcf8',stroke:'#bac6b3','stroke-width':.6},map);
    svg('rect',{x:b.x+2,y:b.z+2,width:b.w-4,height:b.h-4,rx:1,fill:'none',stroke:'#e5e7df','stroke-width':.5},map);
    label(map,b.name,b.x+b.w/2,b.z+b.h/2+1,{'text-anchor':'middle','font-size':3.1,fill:'#6c7866','letter-spacing':.35});
  });
  svg('circle',{cx:pond.x,cy:pond.z,r:pond.radius+2.4,fill:'#e2e3d6'},map);
  svg('circle',{cx:pond.x,cy:pond.z,r:pond.radius,fill:'#c5e2df',stroke:'#a9cfca','stroke-width':.6},map);
  [8,14,20].forEach(r=>svg('path',{d:`M ${pond.x-r} ${pond.z+3} Q ${pond.x} ${pond.z-3} ${pond.x+r} ${pond.z+3}`,fill:'none',stroke:'#afd4cf','stroke-width':.5},map));
  label(map,'REFLECTING POND',pond.x,pond.z-7,{'text-anchor':'middle','font-size':3,fill:'#5c8b84','letter-spacing':.35});
  label(map,'WEST GARDEN',23,155,{'text-anchor':'middle','font-size':2.8,fill:'#7a8b72','letter-spacing':.25});
  label(map,'EAST LAWN',202,105,{'text-anchor':'middle','font-size':2.8,fill:'#7a8b72','letter-spacing':.25});
  label(world,'N',724,28,{'font-size':11,fill:'#66756a','text-anchor':'middle'});
  svg('path',{d:'M724 54 V36 M720 42 L724 36 L728 42',fill:'none',stroke:'#66756a','stroke-width':1.3},world);
  svg('path',{d:'M44 499 v-5 M44 499 h112 M156 499 v-5',fill:'none',stroke:'#66756a','stroke-width':1},world);
  label(world,'40 m',100,516,{'font-size':11,fill:'#66756a','text-anchor':'middle'});
  label(world,'Origin (0, 0) · southwest',705,516,{'font-size':11,fill:'#66756a','text-anchor':'end'});
  const routeLine=svg('path',{fill:'none',stroke:'#9b7841','stroke-width':1.2,'stroke-linejoin':'round','stroke-linecap':'round','stroke-dasharray':'2.2 1.4'},map);
  const directLine=svg('line',{stroke:'#176c60','stroke-width':.8,'stroke-dasharray':'2 1.2',opacity:.9},map);
  const agentNodes=new Map();
  ids.forEach(id=>{
    const group=svg('g',{'data-person':id,class:'agent',tabindex:0,role:'button','aria-label':'Select '+names[id]+' as occupant B'},map);
    const title=svg('title',{},group);title.textContent=names[id];
    const halo=svg('circle',{r:4.5,fill:'none',stroke:colors[id],'stroke-width':.6,opacity:.45},group);
    svg('circle',{r:2.8,fill:colors[id],stroke:'#ffffff','stroke-width':.7},group);
    label(group,id.toUpperCase(),0,1.05,{'text-anchor':'middle','font-size':2.8,'font-weight':600,fill:'white'});
    const name=label(group,names[id],0,-6.2,{'text-anchor':'middle','font-size':3.8,'font-weight':600,fill:'#273d32','paint-order':'stroke',stroke:'#f3f6ef','stroke-width':1.5,'stroke-linejoin':'round',class:'agent-label'});
    agentNodes.set(id,{group,halo,name});
    const choose=()=>{state.b=id;state.scenario='';syncControls();refresh();};
    group.addEventListener('click',e=>{if(state.placing)return;e.stopPropagation();choose();});
    group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}});
  });
  function drawMap() {
    const a=state.positions[state.a],b=state.positions[state.b];
    for(const [id,node] of agentNodes) {
      const p=state.positions[id];node.group.setAttribute('transform',`translate(${p.x} ${p.z})`);
      const active=id===state.a||id===state.b;node.halo.setAttribute('r',active?5:3.8);node.halo.setAttribute('opacity',active?.8:.15);node.name.textContent=selectedName(id);
    }
    for(const [k,v] of Object.entries({x1:a.x,y1:a.z,x2:b.x,y2:b.z}))directLine.setAttribute(k,v);
  }
  function drawNetwork(result) {
    const host=$('network');host.replaceChildren();
    const pos={a:[32,82],b:[97,32],d:[181,32],f:[290,80],e:[181,127],c:[97,127]};
    const activeEdges=new Set(result.path.slice(1).map((id,i)=>key(result.path[i],id)));
    state.edges.forEach(([a,b])=>{const active=activeEdges.has(key(a,b));svg('line',{x1:pos[a][0],y1:pos[a][1],x2:pos[b][0],y2:pos[b][1],stroke:active?'#c05c3c':'#d9dfd7','stroke-width':active?3:1.5},host);});
    ids.forEach(id=>{
      const [x,y]=pos[id],selected=id===state.a||id===state.b;
      if(selected)svg('circle',{cx:x,cy:y,r:15,fill:'none',stroke:colors[id],'stroke-width':1.5},host);
      svg('circle',{cx:x,cy:y,r:11,fill:result.path.includes(id)?colors[id]:'#e5eae2'},host);
      label(host,id.toUpperCase(),x,y+3.5,{'text-anchor':'middle','font-size':10,'font-weight':600,fill:result.path.includes(id)?'white':'#62715e'});
      label(host,names[id],x,y+28,{'text-anchor':'middle','font-size':10,fill:'#677462'});
    });
  }
  function drawChart() {
    const host=$('comparison');host.replaceChildren();
    const ox=43,oy=191,width=360,height=120;
    const values=ids.map(id=>({id,x:D.euclidean(state.positions[state.a],state.positions[id]),y:social(state.a,id).distance}));
    const maximum=Math.max(200,Math.ceil(Math.max(...values.map(p=>p.x))/50)*50);
    const x=v=>ox+width*v/maximum,y=v=>Number.isFinite(v)?oy-v*height/5:32;
    svg('rect',{x:ox,y:y(1),width:width*40/maximum,height:height/5,fill:'#e5f0e9'},host);
    for(let hop=0;hop<=5;hop++) {
      svg('line',{x1:ox,y1:y(hop),x2:ox+width,y2:y(hop),stroke:'#e7eae3','stroke-width':1},host);
      label(host,String(hop),ox-10,y(hop)+4,{'text-anchor':'end','font-size':10,fill:'#71806c'});
    }
    svg('line',{x1:ox,y1:32,x2:ox+width,y2:32,stroke:'#d6dcd0','stroke-dasharray':'3 4'},host);
    label(host,'∞',ox-10,36,{'text-anchor':'end','font-size':13,fill:'#71806c'});
    label(host,'SOCIAL · LINKS',ox,13,{'font-size':10,fill:'#8d563d','letter-spacing':.6});
    for(let t=0;t<=maximum;t+=50)label(host,String(t),x(t),oy+19,{'text-anchor':'middle','font-size':10,fill:'#71806c'});
    label(host,'SPATIAL · METRES',ox+width,oy+42,{'text-anchor':'end','font-size':10,fill:'#176c60','letter-spacing':.6});
    svg('line',{x1:x(40),y1:60,x2:x(40),y2:oy,stroke:'#b4c7b4','stroke-dasharray':'3 4'},host);
    label(host,'40 m',x(40)+4,61,{'font-size':9,fill:'#71806c'});
    values.forEach(p=>{
      if(p.id===state.b)svg('circle',{cx:x(p.x),cy:y(p.y),r:8,fill:'none',stroke:colors[p.id],'stroke-width':1.5},host);
      const dot=svg('circle',{cx:x(p.x),cy:y(p.y),r:4.3,fill:colors[p.id]},host);
      svg('title',{},dot).textContent=names[p.id]+': '+fmt(p.x)+' m, '+(Number.isFinite(p.y)?p.y+' links':'disconnected');
      label(host,p.id.toUpperCase(),x(p.x)+7,y(p.y)-7,{'font-size':10,'font-weight':600,fill:colors[p.id]});
    });
    $('comparison-note').textContent='Distances from '+names[state.a]+' to all six people (including A at zero).' ;
  }
  function insight(result) {
    const m=result.spatial,h=result.social.distance,who=names[state.a]+' & '+names[state.b];
    if(state.a===state.b)return who+': the same person. Both distances are zero.';
    if(!Number.isFinite(h))return who+': '+(m<=40?'spatially near':'spatially far')+', but socially disconnected. No friendship chain connects them.';
    if(m<=40&&h>=3)return who+': near in space, far in the network. Being nearby does not make them socially close.';
    if(m>40&&h<=1)return who+': far in space, close in the network. Their friendship survives the distance.';
    if(m<=40&&h<=1)return who+': close in both space and the social network.';
    if(h===2)return who+': '+(m<=40?'spatially near':'spatially far')+' and two friendship links apart — an intermediate social distance.';
    return who+': far in both space and the social network.';
  }
  function refresh(updateFields=true) {
    const result=measure();drawMap();
    routeLine.setAttribute('d',result.walking.path.map((p,i)=>(i?'L':'M')+p.x+' '+p.z).join(' '));
    $('spatial-value').textContent=fmt(result.spatial);
    $('social-value').textContent=Number.isFinite(result.social.distance)?String(result.social.distance):'∞';
    $('social-unit').textContent=result.social.connected?(result.social.distance===1?'friendship link':'friendship links'):'no connecting chain';
    const message=insight(result);if($('insight').textContent!==message)$('insight').textContent=message;
    $('walking-value').textContent=result.walking.status==='ok'?fmt(result.walking.distance)+' m':'No route';
    const extra=result.walking.distance-result.spatial;
    $('route-note').textContent=result.walking.status!=='ok'?'These positions cannot be connected by the modeled route.':extra>.1?'+'+extra.toFixed(1)+' m beyond the direct line · approximate route.':'A clear route · the walk matches the straight line.';
    $('chain').textContent=result.social.connected?result.social.path.map(id=>names[id]).join(' → '):'No chain. Add a friendship to reconnect the groups.';
    $('addresses').textContent='A · '+names[state.a]+' occupies '+location(state.positions[state.a])+'. B · '+names[state.b]+' occupies '+location(state.positions[state.b])+'.';
    drawNetwork(result.social);drawChart();
    if(updateFields)syncPositionFields();
  }
  function syncPositionFields() {
    ['a','b'].forEach(which=>{const p=state.positions[state[which]],field=$('position-'+which);if(document.activeElement!==field)field.value=p.x.toFixed(1)+', '+(160-p.z).toFixed(1);});
  }
  function syncControls() {
    $('person-a').value=state.a;$('person-b').value=state.b;
    document.querySelectorAll('[data-scenario]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.scenario===state.scenario)));
    $('move-on-map').setAttribute('aria-pressed',String(state.placing));
    $('move-on-map').textContent=state.placing?'Cancel placing':'Place person B';
    $('map-instruction').textContent=state.placing?'Click clear ground to place '+names[state.b]+' (occupant B).':'Select a person on the map as B, or use the pair selectors.';
    world.style.cursor=state.placing?'crosshair':'';
    for(const input of $('ties').querySelectorAll('input'))input.checked=state.edges.some(([a,b])=>key(a,b)===input.value);
  }
  function pause(syncFields=true) {state.playing=false;$('play').textContent='▶ Run simulation';$('run-state').textContent='Paused';$('run-state').classList.remove('running');if(syncFields)syncPositionFields();}
  function preset(which) {
    pause();walks.clear();error();state.positions=structuredClone(basePositions);state.edges=structuredClone(defaultEdges);state.a='a';state.b={far:'b',near:'c',detour:'d'}[which];state.scenario=which;state.placing=false;
    if(which==='detour'){state.positions.a={x:77,z:80};state.positions.d={x:143,z:80};}
    syncControls();refresh();
  }
  ids.forEach(id=>{
    ['person-a','person-b'].forEach(selectId=>{const option=document.createElement('option');option.value=id;option.textContent=id.toUpperCase()+' · '+names[id];$(selectId).appendChild(option);});
  });
  ids.forEach((a,i)=>ids.slice(i+1).forEach(b=>{
    const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=key(a,b);input.setAttribute('aria-label',names[a]+' and '+names[b]+' friendship');label.append(input,document.createTextNode(a.toUpperCase()+'–'+b.toUpperCase()));$('ties').appendChild(label);
    input.addEventListener('change',()=>{state.edges=state.edges.filter(([x,y])=>key(x,y)!==input.value);if(input.checked)state.edges.push([a,b]);state.scenario='';syncControls();refresh(false);});
  }));
  ['a','b'].forEach(which=>$('person-'+which).addEventListener('change',()=>{state[which]=$('person-'+which).value;state.scenario='';state.placing=false;error();syncControls();refresh();}));
  $('swap').addEventListener('click',()=>{[state.a,state.b]=[state.b,state.a];state.scenario='';syncControls();refresh();});
  document.querySelectorAll('[data-scenario]').forEach(button=>button.addEventListener('click',()=>preset(button.dataset.scenario)));
  $('reset').addEventListener('click',()=>preset('far'));
  $('speed').addEventListener('change',()=>state.speed=Number($('speed').value));
  $('move-on-map').addEventListener('click',()=>{pause();state.placing=!state.placing;error();syncControls();});
  world.addEventListener('click',event=>{
    if(!state.placing)return;
    const screen=world.createSVGPoint();screen.x=event.clientX;screen.y=event.clientY;
    const p=screen.matrixTransform(map.getScreenCTM().inverse());const point={x:p.x,z:p.y};
    if(router.pointStatus(point)!=='ok'){error('Choose clear ground inside the plaza, outside the pond and buildings.');return;}
    state.positions[state.b]=point;walks.delete(state.b);state.placing=false;state.scenario='';error();syncControls();refresh();
  });
  function parsePosition(value) {
    const number='[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
    const match=value.match(new RegExp('^\\s*('+number+')\\s*,\\s*('+number+')\\s*$'));
    if(!match)return null;
    const p={x:Number(match[1]),z:160-Number(match[2])};
    return Number.isFinite(p.x)&&Number.isFinite(p.z)&&router.pointStatus(p)==='ok'?p:null;
  }
  ['position-a','position-b'].forEach(id=>$(id).addEventListener('focus',()=>pause(false)));
  function applyPositions() {
    const a=parsePosition($('position-a').value),b=parsePosition($('position-b').value);pause(false);
    if(!a||!b){error('Enter X, Y on clear ground (X: 0–240; Y: 0–160), outside the pond and buildings.');return;}
    if(state.a===state.b&&D.euclidean(a,b)>.001){error('The same person must have the same position in both fields.');return;}
    state.positions[state.a]=a;state.positions[state.b]=b;walks.clear();state.scenario='';error();syncControls();refresh();
  }
  $('apply-positions').addEventListener('click',applyPositions);
  ['position-a','position-b'].forEach(id=>$(id).addEventListener('keydown',e=>{if(e.key==='Enter')applyPositions();}));
  function nextWalk(id) {
    const previous=walks.get(id),step=previous?previous.step+1:ids.indexOf(id)*2;
    const target=destinations[step%destinations.length];
    const path=router.route(state.positions[id],target).path;
    const walk={path,index:1,step};walks.set(id,walk);return walk;
  }
  function advance(id,distance) {
    let walk=walks.get(id)||nextWalk(id),guard=0;
    while(distance>0&&guard++<20) {
      if(walk.index>=walk.path.length){walk=nextWalk(id);if(walk.path.length<2)return;}
      const p=state.positions[id],target=walk.path[walk.index],length=D.euclidean(p,target);
      if(distance>=length){state.positions[id]={...target};distance-=length;walk.index++;}
      else {const t=distance/length;state.positions[id]={x:p.x+(target.x-p.x)*t,z:p.z+(target.z-p.z)*t};distance=0;}
    }
  }
  $('play').addEventListener('click',()=>{
    if(state.playing){pause();return;}
    state.playing=true;state.placing=false;state.scenario='';error();syncControls();$('play').textContent='Ⅱ Pause simulation';$('run-state').textContent='Running';$('run-state').classList.add('running');lastTime=0;
  });
  function tick(time) {
    const dt=lastTime?Math.min((time-lastTime)/1000,.1):0;lastTime=time;
    if(state.playing){ids.forEach(id=>advance(id,dt*1.4*state.speed));drawMap();if(time-lastMeasure>180){refresh(false);lastMeasure=time;}}
    requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  try {preset('far');requestAnimationFrame(tick);}catch(e){error('The simulation could not initialize: '+e.message);}
})();
