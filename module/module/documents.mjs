// Document classes personalizzate per Daggerheart ITA
import { DH } from "./config.mjs";

export class DaggerheartActor extends Actor {

  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();
    const sys = this.system;

    if (this.type === "character") {
      // Tier
      sys.tier = DH.tierDaLivello(sys.livello?.value ?? 1);

      // Calcola caselle armatura totali da equipaggiamento
      const armEquip = this.items.find(i => i.type === "armor" && i.system.equipaggiato);
      const caselle  = armEquip?.system?.caselleArmatura ?? 0;
      sys.armatura.max = caselle;
      if (sys.armatura.value > caselle) sys.armatura.value = caselle;

      // Soglie da armatura (se equipaggiata)
      if (armEquip) {
        sys.soglie.maggiore = armEquip.system.sogliaMaggiore + (sys.livello?.value ?? 1);
        sys.soglie.grave    = armEquip.system.sogliaGrave    + (sys.livello?.value ?? 1);
      }

      // Evasione totale (base classe + Agilità + bonus armatura/sottoclasse)
      const baseEv = sys.evasione?.value ?? 10;
      const agi    = sys.tratti?.agilita?.valore ?? 0;
      sys.evasione.totale = baseEv + agi + (sys.evasione?.bonus ?? 0);

      // Bonus competenza per dadi danno arma (≈ tier per peso colpo)
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
