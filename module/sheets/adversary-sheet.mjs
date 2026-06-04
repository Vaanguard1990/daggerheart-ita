import { DH } from "../config.mjs";
import { parseCostoPaura, parseCostoStress } from "../applica-srd.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class DaggerheartAdversarySheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["daggerheart-ita", "sheet", "adversary"],
    position: { width: 560, height: 640 },
    window:   { resizable: true, contentClasses: ["scrollable"] },
    form:     { submitOnChange: true, closeOnSubmit: false },
    actions: {
      changeTab:            DaggerheartAdversarySheet._changeTab,
      tiraAttacco:          DaggerheartAdversarySheet._tiraAttacco,
      tiraDanno:            DaggerheartAdversarySheet._tiraDanno,
      togglePf:             DaggerheartAdversarySheet._togglePf,
      toggleStress:         DaggerheartAdversarySheet._toggleStress,
      itemEdit:             DaggerheartAdversarySheet._itemEdit,
      itemDelete:           DaggerheartAdversarySheet._itemDelete,
      itemCreate:           DaggerheartAdversarySheet._itemCreate,
      spendiPaura:          DaggerheartAdversarySheet._spendiPaura,
      attivaCaratteristica: DaggerheartAdversarySheet._attivaCaratteristica,
      gettoniStep:          DaggerheartAdversarySheet._gettoniStep,
      countdownItemStep:    DaggerheartAdversarySheet._countdownItemStep,
      countdownActorStep:   DaggerheartAdversarySheet._countdownActorStep,
      countdownActorReset:  DaggerheartAdversarySheet._countdownActorReset
    }
  };

  static PARTS = {
    body: { template: "systems/daggerheart-ita/templates/actor/adversary.hbs", scrollable: [""] }
  };

  tabGroups = { primary: "stats" };

  get title() {
    return this.actor?.name ?? "Avversario";
  }

  async _prepareContext() {
    const sys = this.actor.system;
    const range = n => Array.from({ length: Math.max(0, n|0) }, (_, i) => i);
    return {
      actor: this.actor, system: sys, config: DH,
      currentTab: this.tabGroups.primary,
      caratteristiche: this.actor.items.filter(i => i.type === "feature"),
      tipoColore: DH.tipiAvversarioColore[sys.tipo] ?? "#8b6914",
      cellsPf:     range(sys.pf?.max ?? 1).map(i => ({ i, filled: i < (sys.pf?.value ?? 0) })),
      cellsStress: range(sys.stress?.max ?? 1).map(i => ({ i, filled: i < (sys.stress?.value ?? 0) })),
      tabs: [
        { id: "stats",    label: "Statistiche",     icon: "fa-shield-halved" },
        { id: "attack",   label: "Attacco",         icon: "fa-sword" },
        { id: "features", label: "Caratteristiche", icon: "fa-list-check" },
        { id: "desc",     label: "Descrizione",     icon: "fa-scroll" }
      ].map(t => ({ ...t, active: t.id === this.tabGroups.primary }))
    };
  }

  static _changeTab(event, target) {
    const tab = target.dataset.tab;
    if (!tab || tab === this.tabGroups.primary) return;
    this.tabGroups.primary = tab;
    const root = this.element;
    root.querySelectorAll(".dh-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
    root.querySelectorAll(".dh-tab-content").forEach(c => c.classList.toggle("active", c.dataset.tabContent === tab));
  }

  static async _tiraAttacco() {
    const a = this.actor.system.attacco;
    const bonus = parseInt(a.bonus ?? 0, 10) || 0;
    const segno = bonus >= 0 ? "+" : "";
    const formula = bonus !== 0 ? `1d20${segno}${bonus}` : "1d20";
    const roll = new Roll(formula);
    await roll.evaluate();
    const html = `<div class="dh-att-card">
      <div class="dh-att-card-h"><i class="fa-solid fa-sword"></i> ${this.actor.name} attacca con ${a.nome || "Attacco"} (${a.portata || "-"})</div>
      <div>${await roll.render()}</div></div>`;
    return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: html, rolls: [roll], sound: CONFIG.sounds.dice });
  }

  static async _tiraDanno() {
    const a = this.actor.system.attacco;
    if (!a.danno) return;
    const m = /(\d+[dD]\d+(?:[+-]\d+)?)/.exec(a.danno);
    if (!m) return;
    const roll = new Roll(m[1]);
    await roll.evaluate();
    const tag = /mag/i.test(a.danno) ? "magico" : "fisico";
    const html = `<div class="dh-danno-card">
      <div class="dh-danno-card-header"><i class="fa-solid fa-burst"></i> Danno · ${a.nome || this.actor.name} · ${tag}</div>
      <div>${await roll.render()}</div></div>`;
    return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: html, rolls: [roll], sound: CONFIG.sounds.dice });
  }

  static async _togglePf(event, target) {
    const idx = parseInt(target.dataset.idx, 10);
    const cur = this.actor.system.pf.value ?? 0;
    return this.actor.update({ "system.pf.value": cur === idx + 1 ? idx : idx + 1 });
  }
  static async _toggleStress(event, target) {
    const idx = parseInt(target.dataset.idx, 10);
    const cur = this.actor.system.stress.value ?? 0;
    return this.actor.update({ "system.stress.value": cur === idx + 1 ? idx : idx + 1 });
  }
  static async _itemEdit(event, target)   { this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId)?.sheet.render(true); }
  static async _itemDelete(event, target) { this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId)?.delete(); }
  static async _itemCreate() { Item.create({ name: "Nuova caratteristica", type: "feature" }, { parent: this.actor }); }

  static async _spendiPaura() {
    const { getHopeFear, setHopeFear } = await import("../hope-fear.mjs");
    const hf = getHopeFear();
    if ((hf.paura ?? 0) < 1) { ui.notifications.warn("Nessuna Paura disponibile."); return; }
    await setHopeFear({ paura: hf.paura - 1 });
    ChatMessage.create({
      content: `<div class="dh-fear-spent">Il GM spende <strong>1 Paura</strong> per <em>${this.actor.name}</em>.</div>`,
      speaker: ChatMessage.getSpeaker({ actor: this.actor })
    });
  }

  static async _attivaCaratteristica(event, target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    const it = this.actor.items.get(id);
    if (!it) return;

    // costoPaura: usa campo esplicito oppure fallback da descrizione
    const costoField = it.system.costoPaura ?? 0;
    const costo = costoField > 0 ? costoField : parseCostoPaura(it.system.description ?? "");
    if (costo > 0) {
      const { getHopeFear, setHopeFear } = await import("../hope-fear.mjs");
      const hf = getHopeFear();
      if ((hf.paura ?? 0) < costo) {
        ui.notifications.warn(`Non c'è abbastanza Paura (serve ${costo}, disponibile ${hf.paura ?? 0}).`);
        return;
      }
      await setHopeFear({ paura: (hf.paura ?? 0) - costo });
    }

    // Stress: controlla campo o fallback da descrizione; chiedi conferma al GM
    const costoStressField = it.system.costoStress ?? 0;
    const costoStress = costoStressField > 0 ? costoStressField : parseCostoStress(it.system.description ?? "");
    if (costoStress > 0) {
      const stressAttuale = this.actor.system.stress?.value ?? 0;
      const stressMax = this.actor.system.stress?.max ?? 6;
      const ok = await foundry.applications.api.DialogV2.confirm({
        window: { title: "Segna Stress" },
        content: `<p>Questa caratteristica richiede di segnare <strong>${costoStress} Stress</strong> su <em>${this.actor.name}</em>.<br>Stress attuale: ${stressAttuale}/${stressMax}.<br><br>Segni lo Stress?</p>`
      }).catch(() => false);
      if (ok) {
        await this.actor.update({ "system.stress.value": Math.min(stressMax, stressAttuale + costoStress) });
      }
    }

    const tipo = it.system.tipoPrivilegio ?? "Caratteristica";
    const costoHtml = costo > 0 ? `<div class="dh-chat-cost dh-chat-cost-fear"><i class="fa-solid fa-skull"></i> −${costo} Paura</div>` : "";
    const costoStressHtml = costoStress > 0 ? `<div class="dh-chat-cost dh-chat-cost-stress"><i class="fa-solid fa-brain"></i> ${costoStress} Stress</div>` : "";
    const ricarica = it.system.ricarica ? `<div class="dh-chat-ricarica"><i class="fa-solid fa-rotate"></i> ${it.system.ricarica}</div>` : "";
    const desc = it.system.description ? `<div class="dh-chat-desc">${it.system.description}</div>` : "";

    const html = `<div class="dh-ability-card dh-ability-card-fear">
  <div class="dh-ability-header">
    <span class="dh-ability-name">${it.name}</span>
    <span class="dh-ability-tipo">${tipo}</span>
  </div>
  ${costoHtml}${costoStressHtml}${ricarica}${desc}
</div>`;

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: html
    });
  }

  static async _gettoniStep(event, target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    const it = this.actor.items.get(id);
    if (!it) return;
    const delta = parseInt(target.dataset.delta, 10);
    const cur = it.system.gettoni?.value ?? 0;
    const max = it.system.gettoni?.max ?? 0;
    await it.update({ "system.gettoni.value": Math.max(0, Math.min(max, cur + delta)) });
  }

  static async _countdownActorStep(event, target) {
    const cd = this.actor.system.countdown ?? {};
    const max = cd.max ?? 0;
    if (max <= 0) return;
    const delta = parseInt(target.dataset.delta, 10);
    const verso = cd.tipo === "progressivo" ? 1 : -1;
    const nuovo = Math.max(0, Math.min(max, (cd.valore ?? 0) + delta * verso));
    await this.actor.update({ "system.countdown.valore": nuovo });
    const soglia = cd.tipo === "progressivo" ? max : 0;
    if (nuovo === soglia) {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div class="dh-countdown-trigger"><i class="fa-solid fa-hourglass-end"></i> Il countdown <strong>${cd.nome || this.actor.name}</strong> è scattato!</div>`
      });
    }
  }

  static async _countdownActorReset() {
    const cd = this.actor.system.countdown ?? {};
    const val = cd.tipo === "progressivo" ? 0 : (cd.max ?? 0);
    await this.actor.update({ "system.countdown.valore": val });
  }

  static async _countdownItemStep(event, target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    const it = this.actor.items.get(id);
    if (!it) return;
    const cd = it.system.countdown ?? {};
    const max = cd.max ?? 0;
    if (max <= 0) return;
    const delta = parseInt(target.dataset.delta, 10);
    const verso = cd.tipo === "progressivo" ? 1 : -1;
    const nuovo = Math.max(0, Math.min(max, (cd.valore ?? 0) + delta * verso));
    await it.update({ "system.countdown.valore": nuovo });
    const soglia = cd.tipo === "progressivo" ? max : 0;
    if (nuovo === soglia) {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div class="dh-countdown-trigger"><i class="fa-solid fa-hourglass-end"></i> Il countdown <strong>${cd.nome || it.name}</strong> è scattato!</div>`
      });
    }
  }
}
