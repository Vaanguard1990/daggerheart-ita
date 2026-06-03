import { DH } from "../config.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class DaggerheartEnvironmentSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["daggerheart-ita", "sheet", "environment"],
    position: { width: 540, height: 580 },
    window:   { resizable: true, contentClasses: ["scrollable"] },
    form:     { submitOnChange: true, closeOnSubmit: false },
    actions: {
      changeTab:  DaggerheartEnvironmentSheet._changeTab,
      itemEdit:   DaggerheartEnvironmentSheet._itemEdit,
      itemDelete: DaggerheartEnvironmentSheet._itemDelete,
      itemCreate: DaggerheartEnvironmentSheet._itemCreate,
      countdownActorStep:  DaggerheartEnvironmentSheet._countdownActorStep,
      countdownActorReset: DaggerheartEnvironmentSheet._countdownActorReset
    }
  };

  static PARTS = {
    body: { template: "systems/daggerheart-ita/templates/actor/environment.hbs", scrollable: [""] }
  };

  tabGroups = { primary: "overview" };

  get title() {
    return this.actor?.name ?? "Ambiente";
  }

  async _prepareContext() {
    const sys = this.actor.system;
    return {
      actor: this.actor, system: sys, config: DH,
      currentTab: this.tabGroups.primary,
      caratteristiche: this.actor.items.filter(i => i.type === "feature"),
      tipoColore: DH.tipiAmbienteColore[sys.tipo] ?? "#5a7a5a",
      tabs: [
        { id: "overview", label: "Panoramica",      icon: "fa-map" },
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

  static async _itemEdit(event, target)   { this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId)?.sheet.render(true); }
  static async _itemDelete(event, target) { this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId)?.delete(); }
  static async _itemCreate() { Item.create({ name: "Nuova caratteristica", type: "feature" }, { parent: this.actor }); }

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
}
