import { DH } from "../config.mjs";
import { DualityRoll } from "../duality-roll.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class DaggerheartCharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["daggerheart-ita", "sheet", "character"],
    position: { width: 760, height: 720 },
    window:   { resizable: true, contentClasses: ["scrollable"] },
    form:     { submitOnChange: true, closeOnSubmit: false },
    actions: {
      changeTab:       DaggerheartCharacterSheet._changeTab,
      setRollMode:     DaggerheartCharacterSheet._setRollMode,
      tiraTratto:      DaggerheartCharacterSheet._tiraTratto,
      tiraArma:        DaggerheartCharacterSheet._tiraArma,
      tiraDanno:       DaggerheartCharacterSheet._tiraDanno,
      spendiSperanza:  DaggerheartCharacterSheet._spendiSperanza,
      togglePf:        DaggerheartCharacterSheet._togglePf,
      toggleStress:    DaggerheartCharacterSheet._toggleStress,
      toggleArmatura:  DaggerheartCharacterSheet._toggleArmatura,
      itemEdit:        DaggerheartCharacterSheet._itemEdit,
      itemDelete:      DaggerheartCharacterSheet._itemDelete,
      itemCreate:      DaggerheartCharacterSheet._itemCreate,
      itemEquip:       DaggerheartCharacterSheet._itemEquip,
      shortRest:       DaggerheartCharacterSheet._shortRest,
      longRest:        DaggerheartCharacterSheet._longRest
    }
  };

  static PARTS = {
    body: { template: "systems/daggerheart-ita/templates/actor/character.hbs", scrollable: [""] }
  };

  tabGroups = { primary: "main" };
  rollMode = "normale";

  get title() {
    return this.actor?.name ?? "Personaggio";
  }

  async _prepareContext(options) {
    const sys = this.actor.system;
    const items = this.actor.items;

    // Costruisci array celle (no helper Handlebars per array vuoto da numero)
    const range = n => Array.from({ length: Math.max(0, n|0) }, (_, i) => i);

    return {
      actor:  this.actor,
      system: sys,
      config: DH,
      currentTab: this.tabGroups.primary,
      rollMode: this.rollMode,
      // Items raggruppati
      armi:        items.filter(i => i.type === "weapon"),
      armature:    items.filter(i => i.type === "armor"),
      privilegi:   items.filter(i => i.type === "feature"),
      esperienze:  items.filter(i => i.type === "experience"),
      dominii:     items.filter(i => i.type === "domainCard"),
      inventario:  items.filter(i => ["inventory","consumable"].includes(i.type)),
      // Celle per le tracce
      cellsPf:    range(sys.pf?.max ?? 6).map(i => ({ i, filled: i < (sys.pf?.value ?? 0) })),
      cellsStress: range(sys.stress?.max ?? 6).map(i => ({ i, filled: i < (sys.stress?.value ?? 0) })),
      cellsArmor: range(sys.armatura?.max ?? 0).map(i => ({ i, filled: i < (sys.armatura?.value ?? 0) })),
      cellsHope:  range(sys.speranza?.max ?? 6).map(i => ({ i, filled: i < (sys.speranza?.value ?? 0) })),
      // Tratti ordinati con segno
      trattiList: Object.entries(DH.tratti).map(([key, label]) => {
        const v = sys.tratti?.[key]?.valore ?? 0;
        return { key, label, valore: v, segno: v >= 0 ? "+" : "" };
      }),
      // Tabs
      tabs: [
        { id: "main",   label: "Personaggio",        icon: "fa-user" },
        { id: "equip",  label: "Equipaggiamento",    icon: "fa-shield" },
        { id: "domini", label: "Dominî & Privilegi", icon: "fa-book" },
        { id: "bio",    label: "Biografia",          icon: "fa-scroll" }
      ].map(t => ({ ...t, active: t.id === this.tabGroups.primary }))
    };
  }

  // === ACTIONS ===

  static _changeTab(event, target) {
    const tab = target.dataset.tab;
    if (!tab || tab === this.tabGroups.primary) return;
    this.tabGroups.primary = tab;
    // Switch CSS senza re-render completo
    const root = this.element;
    root.querySelectorAll(".dh-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
    root.querySelectorAll(".dh-tab-content").forEach(c => c.classList.toggle("active", c.dataset.tabContent === tab));
  }

  static _setRollMode(event, target) {
    const mode = target.dataset.mode;
    if (!mode || mode === this.rollMode) return;
    this.rollMode = mode;
    this.element.querySelectorAll(".dh-mode-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });
  }

  static async _tiraTratto(event, target) {
    let modo = this.rollMode === "normale" ? null : this.rollMode;
    if (event.shiftKey) modo = "vantaggio";
    else if (event.ctrlKey) modo = "svantaggio";
    return DualityRoll.tira({
      actor: this.actor,
      trattoKey: target.dataset.tratto,
      label: `Tiro ${DH.tratti[target.dataset.tratto]}`,
      modo
    });
  }

  static async _tiraArma(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset?.itemId;
    const it = this.actor.items.get(itemId);
    if (!it) return;
    const trattoMap = { "Agilità":"agilita","Forza":"forza","Astuzia":"astuzia","Istinto":"istinto","Presenza":"presenza","Conoscenza":"conoscenza" };
    let modo = this.rollMode === "normale" ? null : this.rollMode;
    if (event.shiftKey) modo = "vantaggio";
    else if (event.ctrlKey) modo = "svantaggio";
    return DualityRoll.tira({
      actor: this.actor,
      trattoKey: trattoMap[it.system.tratto] ?? "agilita",
      label: `Attacco: ${it.name} (${it.system.portata})`,
      modo
    });
  }

  static async _tiraDanno(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset?.itemId;
    const it = this.actor.items.get(itemId);
    if (!it) return;
    const d = it.system.danno;
    const tier = this.actor.system.tier ?? 1;
    const num = Math.max(d.numDadi ?? 1, tier);
    const formula = `${num}${d.dado}${d.bonus ? (d.bonus >= 0 ? "+" : "") + d.bonus : ""}`;
    const roll = new Roll(formula);
    await roll.evaluate();
    const tag = d.tipoDanno === "magico" ? "magico" : "fisico";
    const html = `<div class="dh-danno-card">
      <div class="dh-danno-card-header"><i class="fa-solid fa-burst"></i> Danno · ${it.name} · ${tag}</div>
      <div>${await roll.render()}</div></div>`;
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: html, rolls: [roll], sound: CONFIG.sounds.dice
    });
  }

  static async _spendiSperanza(event, target) {
    return this.actor.spendiSperanza(parseInt(target.dataset.amount ?? "1", 10));
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
  static async _toggleArmatura(event, target) {
    const idx = parseInt(target.dataset.idx, 10);
    const cur = this.actor.system.armatura.value ?? 0;
    return this.actor.update({ "system.armatura.value": cur === idx + 1 ? idx : idx + 1 });
  }

  static async _itemEdit(event, target) {
    this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId)?.sheet?.render(true);
  }
  static async _itemDelete(event, target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    const it = this.actor.items.get(id);
    if (!it) return;
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Eliminare l'oggetto?" },
      content: `<p>Confermare l'eliminazione di <strong>${it.name}</strong>?</p>`
    });
    if (ok) it.delete();
  }
  static async _itemCreate(event, target) {
    const type = target.dataset.type;
    Item.create({ name: `Nuovo ${type}`, type }, { parent: this.actor });
  }
  static async _itemEquip(event, target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    const it = this.actor.items.get(id);
    if (!it) return;
    if (it.type === "armor") {
      const altre = this.actor.items.filter(i => i.type === "armor" && i.id !== it.id);
      for (const a of altre) await a.update({ "system.equipaggiato": false });
    }
    return it.update({ "system.equipaggiato": !it.system.equipaggiato });
  }

  static async _shortRest() {
    return foundry.applications.api.DialogV2.prompt({
      window: { title: "Riposo Breve" },
      content: `<p>Hai effettuato un riposo breve. Scegli manualmente i benefici (PF, Stress, Armatura, preparare carta dominio).</p>`,
      ok: { label: "Ok" }
    });
  }
  static async _longRest() {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Riposo Lungo" },
      content: `<p>Recuperare tutti i PF, Stress e Caselle Armatura?</p>`
    });
    if (!ok) return;
    return this.actor.update({
      "system.pf.value": 0, "system.stress.value": 0, "system.armatura.value": 0,
      "system.speranza.value": Math.max(this.actor.system.speranza?.value ?? 0, 2)
    });
  }
}
