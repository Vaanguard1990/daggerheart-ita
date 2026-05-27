// Tracker mondo per Paura del GM (e Speranza del gruppo, opzionale).
// Persistito come world setting.

const NS = "daggerheart-ita";
const KEY = "hopeFear";

export function registerHopeFearSettings() {
  game.settings.register(NS, KEY, {
    name: "Speranza & Paura (tracker mondo)",
    scope: "world",
    config: false,
    type: Object,
    default: { paura: 0, speranzaGruppo: 0 }
  });

  game.settings.register(NS, "pauraMax", {
    name: "Limite massimo Paura",
    hint: "0 = nessun limite. Default Daggerheart: 12.",
    scope: "world",
    config: true,
    type: Number,
    default: 12
  });

  game.settings.register(NS, "automatizzaOroDanno", {
    name: "Automatizza danno e Caselle Armatura",
    hint: "Se attivo, il sistema applica automaticamente PF / Caselle Armatura ricevendo il danno via chat-card.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
}

export function getHopeFear() {
  return game.settings.get(NS, KEY) ?? { paura: 0, speranzaGruppo: 0 };
}

export async function setHopeFear(partial) {
  const cur = getHopeFear();
  const next = foundry.utils.mergeObject(cur, partial, { inplace: false });
  // Clamp Paura
  const max = game.settings.get(NS, "pauraMax") ?? 12;
  if (max > 0) next.paura = Math.min(max, Math.max(0, next.paura));
  else next.paura = Math.max(0, next.paura);
  next.speranzaGruppo = Math.max(0, next.speranzaGruppo ?? 0);
  await game.settings.set(NS, KEY, next);
  Hooks.callAll("daggerheart.hopeFearChanged", next);
  return next;
}
