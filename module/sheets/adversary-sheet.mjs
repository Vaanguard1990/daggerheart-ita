import { DH } from "../config.mjs";

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
      gettoniStep:          DaggerheartAdversarySheet._gettoniStep
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

    const costo = it.system.costoPaura ?? 0;
    if (costo > 0) {
      const { getHopeFear, setHopeFear } = await import("../hope-fear.mjs");
      const hf = getHopeFear();
      if ((hf.paura ?? 0) < costo) {
        ui.notifications.warn(`Non c'è abbastanza Paura (serve ${costo}, disponibile ${hf.paura ?? 0}).`);
        return;
      }
      await setHopeFear({ paura: (hf.paura ?? 0) - costo });
    }

    const tipo = it.system.tipoPrivilegio ?? "Caratteristica";
    const costoHtml = costo > 0 ? `<div class="dh-chat-cost dh-chat-cost-fear"><i class="fa-solid fa-skull"></i> −${costo} Paura</div>` : "";
    const ricarica = it.system.ricarica ? `<div class="dh-chat-ricarica"><i class="fa-solid fa-rotate"></i> ${it.system.ricarica}</div>` : "";
    const desc = it.system.description ? `<div class="dh-chat-desc">${it.system.description}</div>` : "";

    const html = `<div class="dh-ability-card dh-ability-card-fear">
  <div class="dh-ability-header">
    <span class="dh-ability-name">${it.name}</span>
    <span class="dh-ability-tipo">${tipo}</span>
  </div>
  ${costoHtml}${ricarica}${desc}
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
}
