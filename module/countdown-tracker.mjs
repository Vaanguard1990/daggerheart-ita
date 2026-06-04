import {
  getCountdowns, addCountdown, removeCountdown,
  updateCountdown, stepCountdown, resetCountdown
} from "./countdowns.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class CountdownTracker extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "dh-countdown-tracker",
    classes: ["daggerheart-ita", "countdown-tracker"],
    window: { title: "Countdown", icon: "fa-solid fa-hourglass-half", resizable: true },
    position: { width: 320, height: "auto" },
    actions: {
      add:   CountdownTracker._add,
      step:  CountdownTracker._step,
      reset: CountdownTracker._reset,
      del:   CountdownTracker._del
    },
    form: { handler: CountdownTracker._onSubmit, submitOnChange: true, closeOnSubmit: false }
  };

  static PARTS = {
    body: { template: "systems/daggerheart-ita/templates/dialog/countdowns.hbs" }
  };

  async _prepareContext() {
    const list = getCountdowns().map(cd => ({
      ...cd,
      cells: Array.from({ length: cd.max }, (_, i) => i < cd.valore)
    }));
    return { countdowns: list, isGM: game.user.isGM };
  }

  static async _add()   { await addCountdown(); }
  static async _del(_e, t)   { await removeCountdown(t.dataset.id); }
  static async _reset(_e, t) { await resetCountdown(t.dataset.id); }

  static async _step(_e, t) {
    const delta = Number(t.dataset.delta ?? 1);
    const { scattato, cd } = await stepCountdown(t.dataset.id, delta);
    if (scattato && cd) {
      ChatMessage.create({
        content: `<div class="dh-countdown-trigger"><i class="fa-solid fa-hourglass-end"></i> Il countdown <strong>${cd.nome}</strong> è scattato!</div>`
      });
    }
  }

  static async _onSubmit(_event, _form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    const cds = data.cd ?? {};
    // Batch all updates without triggering renders mid-loop; hook fires on final save
    const list = getCountdowns();
    for (const [id, patch] of Object.entries(cds)) {
      const cd = list.find(c => c.id === id);
      if (!cd) continue;
      cd.nome       = patch.nome       ?? cd.nome;
      cd.max        = Math.max(1, Number(patch.max) || cd.max);
      cd.tipo       = patch.tipo       ?? cd.tipo;
      cd.avanzamento = patch.avanzamento ?? cd.avanzamento;
      cd.valore     = Math.min(cd.max, Math.max(0, cd.valore ?? 0));
    }
    await game.settings.set("daggerheart-ita", "countdowns", list);
    Hooks.callAll("daggerheart.countdownsChanged", list);
  }
}

let instance = null;
export function openCountdowns() {
  if (!instance) instance = new CountdownTracker();
  instance.render(true);
}
export function refreshCountdowns() {
  if (instance?.rendered) instance.render();
}
