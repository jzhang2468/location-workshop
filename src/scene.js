/* A small, self-contained Three.js architectural view of the Common Ground model. */
(() => {
  'use strict';
  window.createPlazaScene = function createPlazaScene({host, buildings, pond, names, colors, onSelect, onPlace, onViewChange}) {
    if (!window.THREE) throw new Error('The 3D renderer could not be loaded.');
    const T = window.THREE;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = new T.Scene();
    scene.background = new T.Color('#101716');
    const renderer = new T.WebGLRenderer({antialias:true, alpha:false, powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.28;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    host.classList.add('cg-scene');
    host.style.position = 'relative';
    const canvas = renderer.domElement;
    canvas.className = 'scene-canvas';
    canvas.style.cssText = 'display:block;position:absolute;inset:0;width:100%;height:100%;touch-action:none;outline:none;';
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Interactive three-dimensional plaza. Drag to orbit; scroll to zoom. Arrow keys orbit, plus and minus zoom, Home resets. Select a person using their label.');
    host.appendChild(canvas);
    const labels = document.createElement('div');
    labels.className = 'scene-labels';
    labels.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
    host.appendChild(labels);
    const camera = new T.OrthographicCamera(-150,150,110,-110,1,1400);
    const target = new T.Vector3(120,0,80);
    let width=1, height=1, visible=true, destroyed=false, placing=false, dirty=true;
    let state={positions:{},a:'a',b:'b',playing:false,path:[]};
    const defaultOrbit={theta:-.60, elevation:.77, zoom:1};
    let orbit={...defaultOrbit}, goal={...defaultOrbit};
    let currentView='perspective';
    const fixed = new T.Group();
    scene.add(fixed);
    const material = (color, props={}) => new T.MeshStandardMaterial({color,roughness:.78,metalness:0,...props});
    const materials = {
      paving:material('#c5beac'), stone:material('#dfd6c3'), roof:material('#eee7da'), edge:material('#9f9b8c'),
      plinth:material('#747b6e'), glass:material('#36574f',{roughness:.24,metalness:.42}),
      dark:material('#39483e'), trim:material('#c1b499',{roughness:.55,metalness:.3}),
      trunk:material('#6d7058'), leaves:material('#71846d'), leavesLight:material('#8d9a77'), leavesDark:material('#586f5e'),
      water:material('#365c55',{roughness:.21,metalness:.65}), poolBase:material('#697b70'),
      path:new T.MeshBasicMaterial({color:'#547d70',toneMapped:false}),
      direct:new T.MeshBasicMaterial({color:'#dba449',depthTest:false,toneMapped:false}),
      ripple:new T.MeshBasicMaterial({color:'#86a69a',transparent:true,opacity:.22,depthWrite:false}),
    };
    const boxGeometry=new T.BoxGeometry(1,1,1);
    const cylinderGeometry=new T.CylinderGeometry(1,1,1,16);
    const sphereGeometry=new T.SphereGeometry(1,16,12);
    const branchGeometry=new T.CylinderGeometry(.45,.65,1,7);
    const leafGeometry=new T.IcosahedronGeometry(1,1);
    const lineGeometry=new T.CylinderGeometry(1,1,1,8);
    const addBox=(parent,x,y,z,sx,sy,sz,mat)=>{
      const mesh=new T.Mesh(boxGeometry,mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
    };
    const addCylinder=(parent,x,y,z,r,h,mat,segments)=>{
      const mesh=new T.Mesh(segments?new T.CylinderGeometry(r,r,h,segments):cylinderGeometry,mat);
      mesh.position.set(x,y,z);if(!segments)mesh.scale.set(r,h,r);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
    };
    const addSphere=(parent,x,y,z,r,mat,geometry=sphereGeometry)=>{
      const mesh=new T.Mesh(geometry,mat);mesh.position.set(x,y,z);mesh.scale.setScalar(r);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
    };
    const ground=addBox(fixed,120,-1.7,80,240,3.4,160,materials.plinth);
    addBox(fixed,120,-.12,80,240,.24,160,materials.paving);
    const lower=addBox(fixed,120,-3.7,80,243,.6,163,materials.dark);
    lower.castShadow=false;
    // A fine inscribed paving grid gives scale without implying inaccessible areas.
    const gridPositions=[];
    for(let x=0;x<=240;x+=10)gridPositions.push(x,.025,0,x,.025,160);
    for(let z=0;z<=160;z+=10)gridPositions.push(0,.025,z,240,.025,z);
    const gridGeometry=new T.BufferGeometry();gridGeometry.setAttribute('position',new T.Float32BufferAttribute(gridPositions,3));
    fixed.add(new T.LineSegments(gridGeometry,new T.LineBasicMaterial({color:'#666d5e',transparent:true,opacity:.18})));
    // Two broad, flush stone bands connect the otherwise open plaza.
    const bandMat=material('#d7cfbd');
    addBox(fixed,120,.018,80,240,.025,18,bandMat).castShadow=false;
    addBox(fixed,110,.022,80,16,.025,160,bandMat).castShadow=false;
    // Scribed expansion joints remain visible across the main axes.
    const axisPositions=[];
    for(let x=0;x<=240;x+=10)axisPositions.push(x,.045,71,x,.045,89);
    for(let z=0;z<=160;z+=10)axisPositions.push(102,.045,z,118,.045,z);
    const axisGeometry=new T.BufferGeometry();axisGeometry.setAttribute('position',new T.Float32BufferAttribute(axisPositions,3));
    fixed.add(new T.LineSegments(axisGeometry,new T.LineBasicMaterial({color:'#8d9180',transparent:true,opacity:.23})));
    const architectureLabels=[];
    function makeLabel(text,className,position) {
      const el=document.createElement('div');el.className='scene-label '+className;el.textContent=text;
      el.style.cssText='position:absolute;transform:translate(-50%,-100%);white-space:nowrap;pointer-events:none;';
      labels.appendChild(el);const entry={el,position};architectureLabels.push(entry);return entry;
    }
    buildings.forEach((b,i)=>{
      const h=[10,8.5,7.5][i] || 9, cx=b.x+b.w/2, cz=b.z+b.h/2;
      const group=new T.Group();fixed.add(group);
      // Every wall, overhang and step stays within the exact routed footprint.
      addBox(group,cx,.25,cz,b.w,.5,b.h,materials.edge);
      addBox(group,cx,h/2+.4,cz,b.w-.7,h-.8,b.h-.7,materials.stone);
      const facadeZ=b.z+b.h-.35;
      addBox(group,cx,3.4,facadeZ,b.w-3,4.6,.12,materials.glass);
      addBox(group,cx,5.85,facadeZ+.04,b.w-2,.22,.24,materials.trim);
      addBox(group,cx,1.05,facadeZ+.04,b.w-2,.22,.24,materials.trim);
      for(let x=b.x+2;x<b.x+b.w-1;x+=3.4) {
        addBox(group,x,3.5,facadeZ+.14,.22,5,.45,materials.stone);
      }
      // Side glazing, deep piers and an inset roof make the mass legible in orbit.
      addBox(group,b.x+.3,3.3,cz,.12,4.1,b.h-4,materials.glass);
      for(let z=b.z+2;z<b.z+b.h-1;z+=4)addBox(group,b.x+.15,3.4,z,.5,4.9,.28,materials.stone);
      addBox(group,cx,h-.18,cz,b.w,.55,b.h,materials.roof);
      addBox(group,cx,h+.21,cz,b.w-2,.22,b.h-2,materials.edge);
      addBox(group,cx,h+.37,cz,b.w-3,.15,b.h-3,materials.roof);
      // Slim skylights and roof ribs echo an architectural competition model.
      const skylightW=Math.min(b.w*.45,19);
      addBox(group,cx,h+.65,cz,skylightW,.45,4.5,materials.glass);
      for(let n=0;n<6;n++)addBox(group,cx-skylightW/2+n*skylightW/5,h+.91,cz,.12,.09,4.7,materials.trim);
      const doorX=cx+b.w*.22;
      addBox(group,doorX,2.1,facadeZ+.15,2.8,3.6,.14,materials.dark);
      addBox(group,doorX,2.1,facadeZ+.25,.12,3.6,.1,materials.trim);
      makeLabel(b.name,'place-label',new T.Vector3(cx,h+3.4,cz));
    });
    // The raised rim, water and basin all use the model's exact circular boundary.
    addCylinder(fixed,pond.x,.2,pond.z,pond.radius,.4,materials.poolBase,96);
    addCylinder(fixed,pond.x,.43,pond.z,pond.radius-.7,.2,materials.water,96);
    const rim=new T.Mesh(new T.TorusGeometry(pond.radius-.35,.35,8,96),materials.stone);
    rim.rotation.x=Math.PI/2;rim.position.set(pond.x,.54,pond.z);rim.receiveShadow=true;fixed.add(rim);
    const rippleRings=[];
    [6.5,12,18].forEach((r,i)=>{
      const ring=new T.Mesh(new T.RingGeometry(r,r+.075,96),materials.ripple.clone());
      ring.rotation.x=-Math.PI/2;ring.position.set(pond.x,.55+i*.005,pond.z);fixed.add(ring);rippleRings.push(ring);
    });
    makeLabel('REFLECTING POOL','place-label water-label',new T.Vector3(pond.x,.8,pond.z+10));
    // Sparse schematic planting is decoration; it adds no hidden route barriers.
    function tree(x,z,r=3.8,h=8) {
      const group=new T.Group();group.position.set(x,0,z);fixed.add(group);
      const trunk=new T.Mesh(branchGeometry,materials.trunk);trunk.scale.y=h*.65;trunk.position.y=h*.32;trunk.castShadow=true;group.add(trunk);
      addSphere(group,0,h*.74,0,r,materials.leaves,leafGeometry).scale.set(r,r*.82,r);
      addSphere(group,-r*.42,h*.77,r*.13,r*.67,materials.leavesDark,leafGeometry);
      addSphere(group,r*.28,h*.96,-r*.13,r*.65,materials.leavesLight,leafGeometry);
    }
    [[12,15,3.8,8],[14,36,4,8.2],[13,143,4.1,8.5],[26,136,3.6,7.5],[18,119,4,8],
      [83,13,3.7,8],[149,15,3.7,7.5],[224,19,4,8.7],[226,41,3.5,8],[222,78,4.2,9],
      [218,96,3.5,8],[211,145,3.7,8],[233,138,3.3,7.5],[86,145,3.7,8.2]].forEach(p=>tree(...p));
    // Thin engraved perimeter measurements, a north arrow, and corner inlays.
    const inlay=material('#727c6a');
    for(const [x,z] of [[3,3],[237,3],[3,157],[237,157]]) {
      addBox(fixed,x,.06,z,3,.03,.12,inlay).castShadow=false;
      addBox(fixed,x,.06,z,.12,.03,3,inlay).castShadow=false;
    }
    const backdrop=addBox(scene,120,-4.1,80,2000,.15,2000,new T.ShadowMaterial({color:'#000000',opacity:.3}));
    backdrop.castShadow=false;backdrop.receiveShadow=true;
    scene.add(new T.AmbientLight('#d9e4dc',.7));
    const hemisphere=new T.HemisphereLight('#f0e8d4','#3b5547',2.2);scene.add(hemisphere);
    const sun=new T.DirectionalLight('#fff0d8',4.2);sun.position.set(-30,180,-30);sun.target.position.set(120,0,80);
    sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-190;sun.shadow.camera.right=190;sun.shadow.camera.top=150;sun.shadow.camera.bottom=-150;
    sun.shadow.camera.near=20;sun.shadow.camera.far=500;sun.shadow.bias=-.0004;sun.shadow.normalBias=.25;sun.shadow.radius=3;
    scene.add(sun,sun.target);
    const fill=new T.DirectionalLight('#9bbbae',.75);fill.position.set(250,100,200);scene.add(fill);
    const agents=new Map(),pickable=[];
    const ringGeometry=new T.RingGeometry(2.15,2.46,48);
    const diskGeometry=new T.CircleGeometry(1.85,48);
    Object.keys(names).forEach((id,i)=>{
      const group=new T.Group();group.userData.person=id;scene.add(group);
      const tint=new T.Color(colors[id] || '#789a89');tint.lerp(new T.Color('#e1dccc'),.16);
      const personMat=material(tint,{roughness:.7});
      const haloMat=new T.MeshBasicMaterial({color:'#eddcc0',transparent:true,opacity:.8,side:T.DoubleSide});
      const ring=new T.Mesh(ringGeometry,haloMat);ring.rotation.x=-Math.PI/2;ring.position.y=.14;group.add(ring);
      const disk=new T.Mesh(diskGeometry,new T.MeshBasicMaterial({color:tint,transparent:true,opacity:.19,depthWrite:false}));disk.rotation.x=-Math.PI/2;disk.position.y=.12;group.add(disk);
      const person=new T.Group();group.add(person);
      const torso=addCylinder(person,0,2.15,0,.74,2.15,personMat);
      torso.scale.set(.8,1.95,.54);
      addSphere(person,0,3.9,0,.7,material('#e7d1b0'));
      const legs=[];
      [-.32,.32].forEach(x=>{const leg=addBox(person,x,.63,0,.35,1.05,.4,materials.dark);legs.push(leg);});
      const armMat=personMat;
      [-.83,.83].forEach(x=>{const arm=addBox(person,x,2.1,0,.27,1.5,.35,armMat);arm.rotation.z=x>0?-.1:.1;});
      const hit=new T.Mesh(new T.SphereGeometry(3.7,12,8),new T.MeshBasicMaterial({visible:false}));hit.position.y=2;hit.userData.person=id;group.add(hit);pickable.push(hit);
      const label=document.createElement('button');label.type='button';label.className='scene-label agent-label';label.setAttribute('aria-label','Select '+names[id]+' as person B');
      label.style.cssText='position:absolute;transform:translate(-50%,-100%);white-space:nowrap;pointer-events:auto;';
      const dot=document.createElement('span');dot.className='scene-label-dot';dot.style.background=tint.getStyle();
      const name=document.createElement('span');name.className='scene-label-name';name.textContent=names[id];
      const role=document.createElement('small');role.hidden=true;
      const motionStatus=document.createElement('span');motionStatus.className='scene-motion-status';motionStatus.hidden=true;motionStatus.setAttribute('aria-hidden','true');
      motionStatus.style.cssText='display:inline-flex;align-items:center;justify-content:center;min-width:9px;margin-left:1px;font-size:10px;line-height:1;opacity:.8;';
      label.append(dot,name,role,motionStatus);labels.appendChild(label);
      label.addEventListener('click',event=>{event.stopPropagation();if(!placing&&onSelect)onSelect(id);});
      agents.set(id,{group,person,ring,disk,label,role,motionStatus,legs,index:i,hasPosition:false,movedSinceRender:false,gaitPhase:i,motionMode:null,screen:{x:0,y:0},position:new T.Vector3()});
    });
    const distanceLabel=document.createElement('div');distanceLabel.className='scene-label distance-label';distanceLabel.style.cssText='position:absolute;transform:translate(-50%,-50%);white-space:nowrap;pointer-events:none;z-index:5;';labels.appendChild(distanceLabel);
    const direct=new T.Mesh(lineGeometry,materials.direct);direct.renderOrder=20;scene.add(direct);
    const directCaps=[new T.Mesh(sphereGeometry,materials.direct),new T.Mesh(sphereGeometry,materials.direct)];
    directCaps.forEach(cap=>{cap.scale.setScalar(.6);cap.renderOrder=21;scene.add(cap);});
    const routeGroup=new T.Group();scene.add(routeGroup);
    const routeSegments=[];
    const up=new T.Vector3(0,1,0),segmentDirection=new T.Vector3(),segmentStart=new T.Vector3(),segmentEnd=new T.Vector3();
    function positionSegment(mesh,a,b,radius) {
      segmentDirection.subVectors(b,a);const length=segmentDirection.length();
      mesh.visible=length>.0001;mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.set(radius,length,radius);
      if(length>.0001)mesh.quaternion.setFromUnitVectors(up,segmentDirection.multiplyScalar(1/length));
    }
    let pathKey='';
    function updatePath(path=[]) {
      const nextKey=path.map(p=>p.x.toFixed(2)+','+p.z.toFixed(2)).join(';');
      if(nextKey===pathKey)return;pathKey=nextKey;
      let used=0,phase=0;
      for(let i=1;i<path.length;i++) {
        const a=path[i-1],b=path[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(!len)continue;
        let at=0;
        while(at<len) {
          const cycle=phase%4.6,remaining=(cycle<3.1?3.1:4.6)-cycle,step=Math.min(remaining,len-at);
          if(cycle<3.1&&step>.02) {
            if(!routeSegments[used]) {routeSegments[used]=new T.Mesh(lineGeometry,materials.path);routeGroup.add(routeSegments[used]);}
            segmentStart.set(a.x+dx*at/len,.36,a.z+dz*at/len);
            segmentEnd.set(a.x+dx*(at+step)/len,.36,a.z+dz*(at+step)/len);
            positionSegment(routeSegments[used++],segmentStart,segmentEnd,.42);
          }
          at+=step;phase+=step;
          // Avoid accumulated floating-point residue at a dash boundary.
          if(Math.abs(phase/4.6-Math.round(phase/4.6))<1e-8)phase=Math.round(phase/4.6)*4.6;
          if(step<1e-7){at+=.001;phase+=.001;}
        }
      }
      for(let i=used;i<routeSegments.length;i++)routeSegments[i].visible=false;
    }
    function neutralPose(item) {
      if(item.legs[0].rotation.x!==0||item.legs[1].rotation.x!==0||item.person.position.y!==0) {
        item.legs[0].rotation.x=0;item.legs[1].rotation.x=0;item.person.position.y=0;dirty=true;
      }
    }
    function motionDescription(id) {
      const motion=state.motion?.agents?.[id],partner=motion?.partner&&names[motion.partner];
      const descriptions={
        approaching:partner?'Approaching '+partner:'Approaching a companion',
        together:partner?'Walking with '+partner:'Walking with a companion',
        wandering:'Wandering independently',
        waiting:partner?'Waiting for '+partner:'Waiting',
      };
      return {mode:motion?.mode||null,text:descriptions[motion?.mode]||'Independent movement',
        symbol:{approaching:'↗',together:'↔',wandering:'·',waiting:'Ⅱ'}[motion?.mode]||''};
    }
    function update(next) {
      state={...state,...next};
      for(const [id,item] of agents) {
        const p=state.positions[id];if(!p)continue;
        const dx=p.x-item.group.position.x,dz=p.z-item.group.position.z,travel=Math.hypot(dx,dz);
        if(item.hasPosition&&state.playing&&travel>1e-6) {
          item.person.rotation.y=Math.atan2(dx,dz);
          item.movedSinceRender=true;item.gaitPhase=(item.gaitPhase+travel*2.8)%(Math.PI*2);
        }
        item.group.position.set(p.x,0,p.z);item.hasPosition=true;
        const motion=motionDescription(id);item.motionMode=motion.mode;
        if(!state.playing||motion.mode==='waiting') {item.movedSinceRender=false;neutralPose(item);}
        const selected=id===state.a||id===state.b;
        item.ring.visible=selected;item.disk.scale.setScalar(selected?1.3:.83);
        item.label.classList.toggle('selected',selected);item.label.classList.toggle('endpoint-a',id===state.a);item.label.classList.toggle('endpoint-b',id===state.b);
        item.role.hidden=!selected;item.role.textContent=id===state.a&&id===state.b?'A·B':id===state.a?'A':'B';
        item.label.setAttribute('aria-pressed',String(id===state.b));
        const occupant=id===state.a&&id===state.b?'occupants A and B':id===state.a?'occupant A':id===state.b?'occupant B':'';
        const description=names[id]+(occupant?', '+occupant:'')+'. '+(!state.playing?'Paused. ':'')+motion.text+'.';
        item.label.title=description;
        item.label.setAttribute('aria-label',description+' Select as occupant B.');
        item.label.dataset.motion=motion.mode||'independent';
        item.motionStatus.hidden=!motion.mode;item.motionStatus.textContent=motion.symbol;
        item.motionStatus.title=motion.text;
      }
      const a=state.positions[state.a],b=state.positions[state.b];
      if(a&&b) {
        segmentStart.set(a.x,.85,a.z);segmentEnd.set(b.x,.85,b.z);positionSegment(direct,segmentStart,segmentEnd,.35);
        directCaps[0].position.copy(segmentStart);directCaps[1].position.copy(segmentEnd);
        directCaps.forEach(cap=>cap.visible=Math.hypot(a.x-b.x,a.z-b.z)>.01);
        distanceLabel.textContent=(Number.isFinite(state.spatial)?state.spatial:Math.hypot(a.x-b.x,a.z-b.z)).toFixed(1)+' m';
      }
      if(next.path)updatePath(next.path);
      dirty=true;
    }
    function updateCamera() {
      const aspect=width/height;
      // At any screen ratio, retain the complete 240 × 160 m maquette with a quiet margin.
      const extent=Math.max(107,166/aspect)/orbit.zoom;
      camera.left=-extent*aspect;camera.right=extent*aspect;camera.top=extent;camera.bottom=-extent;
      const horizontal=Math.cos(orbit.elevation)*360;
      camera.position.set(target.x+Math.sin(orbit.theta)*horizontal,target.y+Math.sin(orbit.elevation)*360,target.z+Math.cos(orbit.theta)*horizontal);
      camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    }
    const projection=new T.Vector3();
    function project(position) {projection.copy(position).project(camera);return {x:(projection.x*.5+.5)*width,y:(-.5*projection.y+.5)*height,visible:projection.z>-1&&projection.z<1};}
    function layoutLabels() {
      const placed=[];
      // Selected occupants win collisions; other captions move upwards in short steps.
      const sorted=[...agents.entries()].sort(([a],[b])=>Number(b===state.a||b===state.b)-Number(a===state.a||a===state.b));
      for(const [id,item] of sorted) {
        if(!state.positions[id]){item.label.hidden=true;continue;}
        item.position.copy(item.group.position);item.position.y=7;
        const p=project(item.position),w=item.label.offsetWidth||68,h=item.label.offsetHeight||27;
        let x=Math.max(w/2+8,Math.min(width-w/2-8,p.x)),y=p.y;
        for(let attempt=0;attempt<5;attempt++) {
          if(!placed.some(r=>x+w/2+5>r.left&&x-w/2-5<r.right&&y>r.top&&y-h<r.bottom))break;
          y-=h+5;
        }
        y=Math.max(h+8,Math.min(height-8,y));
        item.label.hidden=!p.visible;item.label.style.left=x+'px';item.label.style.top=y+'px';
        item.label.style.zIndex=id===state.a||id===state.b?'8':'6';
        placed.push({left:x-w/2,right:x+w/2,top:y-h,bottom:y});
      }
      const a=state.positions[state.a],b=state.positions[state.b];
      if(a&&b) {
        const p=project(new T.Vector3((a.x+b.x)/2,1,(a.z+b.z)/2));
        distanceLabel.style.left=p.x+'px';distanceLabel.style.top=(p.y-13)+'px';
        distanceLabel.hidden=!p.visible||Math.hypot(a.x-b.x,a.z-b.z)<15;
      } else distanceLabel.hidden=true;
      architectureLabels.forEach(item=>{
        const p=project(item.position),w=item.el.offsetWidth||96,h=item.el.offsetHeight||18;
        const crowded=placed.some(r=>p.x+w/2+4>r.left&&p.x-w/2-4<r.right&&p.y>r.top&&p.y-h<r.bottom);
        item.el.hidden=!p.visible||crowded||width<530&&item.el.classList.contains('water-label');
        item.el.style.left=p.x+'px';item.el.style.top=p.y+'px';
      });
    }
    function resize() {
      const rect=host.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);
      renderer.setSize(width,height,false);updateCamera();dirty=true;
    }
    const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);
    const intersectionObserver=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;dirty=true;},{threshold:0});intersectionObserver.observe(host);
    const raycaster=new T.Raycaster(),pointer=new T.Vector2(),groundPlane=new T.Plane(new T.Vector3(0,1,0),0),groundPoint=new T.Vector3();
    const pointers=new Map();let press=null,lastPinch=0;
    function eventPointer(event) {const r=canvas.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);}
    canvas.addEventListener('pointerdown',event=>{
      if(event.button!==0&&event.pointerType==='mouse')return;
      canvas.focus({preventScroll:true});pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});canvas.setPointerCapture(event.pointerId);
      if(pointers.size===1)press={x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,moved:false};
      if(pointers.size===2){const pair=[...pointers.values()];lastPinch=Math.hypot(pair[0].x-pair[1].x,pair[0].y-pair[1].y);if(press)press.moved=true;}
      canvas.style.cursor=placing?'crosshair':'grabbing';
    });
    canvas.addEventListener('pointermove',event=>{
      if(!pointers.has(event.pointerId)||!press)return;
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(pointers.size===2) {
        const pair=[...pointers.values()],distance=Math.hypot(pair[0].x-pair[1].x,pair[0].y-pair[1].y);
        if(lastPinch>0)goal.zoom=Math.min(2.35,Math.max(.65,goal.zoom*distance/lastPinch));lastPinch=distance;
      } else if(!placing) {
        const dx=event.clientX-press.lastX,dy=event.clientY-press.lastY;
        if(Math.hypot(event.clientX-press.x,event.clientY-press.y)>5)press.moved=true;
        if(press.moved) {goal.theta-=dx*.005;goal.elevation=Math.min(1.55,Math.max(.38,goal.elevation+dy*.004));currentView='perspective';if(onViewChange)onViewChange('perspective');}
      } else if(Math.hypot(event.clientX-press.x,event.clientY-press.y)>5)press.moved=true;
      press.lastX=event.clientX;press.lastY=event.clientY;dirty=true;
    });
    function pointerEnd(event) {
      const wasClick=press&&!press.moved&&pointers.size===1;
      pointers.delete(event.pointerId);
      if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
      if(wasClick) {
        eventPointer(event);
        if(placing) {if(raycaster.ray.intersectPlane(groundPlane,groundPoint)&&onPlace)onPlace({x:groundPoint.x,z:groundPoint.z});}
        else {const hits=raycaster.intersectObjects(pickable,false);if(hits.length&&onSelect)onSelect(hits[0].object.userData.person);}
      }
      if(!pointers.size){press=null;canvas.style.cursor=placing?'crosshair':'grab';}
    }
    canvas.addEventListener('pointerup',pointerEnd);
    canvas.addEventListener('pointercancel',event=>{pointers.delete(event.pointerId);press=null;canvas.style.cursor=placing?'crosshair':'grab';});
    canvas.addEventListener('wheel',event=>{event.preventDefault();goal.zoom=Math.min(2.35,Math.max(.65,goal.zoom*Math.exp(-event.deltaY*.001)));dirty=true;},{passive:false});
    canvas.addEventListener('keydown',event=>{
      if(event.key==='ArrowLeft')goal.theta-=.12;else if(event.key==='ArrowRight')goal.theta+=.12;
      else if(event.key==='ArrowUp')goal.elevation=Math.min(1.55,goal.elevation+.1);else if(event.key==='ArrowDown')goal.elevation=Math.max(.38,goal.elevation-.1);
      else if(event.key==='+'||event.key==='=')goal.zoom=Math.min(2.35,goal.zoom*1.1);else if(event.key==='-')goal.zoom=Math.max(.65,goal.zoom/1.1);
      else if(event.key==='Home')goal={...defaultOrbit};else return;if(event.key.startsWith('Arrow')||event.key==='Home'){currentView='perspective';if(onViewChange)onViewChange('perspective');}event.preventDefault();dirty=true;
    });
    canvas.style.cursor='grab';
    let raf;
    function frame(time) {
      if(destroyed)return;raf=requestAnimationFrame(frame);
      if(!visible||document.hidden)return;
      let moving=false;
      for(const key of ['theta','elevation','zoom']) {
        const delta=goal[key]-orbit[key];if(Math.abs(delta)>.0001){orbit[key]+=delta*(reducedMotion?1:.14);moving=true;}
      }
      if(moving){updateCamera();dirty=true;}
      for(const item of agents.values()) {
        // Consume actual travel once per rendered frame. A second update with the
        // same coordinates must not erase movement, and waiting must not walk in place.
        if(state.playing&&!reducedMotion&&item.movedSinceRender&&item.motionMode!=='waiting') {
          item.legs[0].rotation.x=Math.sin(item.gaitPhase)*.22;
          item.legs[1].rotation.x=-Math.sin(item.gaitPhase)*.22;
          item.person.position.y=Math.abs(Math.sin(item.gaitPhase))*.09;dirty=true;
        } else neutralPose(item);
        item.movedSinceRender=false;
      }
      if(state.playing&&!reducedMotion) {
        rippleRings.forEach((ring,i)=>{ring.material.opacity=.13+Math.sin(time*.0005+i)*.05;});dirty=true;
      }
      if(dirty){renderer.render(scene,camera);layoutLabels();dirty=false;}
    }
    resize();raf=requestAnimationFrame(frame);
    return {
      update,
      setView(view) {currentView=view;if(onViewChange)onViewChange(view);goal=view==='plan'?{theta:0,elevation:Math.PI/2-.001,zoom:1}:{...defaultOrbit};dirty=true;},
      setPlacing(value) {placing=Boolean(value);canvas.style.cursor=placing?'crosshair':'grab';host.classList.toggle('placing',placing);labels.style.pointerEvents='none';for(const item of agents.values())item.label.style.pointerEvents=placing?'none':'auto';},
      resetView() {currentView='perspective';if(onViewChange)onViewChange('perspective');goal={...defaultOrbit};dirty=true;},
      dispose() {
        destroyed=true;cancelAnimationFrame(raf);resizeObserver.disconnect();intersectionObserver.disconnect();
        const geometries=new Set(),mats=new Set();scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)(Array.isArray(object.material)?object.material:[object.material]).forEach(m=>mats.add(m));});
        geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());renderer.dispose();canvas.remove();labels.remove();
      },
    };
  };
})();
