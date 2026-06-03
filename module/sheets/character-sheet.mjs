import { DH } from "../config.mjs";
import { DualityRoll } from "../duality-roll.mjs";
import { apriAvanzamento } from "../avanzamento.mjs";
import * as Applica from "../applica-srd.mjs";
import { parseCostoStress } from "../applica-srd.mjs";
import * as SRD from "../srd-data.mjs";

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
      avanzamento:     DaggerheartCharacterSheet._avanzamento,
      aggiungiCarta:   DaggerheartCharacterSheet._aggiungiCarta,
      modEvasione:     DaggerheartCharacterSheet._modEvasione,
      modSoglie:       DaggerheartCharacterSheet._modSoglie,
      trattoStep:      DaggerheartCharacterSheet._trattoStep,
      attivaItem:      DaggerheartCharacterSheet._attivaItem,
      gettoniStep:     DaggerheartCharacterSheet._gettoniStep,
      countdownItemStep: DaggerheartCharacterSheet._countdownItemStep
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

  async _prepareContext(options) {
    const sys = this.actor.system;
    const items = this.actor.items;
    const range = n => Array.from({ length: Math.max(0, n | 0) }, (_, i) => i);

    return {
      actor: this.actor,
      system: sys,
      config: DH,
      currentTab: this.tabGroups.primary,
      rollMode: this.rollMode,
      editMode: this.editMode,
      temaScuro: game.settings.get("daggerheart-ita", "temaScuro"),
      armi:        items.filter(i => i.type === "weapon"),
      armature:    items.filter(i => i.type === "armor"),
      armaturaEquip: items.find(i => i.type === "armor" && i.system?.equipaggiato),
      bonus: sys.bonus ?? { voci: [], toggles: [] },
      bonusAttivi: sys.bonusAttivi ?? {},
      formaAttiva: sys.formaAttiva ?? null,
      compagno: sys.compagno ?? {},
      cmpStressCells: range((sys.compagno?.stress?.max) ?? 3).map(i => ({ i, filled: i < (sys.compagno?.stress?.value ?? 0) })),
      formeBestiali: await this._caricaForme(),
      isDruido: /druido/i.test(sys.classe ?? ""),
      isRanger: /ranger/i.test(sys.classe ?? ""),
      dbClassi: await SRD.getClassi(),
      dbSottoclassi: await SRD.getSottoclassiPerClasse(sys.classe ?? ""),
      dbDiscendenze: await SRD.getDiscendenze(),
      dbComunita: await SRD.getComunita(),
      dbCarte: await SRD.getCarteDisponibili(sys.dominiClasse ?? [], sys.livello?.value ?? 10),
      privilegi:   items.filter(i => i.type === "feature"),
      esperienze:  items.filter(i => i.type === "experience"),
      dominii:     items.filter(i => i.type === "domainCard"),
      inventario:  items.filter(i => ["inventory", "consumable"].includes(i.type)),
      cellsPf:    range(sys.pf?.max ?? 6).map(i => ({ i, filled: i < (sys.pf?.value ?? 0) })),
      cellsStress: range(sys.stress?.max ?? 6).map(i => ({ i, filled: i < (sys.stress?.value ?? 0) })),
      cellsArmor: range(sys.armatura?.max ?? 0).map(i => ({ i, filled: i < (sys.armatura?.value ?? 0) })),
      cellsHope:  range(sys.speranza?.max ?? 6).map(i => ({ i, filled: i < (sys.speranza?.value ?? 0) })),
      trattiList: Object.entries(DH.tratti).map(([key, label]) => {
        const v = sys.tratti?.[key]?.valore ?? 0;
        return { key, label, valore: v, segno: v >= 0 ? "+" : "" };
      }),
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
      const data = await foundry.utils.fetchJsonWithTimeout("systems/daggerheart-ita/assets/srd/all.json");
      const lv = this.actor.system.livello?.value ?? 1;
      const rango = DH.rangoDaLivello(lv);
      this._formeCache = (data.FORME_BESTIALI ?? []).filter(f => (f.r ?? 1) <= rango);
      return this._formeCache;
    } catch (e) {
      console.error("Forme bestiali load error:", e);
      return [];
    }
  }

  /** Aggancia i listener nativi ai selettori SRD dopo ogni render. */
  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;
    if (!root) return;

    // Portrait click → FilePicker
    const portrait = root.querySelector(".dh-portrait img");
    if (portrait) {
      portrait.style.cursor = "pointer";
      portrait.title = "Clicca per cambiare l'immagine";
      portrait.addEventListener("click", () => {
        new FilePicker({
          type: "image",
          current: this.actor.img ?? "",
          callback: path => this.actor.update({ img: path })
        }).render(true);
      });
    }

    const map = {
      classe:      (v) => Applica.applicaClasse(this.actor, v),
      sottoclasse: (v) => Applica.applicaSottoclasse(this.actor, v),
      discendenza: (v) => Applica.applicaDiscendenza(this.actor, v),
      comunita:    (v) => Applica.applicaComunita(this.actor, v)
    };
    for (const [key, fn] of Object.entries(map)) {
      const el = root.querySelector(`[data-sel="${key}"]`);
      if (el) el.addEventListener("change", (ev) => fn(ev.target.value));
    }
  }

  // === ACTIONS ===

  static _changeTab(event, target) {
    const tab = target.dataset.tab;
    if (!tab || tab === this.tabGroups.primary) return;
    this.tabGroups.primary = tab;
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

  static async _toggleBonus(event, target) {
    const key = target.dataset.key;
    if (!key) return;
    const cur = foundry.utils.duplicate(this.actor.system.bonusAttivi ?? {});
    cur[key] = !cur[key];
    await this.actor.update({ "system.bonusAttivi": cur });
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

  static async _avanzamento() {
    return apriAvanzamento(this.actor);
  }

  static async _aggiungiCarta(event, target) {
    const sel = this.element.querySelector('[data-add="carta"]');
    if (!sel || !sel.value) return;
    const [dominio, nome] = sel.value.split("||");
    await Applica.aggiungiCarta(this.actor, dominio, nome);
  }

  // === MODIFICA EVASIONE / SOGLIE (pop-up) ===

  static async _modEvasione() {
    const cur = this.actor.system.evasione?.value ?? 10;
    const v = await foundry.applications.api.DialogV2.prompt({
      window: { title: "Modifica Evasione base" },
      content: `<p>Valore base dell'Evasione (i bonus si sommano in automatico):</p>
        <input type="number" name="ev" value="${cur}" autofocus style="width:100%;"/>`,
      ok: {
        label: "Salva",
        callback: (e, button) => parseInt(button.form.elements.ev.value, 10)
      }
    }).catch(() => null);
    if (Number.isFinite(v)) await this.actor.update({ "system.evasione.value": v });
  }

  static async _modSoglie() {
    const s = this.actor.system.soglie ?? {};
    const ov = s.override ?? {};
    const content = `
      <p>Le soglie derivano dall'armatura + livello. Imposta qui un <strong>override manuale</strong> (lascia vuoto per usare il calcolo automatico).</p>
      <div style="display:flex; gap:.5rem;">
        <label style="flex:1;">Maggiore (base)<input type="number" name="magg" value="${Number.isFinite(ov.maggiore) ? ov.maggiore : ""}" style="width:100%;"/></label>
        <label style="flex:1;">Grave (base)<input type="number" name="grav" value="${Number.isFinite(ov.grave) ? ov.grave : ""}" style="width:100%;"/></label>
      </div>
      <p style="font-size:11px; opacity:.7;">Valori attuali calcolati: Maggiore ${s.maggioreTot ?? "-"}, Grave ${s.graveTot ?? "-"}.</p>`;
    const res = await foundry.applications.api.DialogV2.prompt({
      window: { title: "Modifica Soglie di Danno" },
      content,
      ok: {
        label: "Salva",
        callback: (e, button) => {
          const m = button.form.elements.magg.value;
          const g = button.form.elements.grav.value;
          return {
            maggiore: m === "" ? null : parseInt(m, 10),
            grave:    g === "" ? null : parseInt(g, 10)
          };
        }
      }
    }).catch(() => null);
    if (res) {
      if (res.maggiore === null && res.grave === null) {
        await this.actor.update({ "system.soglie.override": null });
      } else {
        await this.actor.update({ "system.soglie.override": res });
      }
    }
  }

  // === FORME BESTIALI / COMPAGNO ===

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

  static async _trattoStep(event, target) {
    const key = target.dataset.tratto;
    const delta = parseInt(target.dataset.delta, 10);
    if (!key || !Number.isFinite(delta)) return;
    const cur = this.actor.system.tratti?.[key]?.valore ?? 0;
    const nuovo = Math.max(-3, Math.min(4, cur + delta));
    await this.actor.update({ [`system.tratti.${key}.valore`]: nuovo });
  }

  static async _attivaItem(event, target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    const it = this.actor.items.get(id);
    if (!it) return;

    const costoDefault = it.type === "domainCard" ? 1 : 0;
    const costo = it.system.costoSperanza ?? costoDefault;
    const speranza = this.actor.system.speranza ?? { value: 0, max: 6 };

    if (costo > 0) {
      if ((speranza.value ?? 0) < costo) {
        ui.notifications.warn(`Non hai abbastanza Speranza (serve ${costo}, hai ${speranza.value ?? 0}).`);
        return;
      }
      await this.actor.update({ "system.speranza.value": (speranza.value ?? 0) - costo });
    }

    // Stress: controlla campo o fallback da descrizione; chiedi conferma al giocatore
    const costoStressField = it.system.costoStress ?? 0;
    const costoStressParsed = costoStressField > 0 ? costoStressField : parseCostoStress(it.system.description ?? "");
    if (costoStressParsed > 0) {
      const stressAttuale = this.actor.system.stress?.value ?? 0;
      const stressMax = this.actor.system.stress?.max ?? 6;
      const ok = await foundry.applications.api.DialogV2.confirm({
        window: { title: "Segna Stress" },
        content: `<p>Questa abilità richiede di segnare <strong>${costoStressParsed} Stress</strong>.<br>Stress attuale: ${stressAttuale}/${stressMax}.<br><br>Vuoi segnarlo adesso?</p>`
      }).catch(() => false);
      if (ok) {
        await this.actor.update({ "system.stress.value": Math.min(stressMax, stressAttuale + costoStressParsed) });
      }
    }

    const tipo = it.system.dominio ? "Carta Dominio" : (it.system.tipoPrivilegio ?? "Privilegio");
    const dominioBadge = it.system.dominio ? `<span class="dh-chat-badge">${it.system.dominio}</span>` : "";
    const costoHtml = costo > 0 ? `<div class="dh-chat-cost"><i class="fa-solid fa-star"></i> −${costo} Speranza</div>` : "";
    const costoStressHtml = costoStressParsed > 0 ? `<div class="dh-chat-cost dh-chat-cost-stress"><i class="fa-solid fa-brain"></i> ${costoStressParsed} Stress</div>` : "";
    const ricarica = it.system.ricarica ? `<div class="dh-chat-ricarica"><i class="fa-solid fa-rotate"></i> ${it.system.ricarica}</div>` : "";
    const desc = it.system.description ? `<div class="dh-chat-desc">${it.system.description}</div>` : "";

    const html = `<div class="dh-ability-card">
    <div class="dh-ability-header">
      ${dominioBadge}
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
    const nuovo = Math.max(0, Math.min(max, cur + delta));
    await it.update({ "system.gettoni.value": nuovo });
  }

  static async _countdownItemStep(event, target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    const it = this.actor.items.get(id);
    if (!it) return;
    const cd = it.system.countdown ?? {};
    const max = cd.max ?? 0;
    if (max <= 0) return;
    const delta = parseInt(target.dataset.delta, 10);
    // delta positivo = "avanza" nel verso naturale del countdown
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
