// Document classes personalizzate per Daggerheart ITA
import { DH } from "./config.mjs";
import { calcolaBonus } from "./bonus-calc.mjs";

export class DaggerheartActor extends Actor {

  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();
    const sys = this.system;

    if (this.type === "character") {
      // Tier (equipaggiamento) e Rango (avanzamenti/forme)
      const _lv = sys.livello?.value ?? 1;
      sys.tier  = DH.tierDaLivello(_lv);
      sys.rango = DH.rangoDaLivello(_lv);

      // Armatura equipaggiata
      const armEquip = this.items.find(i => i.type === "armor" && i.system.equipaggiato);
      const lv = sys.livello?.value ?? 1;

      // === BONUS AUTOMATICI (privilegi, carte, armi, toggle) ===
      const b = calcolaBonus(this);
      sys.bonus = b;

      // --- EVASIONE: base (parte da 10) + bonus. NIENTE Agilità (regola Daggerheart) ---
      const baseEv = sys.evasione?.value ?? 10;
      sys.evasione.totale = baseEv + (sys.evasione?.bonus ?? 0) + b.ev;

      // --- SOGLIE: derivano SOLO dall'armatura + livello, poi + bonus ---
      // Se è impostato un override manuale (system.soglie.override), usa quello come base.
      const ov = sys.soglie?.override;
      let sogliaMaggBase, sogliaGravBase;
      if (ov && (Number.isFinite(ov.maggiore) || Number.isFinite(ov.grave))) {
        sogliaMaggBase = Number.isFinite(ov.maggiore) ? ov.maggiore : 0;
        sogliaGravBase = Number.isFinite(ov.grave) ? ov.grave : lv;
      } else if (armEquip) {
        sogliaMaggBase = (armEquip.system.sogliaMaggiore ?? 0) + lv;
        sogliaGravBase = (armEquip.system.sogliaGrave ?? 0) + lv;
      } else {
        // Senza armatura: Maggiore 0, Grave = livello
        sogliaMaggBase = 0;
        sogliaGravBase = lv;
      }
      sys.soglie.maggiore = sogliaMaggBase;
      sys.soglie.grave    = sogliaGravBase;
      sys.soglie.maggioreTot = sogliaMaggBase + b.mod;
      sys.soglie.graveTot    = sogliaGravBase + b.gra;

      // --- ARMATURA (caselle): base armatura + bonus, azzerata da Frenesia ---
      const frenesia = sys.bonusAttivi?.frenesia;
      const caselleBase = armEquip?.system?.caselleArmatura ?? 0;
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
