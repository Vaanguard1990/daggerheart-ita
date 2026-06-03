// Gestione Countdown ("conti alla rovescia" / orologi) a livello di mondo.
// Persistito come world setting. I Countdown possono essere:
//  - "regressivo": parte da max e cala verso 0 (scatta a 0)
//  - "progressivo": parte da 0 e cresce verso max (scatta a max)
// Tipo di avanzamento (solo descrittivo): "standard" | "dinamico" | "evento".

const NS = "daggerheart-ita";
const KEY = "countdowns";

export function registerCountdownSettings() {
  game.settings.register(NS, KEY, {
    name: "Countdown (tracker mondo)",
    scope: "world",
    config: false,
    type: Array,
    default: []
  });
}

export function getCountdowns() {
  return foundry.utils.deepClone(game.settings.get(NS, KEY) ?? []);
}

async function _save(list) {
  await game.settings.set(NS, KEY, list);
  Hooks.callAll("daggerheart.countdownsChanged", list);
  return list;
}

/** Crea un nuovo countdown e ritorna la lista aggiornata. */
export async function addCountdown({ nome = "Nuovo Countdown", max = 4, tipo = "regressivo", avanzamento = "standard" } = {}) {
  const list = getCountdowns();
  const valore = tipo === "progressivo" ? 0 : max;
  list.push({
    id: foundry.utils.randomID(),
    nome, max: Math.max(1, max), tipo, avanzamento, valore
  });
  return _save(list);
}

export async function removeCountdown(id) {
  const list = getCountdowns().filter(c => c.id !== id);
  return _save(list);
}

export async function updateCountdown(id, patch) {
  const list = getCountdowns();
  const cd = list.find(c => c.id === id);
  if (!cd) return list;
  Object.assign(cd, patch);
  cd.max = Math.max(1, cd.max ?? 1);
  cd.valore = Math.min(cd.max, Math.max(0, cd.valore ?? 0));
  return _save(list);
}

/** Avanza un countdown di delta (rispettando il tipo). Ritorna true se è "scattato". */
export async function stepCountdown(id, delta = 1) {
  const list = getCountdowns();
  const cd = list.find(c => c.id === id);
  if (!cd) return { list, scattato: false };
  // delta positivo = "avanza" nel verso naturale del countdown
  const verso = cd.tipo === "progressivo" ? 1 : -1;
  cd.valore = Math.min(cd.max, Math.max(0, (cd.valore ?? 0) + delta * verso));
  const soglia = cd.tipo === "progressivo" ? cd.max : 0;
  const scattato = cd.valore === soglia;
  await _save(list);
  return { list, scattato, cd };
}

export async function resetCountdown(id) {
  const list = getCountdowns();
  const cd = list.find(c => c.id === id);
  if (!cd) return list;
  cd.valore = cd.tipo === "progressivo" ? 0 : cd.max;
  return _save(list);
}
