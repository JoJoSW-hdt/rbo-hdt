import Phaser from "phaser";
import "./style.css";

const RO = "https://assets.latam-tools.com.br/image";
const playerSprite = (action: number) => `${RO}?job=0&action=${action}&frame=0&headdir=straight`;
const poringSprite = (action: number) => `${RO}?job=1002&action=0&frame=0`;

class Game extends Phaser.Scene {
  player!: Phaser.Physics.Arcade.Sprite;
  enemy!: Phaser.Physics.Arcade.Sprite;
  heroArt!: Phaser.GameObjects.DOMElement;
  enemyArt!: Phaser.GameObjects.DOMElement;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  hud!: Phaser.GameObjects.Text;
  enemyBar!: Phaser.GameObjects.Graphics;
  playerBar!: Phaser.GameObjects.Graphics;
  touchDirection = 0;
  hp = 100;
  enemyHp = 100;
  attackLocked = false;
  dodging = false;
  invulnerable = false;
  ended = false;
  facing = 1;
  heroMode = "";
  enemyMode = "";
  activeTouchId: number | null = null;
  pressedKeys = new Set<string>();
  onKeyDown = (event: KeyboardEvent) => { this.pressedKeys.add(event.key.toLowerCase()); };
  onKeyUp = (event: KeyboardEvent) => { this.pressedKeys.delete(event.key.toLowerCase()); };

  constructor() { super("game"); }

  create() {
    const w = this.scale.width, h = this.scale.height;
    const floorY = h - 8;

    // Textura mínima usada apenas pelos corpos físicos invisíveis.
    // Phaser não possui uma textura "__DEFAULT" garantida.
    const physicsTexture = this.make.graphics({ x: 0, y: 0 });
    physicsTexture.fillStyle(0xffffff, 1);
    physicsTexture.fillRect(0, 0, 2, 2);
    physicsTexture.generateTexture("rbo-physics-body", 2, 2);
    physicsTexture.destroy();

    this.add.rectangle(w / 2, h / 2, w, h, 0x17243b);
    this.add.rectangle(w / 2, h - 65, w, 130, 0x34445a);
    for (let i = 0; i < 16; i++) this.add.rectangle(i * 110, h - 130, 2, 130, 0x52647a);
    const floor = this.add.rectangle(w / 2, floorY, w, 16, 0x34445a);
    this.physics.add.existing(floor, true);

    this.player = this.physics.add.sprite(110, h - 105, "rbo-physics-body")
      .setCollideWorldBounds(true).setVisible(false);
    this.enemy = this.physics.add.sprite(Math.max(w - 100, 230), h - 105, "rbo-physics-body")
      .setCollideWorldBounds(true).setImmovable(true).setVisible(false);
    // Corpos invisíveis cuidam da física; as imagens animadas vêm dos sprites originais de RO.
    this.player.setSize(34, 48).setOffset(4, 10);
    this.enemy.setSize(40, 46).setOffset(4, 8);
    this.player.setGravityY(1000).setMaxVelocity(300, 700);
    this.enemy.setGravityY(1000).setMaxVelocity(100, 700);
    this.physics.add.collider(this.player, floor);
    this.physics.add.collider(this.enemy, floor);
    this.physics.add.collider(this.player, this.enemy);

    this.heroArt = this.add.dom(110, h - 105).createFromHTML(
      `<img src="${playerSprite(6)}" style="width:160px;height:160px;object-fit:contain;image-rendering:pixelated;pointer-events:none;" />`
    ).setSize(160, 160).setOrigin(0.5, 0.77).setDepth(8);
    this.heroArt.node.style.pointerEvents = "none";
    if (this.heroArt.node.parentElement) this.heroArt.node.parentElement.style.pointerEvents = "none";
    this.enemyArt = this.add.dom(Math.max(w - 100, 230), h - 105).createFromHTML(
      `<img src="${poringSprite(6)}" style="width:128px;height:128px;object-fit:contain;image-rendering:pixelated;pointer-events:none;" />`
    ).setSize(128, 128).setOrigin(0.5, 0.77).setDepth(8);
    this.enemyArt.node.style.pointerEvents = "none";
    if (this.enemyArt.node.parentElement) this.enemyArt.node.parentElement.style.pointerEvents = "none";

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("A,D,W,J,K,L,E,SPACE,R") as Record<string, Phaser.Input.Keyboard.Key>;
    // Captura direta do teclado: o preview embutido pode não focar o canvas.
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", () => this.pressedKeys.clear());
    this.game.canvas.setAttribute("tabindex", "0");

    this.hud = this.add.text(14, 12, "", {
      fontFamily: "Arial", fontSize: "14px", color: "#ffffff",
      backgroundColor: "#101a2c", padding: { x: 8, y: 6 }
    }).setScrollFactor(0).setDepth(20);
    this.playerBar = this.add.graphics().setScrollFactor(0).setDepth(20);
    this.enemyBar = this.add.graphics().setScrollFactor(0).setDepth(20);
    this.refreshHud();

    this.add.text(14, h - 18,
      "A/D mover • W/ESPAÇO pular • J/K atacar • L esquivar • E habilidade",
      { fontSize: "10px", color: "#d8e5ff" }
    ).setOrigin(0, 1).setScrollFactor(0).setDepth(20);
    this.addTouchControls(w, h);
    this.input.addPointer(2);
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.activeTouchId = p.id;
      this.handleTouch(p.x, p.y, w, h);
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (p.id !== this.activeTouchId || !p.isDown) return;
      this.handleTouch(p.x, p.y, w, h);
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (p.id !== this.activeTouchId) return;
      this.activeTouchId = null;
      this.touchDirection = 0;
    });
    this.time.delayedCall(900, () => this.enemyThink());
  }

  imageOf(art: Phaser.GameObjects.DOMElement): HTMLImageElement | null {
    return art.node.querySelector("img");
  }

  setHeroMode(mode: "idle" | "walk" | "attack") {
    if (this.heroMode === mode) return;
    this.heroMode = mode;
    const action = mode === "walk" ? 14 : mode === "attack" ? 46 : 6;
    const img = this.imageOf(this.heroArt);
    if (img) img.src = playerSprite(action);
  }

  setEnemyMode(mode: "idle" | "walk" | "attack") {
    if (this.enemyMode === mode) return;
    this.enemyMode = mode;
    const action = 0;
    const img = this.imageOf(this.enemyArt);
    if (img) img.src = poringSprite(action);
  }

  flashArt(art: Phaser.GameObjects.DOMElement) {
    const img = this.imageOf(art);
    if (!img) return;
    img.style.filter = "brightness(2.2) saturate(1.4)";
    this.time.delayedCall(140, () => { img.style.filter = ""; });
  }

  addTouchControls(w: number, h: number) {
    const y = h - 78;
    const button = (x: number, label: string) => {
      this.add.circle(x, y, 21, 0x54749b, 0.92)
        .setStrokeStyle(2, 0xd9e8ff).setScrollFactor(0).setDepth(30);
      this.add.text(x, y, label, { fontSize: "18px", color: "#ffffff" })
        .setOrigin(0.5).setScrollFactor(0).setDepth(31);
    };
    button(29, "◀"); button(78, "▶");
    button(w - 218, "▲"); button(w - 170, "↗");
    button(w - 122, "A"); button(w - 74, "F"); button(w - 26, "E");
  }

  handleTouch(x: number, y: number, w: number, h: number) {
    if (y < h - 130) return;
    if (x < 54) { this.touchDirection = -1; return; }
    if (x < 112) { this.touchDirection = 1; return; }
    this.touchDirection = 0;
    if (x > w - 150 && x <= w - 98) this.hit(16, 112);
    else if (x > w - 98 && x <= w - 50) this.hit(27, 126);
    else if (x > w - 50) this.special();
    else if (x > w - 245 && x <= w - 194) this.jump();
    else if (x > w - 194 && x <= w - 146) this.dodge();
  }

  jump() {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body.blocked.down && !this.ended) this.player.setVelocityY(-470);
  }

  dodge() {
    if (this.dodging || this.ended) return;
    this.dodging = true;
    this.invulnerable = true;
    this.player.setVelocityX(this.facing * 390);
    this.heroArt.setAlpha(0.45);
    this.time.delayedCall(260, () => {
      this.dodging = false;
      this.player.setVelocityX(0);
      this.heroArt.setAlpha(1);
    });
    this.time.delayedCall(520, () => { this.invulnerable = false; });
  }

  hit(damage: number, range: number) {
    if (this.attackLocked || this.ended || this.enemyHp <= 0) return;
    this.attackLocked = true;
    this.setHeroMode("attack");
    const distance = Math.abs(this.player.x - this.enemy.x);
    const inFront = (this.enemy.x - this.player.x) * this.facing > -18;
    if (distance < range && inFront) {
      this.enemyHp = Math.max(0, this.enemyHp - damage);
      this.flashArt(this.enemyArt);
      this.enemy.setVelocityX(this.facing * 100);
      
      this.refreshHud();
      if (this.enemyHp === 0) this.finish(true);
    }
    this.time.delayedCall(420, () => {
      this.attackLocked = false;
      if (!this.ended) this.setHeroMode("idle");
    });
  }

  special() {
    if (!this.skillReady || this.ended || this.enemyHp <= 0) return;
    this.skillReady = false;
    this.flashArt(this.heroArt);
    
    if (Math.abs(this.player.x - this.enemy.x) < 190) {
      this.enemyHp = Math.max(0, this.enemyHp - 38);
      this.flashArt(this.enemyArt);
      
      this.refreshHud();
      if (this.enemyHp === 0) this.finish(true);
    }
    this.time.delayedCall(5000, () => { this.skillReady = true; this.refreshHud(); });
    this.refreshHud();
  }

  skillReady = true;

  enemyThink() {
    if (this.ended || this.enemyHp <= 0) return;
    const distance = Math.abs(this.player.x - this.enemy.x);
    if (distance > 62) {
      this.enemy.setVelocityX(this.player.x < this.enemy.x ? -62 : 62);
      this.setEnemyMode("walk");
      this.time.delayedCall(180, () => this.enemyThink());
      return;
    }
    this.enemy.setVelocityX(0);
    this.setEnemyMode("attack");
    this.time.delayedCall(520, () => {
      this.setEnemyMode("idle");
      if (!this.ended && Math.abs(this.player.x - this.enemy.x) < 82 && !this.invulnerable) {
        this.hp = Math.max(0, this.hp - 12);
        this.flashArt(this.heroArt);
        
        this.refreshHud();
        if (this.hp === 0) this.finish(false);
      }
      this.time.delayedCall(760, () => this.enemyThink());
    });
  }

  refreshHud() {
    this.hud.setText(
      `RBO 2.0  |  APRENDIZ   HP ${this.hp}/100   |   PORING ${this.enemyHp}/100   |   ESPECIAL ${this.skillReady ? "PRONTO" : "RECARGA"}`
    );
    const width = Math.min(190, this.scale.width * 0.42);
    this.playerBar.clear();
    this.playerBar.fillStyle(0x26394f).fillRoundedRect(14, 44, width, 8, 4);
    this.playerBar.fillStyle(0x52d68a).fillRoundedRect(14, 44, width * this.hp / 100, 8, 4);
    this.enemyBar.clear();
    this.enemyBar.fillStyle(0x26394f).fillRoundedRect(this.scale.width - width - 14, 44, width, 8, 4);
    this.enemyBar.fillStyle(0xe56a58).fillRoundedRect(this.scale.width - width - 14, 44, width * this.enemyHp / 100, 8, 4);
  }

  finish(won: boolean) {
    if (this.ended) return;
    this.ended = true;
    this.physics.pause();
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, 250, 100, 0x101a2c, 0.92)
      .setStrokeStyle(2, won ? 0xffd66b : 0xe56a58).setDepth(50);
    this.add.text(this.scale.width / 2, this.scale.height / 2 - 10,
      won ? "PORING DERROTADO!" : "VOCÊ FOI DERROTADO",
      { fontSize: "20px", color: won ? "#ffe28a" : "#ff9a91", align: "center" }
    ).setOrigin(0.5).setDepth(51);
    this.add.text(this.scale.width / 2, this.scale.height / 2 + 22,
      "Toque ou pressione R para jogar novamente",
      { fontSize: "11px", color: "#ffffff" }
    ).setOrigin(0.5).setDepth(51).setInteractive().on("pointerdown", () => this.scene.restart());
  }

  update() {
    this.heroArt.setPosition(this.player.x, this.player.y);
    this.enemyArt.setPosition(this.enemy.x, this.enemy.y);
    if (this.pressedKeys.has("r") || Phaser.Input.Keyboard.JustDown(this.keys.R)) {
      this.scene.restart();
      return;
    }
    if (this.ended || this.dodging) return;
    const left = this.pressedKeys.has("arrowleft") || this.pressedKeys.has("a") || this.cursors.left.isDown || this.keys.A.isDown || this.touchDirection === -1;
    const right = this.pressedKeys.has("arrowright") || this.pressedKeys.has("d") || this.cursors.right.isDown || this.keys.D.isDown || this.touchDirection === 1;
    if (left) {
      this.player.setVelocityX(-220);
      this.facing = -1;
      const img = this.imageOf(this.heroArt);
      if (img) img.style.transform = "scaleX(-1)";
      if (!this.attackLocked) this.setHeroMode("walk");
    } else if (right) {
      this.player.setVelocityX(220);
      this.facing = 1;
      const img = this.imageOf(this.heroArt);
      if (img) img.style.transform = "scaleX(1)";
      if (!this.attackLocked) this.setHeroMode("walk");
    } else {
      this.player.setVelocityX(0);
      if (!this.attackLocked) this.setHeroMode("idle");
    }
    if (this.pressedKeys.has("arrowup") || this.pressedKeys.has("w") || this.pressedKeys.has(" ") || Phaser.Input.Keyboard.JustDown(this.cursors.up!) ||
        Phaser.Input.Keyboard.JustDown(this.keys.W) ||
        Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) this.jump();
    if (this.pressedKeys.has("j") || Phaser.Input.Keyboard.JustDown(this.keys.J)) this.hit(16, 112);
    if (this.pressedKeys.has("k") || Phaser.Input.Keyboard.JustDown(this.keys.K)) this.hit(27, 126);
    if (this.pressedKeys.has("l") || Phaser.Input.Keyboard.JustDown(this.keys.L)) this.dodge();
    if (this.pressedKeys.has("e") || Phaser.Input.Keyboard.JustDown(this.keys.E)) this.special();
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  backgroundColor: "#17243b",
  dom: { createContainer: true },
  scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
  physics: { default: "arcade", arcade: { debug: false } },
  scene: [Game]
});
