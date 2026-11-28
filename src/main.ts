import "./style.css";

const root = document.querySelector<HTMLDivElement>("#app")!;
root.innerHTML = `
  <div id="game-shell">
    <canvas id="game" aria-label="RBO 2.0"></canvas>
    <div id="help">A / D ou ← / → mover · W / Espaço pular · J atacar · R reiniciar</div>
  </div>`;

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const ctx = canvas.getContext("2d")!;
const keys = new Set<string>();
let width = 960, height = 540, last = 0, elapsed = 0;
const world = { width: 1800, floor: 430, camera: 0 };
const hero = { x: 150, y: 0, vx: 0, vy: 0, hp: 100, facing: 1, grounded: true, attack: 0, attackCooldown: 0, hitFlash: 0 };
const poring = { x: 620, y: 0, vx: 0, hp: 100, facing: -1, hitFlash: 0, attackCooldown: 0, bob: 0 };
let ended = false;
let won = false;
let message = "";

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(320, rect.width);
  height = Math.max(240, rect.height);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  world.floor = height - 90;
  if (hero.y === 0) hero.y = world.floor - 58;
  if (poring.y === 0) poring.y = world.floor - 34;
}
window.addEventListener("resize", resize);
resize();

window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (["arrowleft","arrowright","arrowup"," "].includes(key)) e.preventDefault();
  keys.add(key);
  if (key === "j" && !ended && hero.attackCooldown <= 0) {
    hero.attack = 0.22;
    hero.attackCooldown = 0.38;
    const dx = poring.x - hero.x;
    if (Math.abs(dx) < 105 && Math.sign(dx || 1) === hero.facing) {
      poring.hp = Math.max(0, poring.hp - 25);
      poring.vx = hero.facing * 260;
      poring.hitFlash = 0.16;
      if (poring.hp <= 0) { ended = true; won = true; message = "PORING DERROTADO!"; }
    }
  }
  if (key === "r" && ended) reset();
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => keys.clear());

function reset() {
  hero.x = 150; hero.y = world.floor - 58; hero.vx = 0; hero.vy = 0; hero.hp = 100; hero.attack = 0; hero.attackCooldown = 0;
  poring.x = 620; poring.y = world.floor - 34; poring.vx = 0; poring.hp = 100; poring.attackCooldown = 0;
  ended = false; won = false; message = "";
}

function rect(x:number,y:number,w:number,h:number,color:string) { ctx.fillStyle=color; ctx.fillRect(Math.round(x),Math.round(y),w,h); }

function drawApprentice(x:number,y:number, moving:boolean) {
  const step = moving ? Math.sin(elapsed * 13) * 5 : 0;
  const attack = hero.attack > 0;
  ctx.save(); ctx.translate(Math.round(x),Math.round(y)); ctx.scale(hero.facing,1);
  // sombra
  ctx.fillStyle="rgba(0,0,0,.28)"; ctx.beginPath(); ctx.ellipse(0,2,23,6,0,0,Math.PI*2); ctx.fill();
  // pernas animadas
  rect(-12, -25 + step, 10, 24, "#473b45"); rect(3, -25 - step, 10, 24, "#473b45");
  rect(-14, -5 + step, 14, 6, "#b18b58"); rect(1, -5 - step, 15, 6, "#b18b58");
  // túnica de Aprendiz
  rect(-18,-54,36,31,"#8c4938"); rect(-15,-52,30,26,"#bd7950");
  rect(-18,-29,36,5,"#e1c18a"); rect(-4,-52,8,25,"#e8d39c");
  // braços
  rect(-25,-49,9,22,"#d6a276"); rect(16,-49,9,22,"#d6a276");
  rect(-26,-29,11,7,"#8c4938"); rect(16,-29,11,7,"#8c4938");
  if (attack) { rect(18,-49,28,9,"#d6a276"); rect(39,-51,12,13,"#f0c28c"); }
  // cabeça, cabelo e bandana
  rect(-16,-82,32,29,"#e9b987"); rect(-19,-83,38,12,"#583d32");
  rect(-17,-91,34,9,"#765044"); rect(-13,-78,7,5,"#302a2a"); rect(7,-78,7,5,"#302a2a");
  rect(-9,-66,18,3,"#a96858");
  ctx.restore();
}

function drawPoring(x:number,y:number) {
  ctx.save(); ctx.translate(Math.round(x),Math.round(y));
  const squash = Math.sin(elapsed*5 + poring.bob) * 2;
  ctx.fillStyle="rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(0,1,29,7,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=poring.hitFlash>0?"#fff2f2":"#f36b9b";
  ctx.beginPath(); ctx.ellipse(0,-17,29,18+squash,0,Math.PI,Math.PI*2); ctx.lineTo(29,-13); ctx.quadraticCurveTo(27,2,0,1); ctx.quadraticCurveTo(-27,2,-29,-13); ctx.fill();
  ctx.fillStyle="#ffffff"; ctx.fillRect(-13,-23,8,9); ctx.fillRect(6,-23,8,9);
  ctx.fillStyle="#523044"; ctx.fillRect(-10,-20,4,6); ctx.fillRect(9,-20,4,6);
  ctx.fillStyle="#a83d68"; ctx.fillRect(-4,-10,8,3);
  ctx.restore();
}

function drawMap() {
  const sky=ctx.createLinearGradient(0,0,0,height); sky.addColorStop(0,"#253c59"); sky.addColorStop(1,"#7893a2"); ctx.fillStyle=sky; ctx.fillRect(0,0,width,height);
  // montanhas distantes
  ctx.fillStyle="#344d5b"; ctx.beginPath(); ctx.moveTo(0,world.floor-100); ctx.lineTo(180,world.floor-245); ctx.lineTo(360,world.floor-100); ctx.lineTo(550,world.floor-220); ctx.lineTo(790,world.floor-100); ctx.lineTo(980,world.floor-190); ctx.lineTo(1200,world.floor-100); ctx.lineTo(1450,world.floor-230); ctx.lineTo(1800,world.floor-100); ctx.lineTo(1800,world.floor); ctx.lineTo(0,world.floor); ctx.fill();
  // muralha / cenário de campo
  for(let i=0;i<8;i++){const bx=i*260-world.camera*.35; rect(bx,world.floor-90,190,90,"#536d64"); rect(bx+12,world.floor-112,166,22,"#71856d");}
  rect(0,world.floor,world.width,height-world.floor,"#685b49");
  rect(0,world.floor+8,world.width,5,"#b6a077");
  for(let i=0;i<70;i++){const x=(i*83-world.camera*.8)%world.width; rect(x,world.floor+30+(i%4)*13,3,2,"#a58b60");}
  // placa de mapa
  ctx.fillStyle="rgba(12,23,37,.72)"; ctx.fillRect(16,76,160,30);
  ctx.fillStyle="#f2dfb2"; ctx.font="bold 14px Arial"; ctx.fillText("CAMPO DE PRONTERA",27,96);
}

function drawBar(x:number,y:number,w:number,value:number,color:string,label:string) {
  ctx.fillStyle="#152337";ctx.fillRect(x,y,w,20);ctx.fillStyle=color;ctx.fillRect(x+2,y+2,(w-4)*value/100,16);
  ctx.fillStyle="#fff";ctx.font="bold 11px Arial";ctx.fillText(label,x+7,y+14);
}

function frame(dt:number) {
  elapsed += dt;
  const left=keys.has("a")||keys.has("arrowleft"), right=keys.has("d")||keys.has("arrowright");
  if(!ended){
    hero.attackCooldown=Math.max(0,hero.attackCooldown-dt); hero.attack=Math.max(0,hero.attack-dt); hero.hitFlash=Math.max(0,hero.hitFlash-dt);
    if(left){hero.vx=-230;hero.facing=-1;} else if(right){hero.vx=230;hero.facing=1;} else hero.vx*=Math.pow(.001,dt);
    if((keys.has("w")||keys.has("arrowup")||keys.has(" "))&&hero.y>=world.floor-58) hero.vy=-520;
    hero.vy+=1350*dt; hero.x+=hero.vx*dt; hero.y+=hero.vy*dt;
    if(hero.y>world.floor-58){hero.y=world.floor-58;hero.vy=0;}
    hero.x=Math.max(30,Math.min(world.width-30,hero.x));
    const dx=hero.x-poring.x;
    if(Math.abs(dx)>48){poring.vx=Math.sign(dx)*Math.min(90,Math.abs(dx)*1.1);poring.facing=Math.sign(dx);}
    else {poring.vx=0;poring.attackCooldown-=dt;if(poring.attackCooldown<=0){hero.hp=Math.max(0,hero.hp-8);poring.attackCooldown=1.2;hero.hitFlash=.15;if(hero.hp===0){ended=true;won=false;message="APRENDIZ DERROTADO!";}}}
    poring.x+=poring.vx*dt;poring.x=Math.max(45,Math.min(world.width-45,poring.x));
    poring.hitFlash=Math.max(0,poring.hitFlash-dt);poring.bob+=dt;
    world.camera=Math.max(0,Math.min(world.width-width,hero.x-width*.42));
  }
  ctx.clearRect(0,0,width,height);
  drawMap();
  ctx.save();ctx.translate(-world.camera,0);
  drawApprentice(hero.x,hero.y,Math.abs(hero.vx)>20);
  drawPoring(poring.x,poring.y);
  ctx.restore();
  drawBar(16,16,210,hero.hp,"#54d68b","APRENDIZ  HP "+hero.hp);
  drawBar(width-226,16,210,poring.hp,"#e96b99","PORING  HP "+poring.hp);
  if(hero.hitFlash>0){ctx.fillStyle="rgba(255,90,90,.12)";ctx.fillRect(0,0,width,height);}
  if(ended){ctx.fillStyle="rgba(8,14,24,.76)";ctx.fillRect(width/2-180,height/2-55,360,110);ctx.fillStyle=won?"#ffe29a":"#ff9b9b";ctx.textAlign="center";ctx.font="bold 25px Arial";ctx.fillText(message,width/2,height/2-5);ctx.fillStyle="#fff";ctx.font="14px Arial";ctx.fillText("Pressione R para tentar novamente",width/2,height/2+27);ctx.textAlign="left";}
  if(!ended && hero.attack>0){ctx.fillStyle="#fff2b0";ctx.font="bold 15px Arial";ctx.fillText("GOLPE!",width/2-25,height-35);}
  requestAnimationFrame((t)=>{const delta=Math.min((t-last)/1000,.04);last=t;frame(delta);});
}
requestAnimationFrame((t)=>{last=t;frame(0);});
