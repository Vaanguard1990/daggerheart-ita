import { DH } from "../config.mjs";
import { DualityRoll } from "../duality-roll.mjs";
import { apriAvanzamento } from "../avanzamento.mjs";

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
      toggleEditMode:  DaggerheartCharacterSheet._toggleEditMode,
      toggleBonus:     DaggerheartCharacterSheet._toggleBonus,
      trasforma:       DaggerheartCharacterSheet._trasforma,
      tornaUmano:      DaggerheartCharacterSheet._tornaUmano,
      cmpStress:       DaggerheartCharacterSheet._cmpStress,
      cmpStressMax:    DaggerheartCharacterSheet._cmpStressMax,
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
      longRest:        DaggerheartCharacterSheet._longRest,
      avanzamento:     DaggerheartCharacterSheet._avanzamento
    }
  };

  static PARTS = {
    body: { template: "systems/daggerheart-ita/templates/actor/character.hbs", scrollable: [""] }
  };

  tabGroups = { primary: "main" };
  rollMode = "normale";
  editMode = false;

  get title() {
    return this.actor?.name ?? "Personaggio";
  }

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
      editMode: this.editMode,
      temaScuro: game.settings.get("daggerheart-ita", "temaScuro"),
      // Items raggruppati
      armi:        items.filter(i => i.type === "weapon"),
      armature:    items.filter(i => i.type === "armor"),
      armaturaEquip: items.find(i => i.type === "armor" && i.system?.equipaggiato),
      bonus: this.actor.system.bonus ?? { voci: [], toggles: [] },
      bonusAttivi: this.actor.system.bonusAttivi ?? {},
      formaAttiva: this.actor.system.formaAttiva ?? null,
      compagno: this.actor.system.compagno ?? {},
      cmpStressCells: range((this.actor.system.compagno?.stress?.max) ?? 3).map(i => ({ i, filled: i < (this.actor.system.compagno?.stress?.value ?? 0) })),
      formeBestiali: await this._caricaForme(),
      isDruido: /druido/i.test(this.actor.system.classe ?? ""),
      isRanger: /ranger/i.test(this.actor.system.classe ?? ""),
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
      tabs: this._buildTabs()
    };
  }

  _buildTabs() {
    const cls = this.actor.system.classe ?? "";
    const t = [
      { id: "main",   label: "Personaggio",        icon: "fa-user" },
      { id: "equip",  label: "Equipaggiamento",    icon: "fa-shield" },
      { id: "domini", label: "Dominî & Privilegi", icon: "fa-book" }
    ];
    if (/druido/i.test(cls)) t.push({ id: "bestie",   label: "Forme Bestiali", icon: "fa-paw" });
    if (/ranger/i.test(cls)) t.push({ id: "compagno", label: "Compagno",       icon: "fa-dog" });
    t.push({ id: "bio", label: "Biografia", icon: "fa-scroll" });
    return t.map(x => ({ ...x, active: x.id === this.tabGroups.primary }));
  }

  async _caricaForme() {
    if (!/druido/i.test(this.actor.system.classe ?? "")) return [];
    if (this._formeCache) return this._formeCache;
    try {
      const url = "systems/daggerheart-ita/assets/srd/all.json";
      const data = await foundry.utils.fetchJsonWithTimeout(url);
      const lv = this.actor.system.livello?.value ?? 1;
      const rango = DH.rangoDaLivello(lv);
      this._formeCache = (data.FORME_BESTIALI ?? []).filter(f => (f.r ?? 1) <= rango);
      return this._formeCache;
    } catch (e) {
      console.error("Forme bestiali load error:", e);
      return [];
    }
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

  static _toggleEditMode() {
    this.editMode = !this.editMode;
    this.render();
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
    const comp = this.actor.system.competenza?.value ?? 1;
    const num = Math.max(d.numDadi ?? 1, comp);
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

  static async _trasforma(event, target) {
    const nome = target.dataset.nome;
    const forme = await this._caricaForme();
    const f = forme.find(x => x.nome === nome);
    if (!f) return;
    await this.actor.update({ "system.formaAttiva": f });
    ui.notifications.info(`Trasformazione: ${f.nome}`);
  }

  static async _tornaUmano() {
    await this.actor.update({ "system.formaAttiva": null });
  }

  static async _cmpStress(event, target) {
    const idx = parseInt(target.dataset.idx, 10);
    const cmp = foundry.utils.duplicate(this.actor.system.compagno ?? {});
    const cur = cmp.stress?.value ?? 0;
    cmp.stress = cmp.stress ?? { value: 0, max: 3 };
    cmp.stress.value = cur === idx + 1 ? idx : idx + 1;
    await this.actor.update({ "system.compagno": cmp });
  }

  static async _cmpStressMax(event, target) {
    const delta = parseInt(target.dataset.delta, 10);
    const cmp = foundry.utils.duplicate(this.actor.system.compagno ?? {});
    cmp.stress = cmp.stress ?? { value: 0, max: 3 };
    cmp.stress.max = Math.max(1, (cmp.stress.max ?? 3) + delta);
    await this.actor.update({ "system.compagno": cmp });
  }
}
