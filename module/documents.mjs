// Document classes personalizzate per Daggerheart ITA
import { DH } from "./config.mjs";
import { calcolaBonus } from "./bonus-calc.mjs";

export class DaggerheartActor extends Actor {

  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();
    const sys = this.system;

    if (this.type === "character") {
      // Tier
      sys.tier = DH.tierDaLivello(sys.livello?.value ?? 1);

      // Armatura equipaggiata
      const armEquip = this.items.find(i => i.type === "armor" && i.system.equipaggiato);
      const lv = sys.livello?.value ?? 1;

      // Soglie base: da armatura se equipaggiata, altrimenti i valori manuali
      let sogliaMaggBase = sys.soglie?.maggiore ?? 0;
      let sogliaGravBase = sys.soglie?.grave ?? 0;
      if (armEquip) {
        sogliaMaggBase = (armEquip.system.sogliaMaggiore ?? 0) + lv;
        sogliaGravBase = (armEquip.system.sogliaGrave ?? 0) + lv;
      }
      // Caselle armatura base
      let caselleBase = armEquip?.system?.caselleArmatura ?? 0;

      // Evasione base
      const baseEv = sys.evasione?.value ?? 10;
      const agi    = sys.tratti?.agilita?.valore ?? 0;

      // === BONUS AUTOMATICI (privilegi, carte, armi, toggle) ===
      const b = calcolaBonus(this);
      sys.bonus = b;  // esposto al template per il pannello "Modificatori"

      // Frenesia: blocca l'armatura (slot azzerati)
      const frenesia = sys.bonusAttivi?.frenesia;

      sys.evasione.totale = baseEv + agi + (sys.evasione?.bonus ?? 0) + b.ev;
      sys.soglie.maggioreTot = sogliaMaggBase + b.mod;
      sys.soglie.graveTot    = sogliaGravBase + b.gra;

      const caselleTot = frenesia ? 0 : caselleBase + b.slot;
      sys.armatura.max = caselleTot;
      if (sys.armatura.value > caselleTot) sys.armatura.value = caselleTot;

      sys.armaturaEquipNome = armEquip?.name ?? null;
      sys.bonusCompetenzaDanno = sys.competenza?.value ?? 1;
    }

    if (this.type === "adversary") {
      // niente di derivato per ora oltre alle tracce
    }
  }

  /** Comodity helpers */
  get sperVal() { return this.system.speranza?.value ?? 0; }
  get sperMax() { return this.system.speranza?.max ?? 6; }

  async spendiSperanza(n = 1) {
    if (this.type !== "character") return;
    const cur = this.sperVal;
    if (cur < n) {
      ui.notifications.warn(`${this.name}: Speranza insufficiente.`);
      return false;
    }
    await this.update({ "system.speranza.value": cur - n });
    return true;
  }

  async marcaStress(n = 1) {
    const st = this.system.stress;
    const next = Math.min(st.max ?? 6, (st.value ?? 0) + n);
    await this.update({ "system.stress.value": next });
  }

  async subisciDanno(danno) {
    const sg = this.system.soglie;
    let pfPersi = 1; // Minore
    if (this.type === "adversary") {
      // Avversario: 1 PF al di sotto della Maggiore, 2 fra Maggiore e Grave, 3 oltre Grave (semplificato)
      if (danno < (sg?.maggiore ?? 0)) pfPersi = 1;
      else if (danno < (sg?.grave ?? 0)) pfPersi = 2;
      else pfPersi = 3;
    } else {
      // PG: Minore (1 PF), Maggiore (2 PF), Grave (3 PF), Massiccio (4 PF)
      if (danno < sg.maggiore) pfPersi = 1;
      else if (danno < sg.grave) pfPersi = 2;
      else pfPersi = 3;
      // Massiccio: > 2x soglia grave
      if (danno >= sg.grave * 2) pfPersi = 4;
    }
    const pfCur = this.system.pf.value ?? 0;
    const next = Math.min(this.system.pf.max ?? 1, pfCur + pfPersi);
    await this.update({ "system.pf.value": next });
    return pfPersi;
  }
}

export class DaggerheartItem extends Item {
  prepareDerivedData() {
    super.prepareDerivedData();
    if (this.type === "weapon") {
      const d = this.system.danno;
      this.system.dannoFormula = `${d.numDadi}${d.dado}${d.bonus ? (d.bonus >= 0 ? "+" : "") + d.bonus : ""}`;
    }
  }
}
