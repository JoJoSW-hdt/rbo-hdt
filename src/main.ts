import Phaser from "phaser";
import "./style.css";

class Game extends Phaser.Scene {
  player!: Phaser.Physics.Arcade.Sprite;
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  enemy!: Phaser.Physics.Arcade.Sprite;
  hp = 100;
  enemyHp = 100;
  hud!: Phaser.GameObjects.Text;
  attacking = false;
  facing = 1;

  constructor() { super("game"); }

  create() {
    const w = this.scale.width, h = this.scale.height;
    this.add.rectangle(w/2, h/2, w, h, 0x17243b);
    this.add.rectangle(w/2, h-65, w, 130, 0x34445a);
    for (let i=0;i<12;i++) this.add.rectangle(i*110, h-130, 2, 130, 0x52647a);
    this.player = this.physics.add.sprite(170,h-105,"hero").setCollideWorldBounds(true);
    this.enemy = this.physics.add.sprite(w-180,h-105,"enemy").setImmovable(true);
    this.player.setGravityY(900); this.enemy.setGravityY(900);
    this.physics.add.collider(this.player,this.enemy);
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("A,D,W,J,K,SPACE") as Record<string,Phaser.Input.Keyboard.Key>;
    this.hud = this.add.text(18,16,"RBO 2.0  |  NOVIÇO   HP 100   •   INIMIGO 100",{fontFamily:"Arial",fontSize:"18px",color:"#ffffff"}).setScrollFactor(0);
    this.add.text(18,h-34,"TOQUE: ◀ ▶ mover   ▲ pular   ATAQUE / FORTE",{fontSize:"13px",color:"#d8e5ff"});
    this.makeTouch(w,h);
  }

  makeTouch(w:number,h:number) {
    const btn=(x:number,y:number,label:string,fn:()=>void)=>{
      const c=this.add.circle(x,y, thirty,0x54749b,0.85).setStrokeStyle(2,0xd9e8ff).setScrollFactor(0).setInteractive();
      this.add.text(x,y,label,{fontSize:"22px",color:"#fff"}).setOrigin(.5).setScrollFactor(0);
      c.on("pointerdown",fn); c.on("pointerup",()=>{ if(label==="◀"||label==="▶") this.player.setVelocityX(0); });
      return c;
    };
    const thirty=30, y=h-92;
    btn(48,y,"◀",()=>this.player.setVelocityX(-240));
    btn(120,y,"▶",()=>this.player.setVelocityX(240));
    btn(w-180,y,"▲",()=>{if(this.player.body!.blocked.down)this.player.setVelocityY(-480)});
    btn(w-105,y,"A",()=>this.hit(18));
    btn(w-48,y,"F",()=>this.hit(30));
  }

  hit(dmg:number) {
    if(this.attacking || this.enemyHp<=0) return;
    this.attacking=true;
    const close=Math.abs(this.player.x-this.enemy.x)<115;
    if(close){this.enemyHp=Math.max(0,this.enemyHp-dmg); this.enemy.setTint(0xffffff); this.time.delayedCall(100,()=>this.enemy.clearTint());}
    this.time.delayedCall(260,()=>this.attacking=false);
    this.updateHud();
  }

  updateHud() {
    this.hud.setText(`RBO 2.0  |  NOVIÇO   HP ${this.hp}   •   INIMIGO ${this.enemyHp}`);
    if(this.enemyHp===0) this.add.text(this.scale.width/2,100,"VITÓRIA!",{fontSize:"34px",color:"#ffe28a"}).setOrigin(.5);
  }

  update() {
    if(this.hp<=0 || this.enemyHp<=0) return;
    const left=this.cursors.left.isDown||this.keys.A.isDown;
    const right=this.cursors.right.isDown||this.keys.D.isDown;
    if(left){this.player.setVelocityX(-240);this.facing=-1}
    else if(right){this.player.setVelocityX(240);this.facing=1}
    else if(!this.input.activePointer.isDown) this.player.setVelocityX(0);
    if((Phaser.Input.Keyboard.JustDown(this.cursors.up!)||Phaser.Input.Keyboard.JustDown(this.keys.W)||Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) && this.player.body!.blocked.down) this.player.setVelocityY(-480);
    if(Phaser.Input.Keyboard.JustDown(this.keys.J)) this.hit(18);
    if(Phaser.Input.Keyboard.JustDown(this.keys.K)) this.hit(30);
    if(this.enemyHp>0 && Math.abs(this.player.x-this.enemy.x)<260){
      this.enemy.setVelocityX(this.player.x<this.enemy.x?-65:65);
      if(Math.abs(this.player.x-this.enemy.x)<48 && this.time.now%900<18){this.hp=Math.max(0,this.hp-8);this.updateHud();}
    } else this.enemy.setVelocityX(0);
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, parent:"app", backgroundColor:"#17243b",
  scale:{mode:Phaser.Scale.RESIZE,width:"100%",height:"100%"},
  physics:{default:"arcade",arcade:{debug:false}},
  scene:[Game]
};
const game=new Phaser.Game(config);
game.events.once("ready",()=>{});
