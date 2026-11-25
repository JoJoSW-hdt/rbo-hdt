import Phaser from "phaser";
import "./style.css";

class Game extends Phaser.Scene {
  player!: Phaser.Physics.Arcade.Sprite;
  enemy!: Phaser.Physics.Arcade.Sprite;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  hud!: Phaser.GameObjects.Text;
  hp = 100;
  enemyHp = 100;
  busy = false;
  touchDirection = 0;

  constructor() { super("game"); }

  create() {
    const w = this.scale.width, h = this.scale.height;

    // Texturas provisórias desenhadas pelo próprio jogo.
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x5cc7ff); g.fillRoundedRect(0, 0, 42, 62, 8);
    g.fillStyle(0xffffff); g.fillRect(25, 12, 7, 7);
    g.generateTexture("hero", 42, 62);
    g.clear();
    g.fillStyle(0xe56a58); g.fillRoundedRect(0, 0, 48, 58, 8);
    g.fillStyle(0xffffff); g.fillRect(8, 12, 7, 7);
    g.generateTexture("enemy", 48, 58);
    g.destroy();

    this.add.rectangle(w/2, h/2, w, h, 0x17243b);
    this.add.rectangle(w/2, h-65, w, 130, 0x34445a);
    for (let i=0; i<12; i++) this.add.rectangle(i*110, h-130, 2, 130, 0x52647a);

    const floor = this.add.rectangle(w/2, h-8, w, 16, 0x34445a);
    this.physics.add.existing(floor, true);

    this.player = this.physics.add.sprite(170, h-105, "hero").setCollideWorldBounds(true);
    this.enemy = this.physics.add.sprite(w-180, h-105, "enemy").setImmovable(true);
    this.player.setGravityY(900);
    this.enemy.setGravityY(900);
    this.physics.add.collider(this.player, floor);
    this.physics.add.collider(this.enemy, floor);
    this.physics.add.collider(this.player, this.enemy);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("A,D,W,J,K,SPACE") as Record<string, Phaser.Input.Keyboard.Key>;

    this.hud = this.add.text(16, 14, "", {
      fontFamily: "Arial", fontSize: "17px", color: "#ffffff"
    }).setScrollFactor(0);
    this.refreshHud();
    this.add.text(16, h-28, "TECLADO: A/D ou ←/→  •  PULAR: W/ESPAÇO  •  ATAQUES: J/K", {
      fontSize: "12px", color: "#d8e5ff"
    }).setScrollFactor(0);

    this.addTouchControls(w, h);
  }

  addTouchControls(w: number, h: number) {
    const y = h-88;
    const button = (x: number, label: string, action: () => void, release?: () => void) => {
      const circle = this.add.circle(x, y, 29, 0x54749b, 0.9)
        .setStrokeStyle(2, 0xd9e8ff).setScrollFactor(0).setInteractive();
      this.add.text(x, y, label, { fontSize: "21px", color: "#ffffff" })
        .setOrigin(0.5).setScrollFactor(0);
      circle.on("pointerdown", action);
      circle.on("pointerup", () => release?.());
      circle.on("pointerout", () => release?.());
    };
    button(42, "◀", () => { this.touchDirection = -1; }, () => { this.touchDirection = 0; });
    button(110, "▶", () => { this.touchDirection = 1; }, () => { this.touchDirection = 0; });
    button(w-174, "▲", () => { if (this.player.body!.blocked.down) this.player.setVelocityY(-480); });
    button(w-103, "A", () => this.hit(18));
    button(w-40, "F", () => this.hit(30));
  }

  hit(damage: number) {
    if (this.busy || this.enemyHp <= 0) return;
    this.busy = true;
    if (Math.abs(this.player.x-this.enemy.x) < 112) {
      this.enemyHp = Math.max(0, this.enemyHp-damage);
      this.enemy.setTint(0xffffff);
      this.time.delayedCall(100, () => this.enemy.clearTint());
    }
    this.refreshHud();
    this.time.delayedCall(260, () => { this.busy = false; });
  }

  refreshHud() {
    this.hud.setText(`RBO 2.0  |  NOVIÇO   HP ${this.hp}   •   INIMIGO ${this.enemyHp}`);
    if (this.enemyHp === 0 && !this.children.getByName("victory")) {
      this.add.text(this.scale.width/2, 100, "VITÓRIA!", {
        fontSize: "34px", color: "#ffe28a"
      }).setOrigin(0.5).setName("victory");
    }
  }

  update() {
    if (this.hp <= 0 || this.enemyHp <= 0) return;
    const left = this.cursors.left.isDown || this.keys.A.isDown || this.touchDirection === -1;
    const right = this.cursors.right.isDown || this.keys.D.isDown || this.touchDirection === 1;
    if (left) this.player.setVelocityX(-240);
    else if (right) this.player.setVelocityX(240);
    else this.player.setVelocityX(0);

    const jump = Phaser.Input.Keyboard.JustDown(this.cursors.up!) ||
      Phaser.Input.Keyboard.JustDown(this.keys.W) ||
      Phaser.Input.Keyboard.JustDown(this.keys.SPACE);
    if (jump && this.player.body!.blocked.down) this.player.setVelocityY(-480);

    if (Phaser.Input.Keyboard.JustDown(this.keys.J)) this.hit(18);
    if (Phaser.Input.Keyboard.JustDown(this.keys.K)) this.hit(30);

    if (this.enemyHp > 0) {
      if (Math.abs(this.player.x-this.enemy.x) < 260) {
        this.enemy.setVelocityX(this.player.x < this.enemy.x ? -65 : 65);
        if (Math.abs(this.player.x-this.enemy.x) < 48 && this.time.now % 900 < 18) {
          this.hp = Math.max(0, this.hp-8);
          this.refreshHud();
        }
      } else this.enemy.setVelocityX(0);
    }
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
