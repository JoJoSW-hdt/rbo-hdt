import Phaser from "phaser";
import "./style.css";

class Game extends Phaser.Scene {
  player!: Phaser.Physics.Arcade.Sprite;
  enemy!: Phaser.Physics.Arcade.Sprite;
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
  enemyPreparing = false;
  skillReady = true;
  ended = false;
  facing = 1;

  constructor() { super("game"); }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    const art = this.make.graphics({ x: 0, y: 0 });
    art.fillStyle(0x55c8ff);
    art.fillRoundedRect(0, 0, 42, 62, 8);
    art.fillStyle(0xffffff);
    art.fillCircle(30, 15, 4);
    art.fillStyle(0x17466d);
    art.fillRect(8, 43, 27, 16);
    art.generateTexture("hero", 42, 62);
    art.clear();
    art.fillStyle(0xe56a58);
    art.fillRoundedRect(0, 0, 48, 58, 8);
    art.fillStyle(0xffffff);
    art.fillCircle(12, 14, 4);
    art.fillStyle(0x713c42);
    art.fillRect(8, 41, 32, 14);
    art.generateTexture("enemy", 48, 58);
    art.destroy();

    this.add.rectangle(w / 2, h / 2, w, h, 0x17243b);
    this.add.rectangle(w / 2, h - 65, w, 130, 0x34445a);
    for (let i = 0; i < 16; i++) {
      this.add.rectangle(i * 110, h - 130, 2, 130, 0x52647a);
    }
    const floor = this.add.rectangle(w / 2, h - 8, w, 16, 0x34445a);
    this.physics.add.existing(floor, true);

    this.player = this.physics.add.sprite(110, h - 105, "hero")
      .setCollideWorldBounds(true);
    this.enemy = this.physics.add.sprite(Math.max(w - 100, 230), h - 105, "enemy")
      .setCollideWorldBounds(true);
    this.player.setGravityY(1000).setMaxVelocity(300, 700);
    this.enemy.setGravityY(1000).setMaxVelocity(100, 700).setImmovable(true);
    this.physics.add.collider(this.player, floor);
    this.physics.add.collider(this.enemy, floor);
    this.physics.add.collider(this.player, this.enemy);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("A,D,W,J,K,L,SPACE,R") as Record<string, Phaser.Input.Keyboard.Key>;

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
    this.time.delayedCall(900, () => this.enemyThink());
  }

  addTouchControls(w: number, h: number) {
    const y = h - 78;
    const button = (x: number, label: string, action: () => void, release?: () => void) => {
      const circle = this.add.circle(x, y, 25, 0x54749b, 0.92)
        .setStrokeStyle(2, 0xd9e8ff).setScrollFactor(0).setDepth(30).setInteractive();
      this.add.text(x, y, label, { fontSize: "18px", color: "#ffffff" })
        .setOrigin(0.5).setScrollFactor(0).setDepth(31);
      circle.on("pointerdown", action);
      circle.on("pointerup", () => release?.());
      circle.on("pointerout", () => release?.());
    };
    button(32, "◀", () => { this.touchDirection = -1; }, () => { this.touchDirection = 0; });
    button(91, "▶", () => { this.touchDirection = 1; }, () => { this.touchDirection = 0; });
    button(w - 202, "▲", () => this.jump());
    button(w - 145, "↗", () => this.dodge());
    button(w - 88, "A", () => this.hit(16, 112));
    button(w - 31, "F", () => this.hit(27, 126));
    // Habilidade especial acionada pelo botão E no teclado; toque longo no F não é necessário.
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
    this.player.setAlpha(0.45);
    this.time.delayedCall(260, () => {
      this.dodging = false;
      this.player.setVelocityX(0);
      this.player.setAlpha(1);
    });
    this.time.delayedCall(520, () => { this.invulnerable = false; });
  }

  hit(damage: number, range: number) {
    if (this.attackLocked || this.ended || this.enemyHp <= 0) return;
    this.attackLocked = true;
    const distance = Math.abs(this.player.x - this.enemy.x);
    const inFront = (this.enemy.x - this.player.x) * this.facing > -18;
    if (distance < range && inFront) {
      this.enemyHp = Math.max(0, this.enemyHp - damage);
      this.enemy.setTint(0xffffff);
      this.enemy.setVelocityX(this.facing * 100);
      this.time.delayedCall(110, () => this.enemy.clearTint());
      this.refreshHud();
      if (this.enemyHp === 0) this.finish(true);
    }
    this.time.delayedCall(300, () => { this.attackLocked = false; });
  }

  special() {
    if (!this.skillReady || this.ended || this.enemyHp <= 0) return;
    this.skillReady = false;
    this.player.setTint(0x9eeeff);
    this.time.delayedCall(180, () => this.player.clearTint());
    if (Math.abs(this.player.x - this.enemy.x) < 190) {
      this.enemyHp = Math.max(0, this.enemyHp - 38);
      this.enemy.setTint(0x9eeeff);
      this.time.delayedCall(180, () => this.enemy.clearTint());
      this.refreshHud();
      if (this.enemyHp === 0) this.finish(true);
    }
    this.time.delayedCall(5000, () => { this.skillReady = true; this.refreshHud(); });
    this.refreshHud();
  }

  enemyThink() {
    if (this.ended || this.enemyHp <= 0) return;
    const distance = Math.abs(this.player.x - this.enemy.x);
    if (distance > 62) {
      this.enemy.setVelocityX(this.player.x < this.enemy.x ? -62 : 62);
      this.time.delayedCall(180, () => this.enemyThink());
      return;
    }
    this.enemy.setVelocityX(0);
    this.enemyPreparing = true;
    this.enemy.setTint(0xffb36b);
    this.time.delayedCall(520, () => {
      this.enemyPreparing = false;
      this.enemy.clearTint();
      if (!this.ended && Math.abs(this.player.x - this.enemy.x) < 82 && !this.invulnerable) {
        this.hp = Math.max(0, this.hp - 12);
        this.player.setTint(0xff7777);
        this.time.delayedCall(150, () => this.player.clearTint());
        this.refreshHud();
        if (this.hp === 0) this.finish(false);
      }
      this.time.delayedCall(760, () => this.enemyThink());
    });
  }

  refreshHud() {
    this.hud.setText(
      `RBO 2.0  |  NOVIÇO   HP ${this.hp}/100   |   PORING ${this.enemyHp}/100   |   ESPECIAL ${this.skillReady ? "PRONTO" : "RECARGA"}`
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
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) {
      this.scene.restart();
      return;
    }
    if (this.ended || this.dodging) return;
    const left = this.cursors.left.isDown || this.keys.A.isDown || this.touchDirection === -1;
    const right = this.cursors.right.isDown || this.keys.D.isDown || this.touchDirection === 1;
    if (left) {
      this.player.setVelocityX(-220);
      this.facing = -1;
      this.player.setFlipX(true);
    } else if (right) {
      this.player.setVelocityX(220);
      this.facing = 1;
      this.player.setFlipX(false);
    } else {
      this.player.setVelocityX(0);
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up!) ||
        Phaser.Input.Keyboard.JustDown(this.keys.W) ||
        Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) this.jump();
    if (Phaser.Input.Keyboard.JustDown(this.keys.J)) this.hit(16, 112);
    if (Phaser.Input.Keyboard.JustDown(this.keys.K)) this.hit(27, 126);
    if (Phaser.Input.Keyboard.JustDown(this.keys.L)) this.dodge();
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.special();
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  backgroundColor: "#17243b",
  scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
  physics: { default: "arcade", arcade: { debug: false } },
  scene: [Game]
});
