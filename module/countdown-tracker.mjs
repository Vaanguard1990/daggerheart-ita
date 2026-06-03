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
      cells: Array.from({ length: cd.max }, (_, i) =>
        cd.tipo === "progressivo" ? i < cd.valore : i < cd.valore)
    }));
    return { countdowns: list, isGM: game.user.isGM };
  }

  static async _add()   { await addCountdown(); this.render(); }
  static async _del(_e, t)   { await removeCountdown(t.dataset.id); this.render(); }
  static async _reset(_e, t) { await resetCountdown(t.dataset.id); this.render(); }

  static async _step(_e, t) {
    const delta = Number(t.dataset.delta ?? 1);
    const { scattato, cd } = await stepCountdown(t.dataset.id, delta);
    if (scattato && cd) {
      ChatMessage.create({
        content: `<div class="dh-countdown-trigger"><i class="fa-solid fa-hourglass-end"></i> Il countdown <strong>${cd.nome}</strong> è scattato!</div>`
      });
    }
    this.render();
  }

  static async _onSubmit(_event, _form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    const cds = data.cd ?? {};
    for (const [id, patch] of Object.entries(cds)) {
      await updateCountdown(id, {
        nome: patch.nome,
        max: Number(patch.max),
        tipo: patch.tipo,
        avanzamento: patch.avanzamento
      });
    }
    this.render();
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
