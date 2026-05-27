import { getHopeFear, setHopeFear } from "./hope-fear.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class HopeFearTracker extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "dh-hope-fear-tracker",
    classes: ["daggerheart-ita", "hope-fear-tracker"],
    window: { title: "Speranza & Paura", icon: "fa-solid fa-skull", resizable: false },
    position: { width: 260, height: "auto" },
    actions: {
      addFear:     HopeFearTracker._addFear,
      subFear:     HopeFearTracker._subFear,
      addHope:     HopeFearTracker._addHope,
      subHope:     HopeFearTracker._subHope,
      reset:       HopeFearTracker._reset
    }
  };

  static PARTS = {
    body: { template: "systems/daggerheart-ita/templates/dialog/hope-fear.hbs" }
  };

  async _prepareContext() {
    const hf = getHopeFear();
    const max = game.settings.get("daggerheart-ita", "pauraMax") || 12;
    return {
      paura: hf.paura ?? 0,
      speranzaGruppo: hf.speranzaGruppo ?? 0,
      max,
      pauraCells: Array.from({ length: max }, (_, i) => i < (hf.paura ?? 0)),
      isGM: game.user.isGM
    };
  }

  static async _addFear() { const hf = getHopeFear(); await setHopeFear({ paura: (hf.paura ?? 0) + 1 }); this.render(); }
  static async _subFear() { const hf = getHopeFear(); await setHopeFear({ paura: (hf.paura ?? 0) - 1 }); this.render(); }
  static async _addHope() { const hf = getHopeFear(); await setHopeFear({ speranzaGruppo: (hf.speranzaGruppo ?? 0) + 1 }); this.render(); }
  static async _subHope() { const hf = getHopeFear(); await setHopeFear({ speranzaGruppo: (hf.speranzaGruppo ?? 0) - 1 }); this.render(); }
  static async _reset()   { await setHopeFear({ paura: 0, speranzaGruppo: 0 }); this.render(); }
}

let instance = null;
export function openTracker() {
  if (!instance) instance = new HopeFearTracker();
  instance.render(true);
}

export function refreshTracker() {
  if (instance?.rendered) instance.render();
}
