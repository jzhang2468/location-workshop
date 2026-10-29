/* Common Ground: a fictional, self-contained location and relationship experiment. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const D = window.DistanceMath;
  const NS = 'http://www.w3.org/2000/svg';
  const names = {a:'Ava',b:'Ben',c:'Cleo',d:'Dev',e:'Emi',f:'Finn'};
  const ids = Object.keys(names);
  const colors = {a:'#efbc77',b:'#9bd2c8',c:'#c3b0df',d:'#a4bddd',e:'#d8ce9e',f:'#d8a8b3'};
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
  const motion = window.SocialMotion.create({ids,router,bounds:{minX:0,maxX:240,minZ:0,maxZ:160},speed:1.4});
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
  let plaza,measurement;
  function placePerson(point) {
    if(!state.placing)return;
    if(router.pointStatus(point)!=='ok'){error('Choose clear ground outside the pond and buildings.');return;}
    state.positions[state.b]={x:point.x,z:point.z};state.placing=false;state.scenario='';error();syncControls();refresh();
  }
  try {
    plaza=window.createPlazaScene({host:world,buildings,pond,names,colors,
      onSelect:id=>{if(state.placing)return;state.b=id;state.scenario='';syncControls();refresh();},
      onPlace:placePerson,onViewChange:view=>document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)))});
  } catch(sceneError) {
    const notice=document.createElement('p');notice.className='scene-unavailable';notice.textContent='The 3D view needs WebGL. Measurements, friendship editing and the comparison chart remain available.';world.appendChild(notice);
    console.error(sceneError);
  }
  function drawMap() {
    if(plaza)plaza.update({positions:state.positions,a:state.a,b:state.b,playing:state.playing,
      path:measurement?.walking.path||[],spatial:measurement?.spatial||0,social:measurement?.social.distance??0,edges:state.edges,motion:motion.status()});
  }
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    plaza?.setView(button.dataset.view);
  }));
  $('reset-view').addEventListener('click',()=>{
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view==='perspective')));
    plaza?.setView('perspective');plaza?.resetView();
  });
  function drawNetwork(result) {
    const host=$('network');host.replaceChildren();
    const pos={a:[32,82],b:[97,32],d:[181,32],f:[290,80],e:[181,127],c:[97,127]};
    const activeEdges=new Set(result.path.slice(1).map((id,i)=>key(result.path[i],id)));
    state.edges.forEach(([a,b])=>{const active=activeEdges.has(key(a,b));svg('line',{x1:pos[a][0],y1:pos[a][1],x2:pos[b][0],y2:pos[b][1],stroke:active?'#99cbc2':'#384446','stroke-width':active?3:1.5},host);});
    ids.forEach(id=>{
      const [x,y]=pos[id],selected=id===state.a||id===state.b;
      if(selected)svg('circle',{cx:x,cy:y,r:15,fill:'none',stroke:colors[id],'stroke-width':1.5},host);
      svg('circle',{cx:x,cy:y,r:11,fill:result.path.includes(id)?colors[id]:'#263236'},host);
      label(host,id.toUpperCase(),x,y+3.5,{'text-anchor':'middle','font-size':10,'font-weight':600,fill:result.path.includes(id)?'#172020':'#b6beb7'});
      label(host,names[id],x,y+28,{'text-anchor':'middle','font-size':10,fill:'#a3b0ab'});
    });
  }
  function drawChart() {
    const host=$('comparison');host.replaceChildren();
    const ox=43,oy=191,width=360,height=120;
    const values=ids.map(id=>({id,x:D.euclidean(state.positions[state.a],state.positions[id]),y:social(state.a,id).distance}));
    const maximum=Math.max(200,Math.ceil(Math.max(...values.map(p=>p.x))/50)*50);
    const x=v=>ox+width*v/maximum,y=v=>Number.isFinite(v)?oy-v*height/5:32;
    svg('rect',{x:ox,y:y(1),width:width*40/maximum,height:height/5,fill:'#223832'},host);
    for(let hop=0;hop<=5;hop++) {
      svg('line',{x1:ox,y1:y(hop),x2:ox+width,y2:y(hop),stroke:'#303b3b','stroke-width':1},host);
      label(host,String(hop),ox-10,y(hop)+4,{'text-anchor':'end','font-size':10,fill:'#a1b1ab'});
    }
    svg('line',{x1:ox,y1:32,x2:ox+width,y2:32,stroke:'#4a5654','stroke-dasharray':'3 4'},host);
    label(host,'∞',ox-10,36,{'text-anchor':'end','font-size':13,fill:'#a1b1ab'});
    label(host,'SOCIAL · LINKS',ox,13,{'font-size':10,fill:'#99cbc2','letter-spacing':.6});
    for(let t=0;t<=maximum;t+=50)label(host,String(t),x(t),oy+19,{'text-anchor':'middle','font-size':10,fill:'#a1b1ab'});
    label(host,'SPATIAL · METRES',ox+width,oy+42,{'text-anchor':'end','font-size':10,fill:'#efbc77','letter-spacing':.6});
    svg('line',{x1:x(40),y1:60,x2:x(40),y2:oy,stroke:'#52645b','stroke-dasharray':'3 4'},host);
    label(host,'40 m',x(40)+4,61,{'font-size':9,fill:'#a1b1ab'});
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
    const result=measure();measurement=result;drawMap();
    $('spatial-value').textContent=fmt(result.spatial);
    $('social-value').textContent=Number.isFinite(result.social.distance)?String(result.social.distance):'∞';
    $('social-unit').textContent=result.social.connected?(result.social.distance===1?'friendship link':'friendship links'):'no connecting chain';
    const message=insight(result);if($('insight').textContent!==message)$('insight').textContent=message;
    $('walking-value').textContent=result.walking.status==='ok'?fmt(result.walking.distance)+' m':'No route';
    const extra=result.walking.distance-result.spatial;
    $('route-note').textContent=result.walking.status!=='ok'?'These positions cannot be connected by the modeled route.':extra>.1?'+'+extra.toFixed(1)+' m beyond the direct line · approximate route.':'A clear route · the walk matches the straight line.';
    $('chain').textContent=result.social.connected?result.social.path.map(id=>names[id]).join(' → '):'No chain. Add a friendship to reconnect the groups.';
    $('addresses').textContent='A · '+names[state.a]+' occupies '+location(state.positions[state.a])+'. B · '+names[state.b]+' occupies '+location(state.positions[state.b])+'.';
    drawNetwork(result.social);drawChart();drawBehavior();
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
    $('map-instruction').textContent=state.placing?'Click clear ground to place '+names[state.b]+' (occupant B).':'Drag to orbit · scroll to zoom · select a person';
    plaza?.setPlacing(state.placing);world.style.cursor=state.placing?'crosshair':'';
    for(const input of $('ties').querySelectorAll('input'))input.checked=state.edges.some(([a,b])=>key(a,b)===input.value);
    const same=state.a===state.b,friend=state.edges.some(([a,b])=>key(a,b)===key(state.a,state.b));
    $('pair-friend').disabled=same;$('pair-friend').checked=!same&&friend;
    $('pair-friend').setAttribute('aria-label',names[state.a]+' and '+names[state.b]+' are friends');
    $('friendship-label').textContent=same?'Same person':friend?'Friends':'Not friends';
    motion.sync({positions:state.positions,edges:state.edges,preferredPair:[state.a,state.b]});
  }
  function drawBehavior() {
    const status=motion.status(),a=status.agents[state.a],paired=a?.partner===state.b&&state.a!==state.b;
    let title,detail,mode=paired?a.mode:'wandering';
    if(state.a===state.b) {
      title='One visitor selected';detail=names[state.a]+' explores independently. Choose two people to try friendship.';
    } else if(paired&&a.mode==='together') {
      title=state.playing?'Walking together':'Together · paused';detail=names[state.a]+' + '+names[state.b]+' share destinations and follow the same route, a few metres apart.';
    } else if(paired) {
      title=state.playing?'Finding each other':'Ready to meet';detail=names[state.a]+' + '+names[state.b]+(state.playing?' are taking a shared route to meet.':' will approach each other when you press Run.');
    } else {
      title=state.playing?'Independent walks':'Ready to wander';detail='Each selected person chooses a random destination. They do not seek or follow each other.';
    }
    $('motion-readout').dataset.mode=mode;
    if($('motion-title').textContent!==title)$('motion-title').textContent=title;
    if($('motion-detail').textContent!==detail)$('motion-detail').textContent=detail;
  }
  function pause(syncFields=true) {state.playing=false;$('play').textContent='▶ Run simulation';$('run-state').textContent='Paused';$('run-state').classList.remove('running');if(syncFields)syncPositionFields();drawMap();drawBehavior();}
  function preset(which) {
    pause();error();state.positions=structuredClone(basePositions);state.edges=structuredClone(defaultEdges);state.a='a';state.b={far:'b',near:'c',detour:'d'}[which];state.scenario=which;state.placing=false;
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
  $('pair-friend').addEventListener('change',()=>{
    if(state.a===state.b)return;
    state.edges=state.edges.filter(([a,b])=>key(a,b)!==key(state.a,state.b));
    if($('pair-friend').checked)state.edges.push([state.a,state.b]);
    state.scenario='';error();syncControls();refresh(false);
  });
  ['a','b'].forEach(which=>$('person-'+which).addEventListener('change',()=>{state[which]=$('person-'+which).value;state.scenario='';state.placing=false;error();syncControls();refresh();}));
  $('swap').addEventListener('click',()=>{[state.a,state.b]=[state.b,state.a];state.scenario='';syncControls();refresh();});
  document.querySelectorAll('[data-scenario]').forEach(button=>button.addEventListener('click',()=>preset(button.dataset.scenario)));
  $('reset').addEventListener('click',()=>preset('far'));
  $('speed').addEventListener('change',()=>state.speed=Number($('speed').value));
  $('move-on-map').addEventListener('click',()=>{pause();state.placing=!state.placing;error();syncControls();});
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
    state.positions[state.a]=a;state.positions[state.b]=b;state.scenario='';error();syncControls();refresh();
  }
  $('apply-positions').addEventListener('click',applyPositions);
  ['position-a','position-b'].forEach(id=>$(id).addEventListener('keydown',e=>{if(e.key==='Enter')applyPositions();}));
  $('play').addEventListener('click',()=>{
    if(state.playing){pause();refresh();return;}
    state.playing=true;state.placing=false;state.scenario='';error();syncControls();$('play').textContent='Ⅱ Pause simulation';$('run-state').textContent='Running';$('run-state').classList.add('running');drawBehavior();lastTime=0;
  });
  function tick(time) {
    const dt=lastTime?Math.min((time-lastTime)/1000,.1):0;lastTime=time;
    if(state.playing){motion.step(dt*state.speed);drawMap();if(time-lastMeasure>180){refresh(false);lastMeasure=time;}}
    requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  try {preset('far');requestAnimationFrame(tick);}catch(e){error('The simulation could not initialize: '+e.message);}
})();
