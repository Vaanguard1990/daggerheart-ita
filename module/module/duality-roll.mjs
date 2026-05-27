// Tiro Duality: 2d12 (Speranza + Paura) + bonus tratto + modificatori
//  - se Speranza > Paura: "con Speranza" (PG guadagna 1 Speranza in caso di successo)
//  - se Paura > Speranza: "con Paura" (GM guadagna 1 Paura)
//  - se uguali (doppio): "Critico!" (successo automatico, +1 Speranza, rimuove 1 Stress)
//  - vs Difficoltà (DC): >= DC = successo
//
// Vantaggio / Svantaggio: si aggiunge / sottrae 1d6 al totale (regola Daggerheart, non advantage classico).

import { setHopeFear, getHopeFear } from "./hope-fear.mjs";

const CRIT_HOPE_GAIN = 1;
const CRIT_STRESS_HEAL = 1;
const HOPE_GAIN = 1;
const FEAR_GAIN = 1;

export class DualityRoll {

  /**
   * @param {object} opts
   * @param {Actor}  opts.actor
   * @param {string} [opts.trattoKey]    es. "agilita"
   * @param {string} [opts.label]        descrizione del tiro (es. "Tiro Agilità")
   * @param {number} [opts.difficolta]   DC opzionale
   * @param {number} [opts.bonus]        bonus extra (oltre al tratto)
   * @param {"vantaggio"|"svantaggio"|null} [opts.modo]
   * @param {boolean} [opts.reazione]    se true, no Speranza/Paura su esito
   */
  static async tira(opts) {
    const {
      actor, trattoKey = null, label = "Tiro Duality",
      difficolta = null, bonus = 0, modo = null, reazione = false
    } = opts;

    // Componenti del tiro
    let formula = "1d12[Speranza] + 1d12[Paura]";
    if (trattoKey && actor) {
      const v = actor.system.tratti?.[trattoKey]?.valore ?? 0;
      formula += ` + ${v}[${game.i18n.localize("DH.Tratto." + trattoKey)}]`;
    }
    if (bonus) formula += ` ${bonus >= 0 ? "+" : ""}${bonus}[bonus]`;
    if (modo === "vantaggio")  formula += " + 1d6[vantaggio]";
    if (modo === "svantaggio") formula += " - 1d6[svantaggio]";

    const roll = new Roll(formula, actor?.getRollData?.() ?? {});
    await roll.evaluate();

    // Estrazione singoli dadi Speranza e Paura
    const dadi = roll.dice;
    // Per costruzione il primo dado è Speranza, il secondo Paura.
    const dSperanza = dadi[0]?.results?.[0]?.result ?? 0;
    const dPaura    = dadi[1]?.results?.[0]?.result ?? 0;
    const critico   = dSperanza === dPaura;
    const conSperanza = dSperanza > dPaura;
    const conPaura    = dPaura > dSperanza;

    const totale  = roll.total;
    let esito = null;
    if (difficolta != null) {
      esito = totale >= difficolta ? "successo" : "fallimento";
    }

    // Aggiornamento Speranza/Paura
    let speranzaGain = 0;
    let paura      = 0;
    let stressHeal = 0;

    if (!reazione) {
      if (critico) {
        speranzaGain = CRIT_HOPE_GAIN;
        stressHeal   = CRIT_STRESS_HEAL;
      } else if (conSperanza) {
        speranzaGain = HOPE_GAIN;
      } else if (conPaura) {
        paura = FEAR_GAIN;
      }
    }

    // Applica Speranza al personaggio
    if (actor && speranzaGain > 0 && actor.type === "character") {
      const sp = actor.system.speranza;
      const nuovo = Math.min(sp.max ?? 6, (sp.value ?? 0) + speranzaGain);
      await actor.update({ "system.speranza.value": nuovo });
    }
    // Cura Stress su critico
    if (actor && stressHeal > 0 && actor.type === "character") {
      const st = actor.system.stress;
      const nuovo = Math.max(0, (st.value ?? 0) - stressHeal);
      await actor.update({ "system.stress.value": nuovo });
    }
    // Paura al GM (tracker globale del mondo)
    if (paura > 0) {
      const hf = getHopeFear();
      await setHopeFear({ paura: (hf.paura ?? 0) + paura });
    }

    // Rendering chat
    const dataChat = {
      label, totale, difficolta, esito,
      critico, conSperanza, conPaura,
      dSperanza, dPaura,
      speranzaGain, paura, stressHeal,
      formula: roll.formula,
      tooltip: await roll.getTooltip(),
      attore: actor?.name ?? "—"
    };
    const renderTpl = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
    const html = await renderTpl(
      "systems/daggerheart-ita/templates/chat/duality-roll.hbs", dataChat
    );

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: html,
      rolls: [roll],
      sound: CONFIG.sounds.dice
    });

    return { roll, ...dataChat };
  }
}
