import { DH } from "../config.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class DaggerheartItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["daggerheart-ita", "sheet", "item"],
    position: { width: 540, height: 580 },
    window:   { resizable: true, contentClasses: ["scrollable"] },
    form:     { submitOnChange: true, closeOnSubmit: false }
  };

  static PARTS = {
    body: { template: "systems/daggerheart-ita/templates/item/item.hbs", scrollable: [""] }
  };

  async _prepareContext() {
    return {
      item:    this.item,
      system:  this.item.system,
      type:    this.item.type,
      config:  DH,
      partial: `systems/daggerheart-ita/templates/item/parts/${this.item.type}.hbs`
    };
  }
}
