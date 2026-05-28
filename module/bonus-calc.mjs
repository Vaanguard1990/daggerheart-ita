// Replica della logica `calcolaBonusStatistiche` dell'app PG.
// Calcola i bonus automatici a Evasione / Soglie / Caselle Armatura
// leggendo gli item embedded (privilegi, carte dominio, armi, armatura)
// e i toggle attivi (system.bonusAttivi).

/**
 * @param {Actor} actor  attore di tipo "character"
 * @returns {{ev:number, mod:number, gra:number, slot:number, voci:Array, toggles:Array}}
 */
export function calcolaBonus(actor) {
  const sys  = actor.system;
  const lv   = sys.livello?.value ?? 1;
  const comp = sys.competenza?.value ?? 1;
  const agi  = sys.tratti?.agilita?.valore ?? 0;
  const ba   = sys.bonusAttivi ?? {};

  // Item embedded utili
  const feats   = actor.items.filter(i => i.type === "feature");
  const carte   = actor.items.filter(i => i.type === "domainCard");
  const armi    = actor.items.filter(i => i.type === "weapon");
  const armEquip = actor.items.find(i => i.type === "armor" && i.system?.equipaggiato);
  const haArmatura = (armEquip?.system?.caselleArmatura ?? 0) > 0;

  // Nomi (normalizzati: senza prefissi [Speranza]/[Specializzazione]/[Maestria])
  const stripTag = n => (n || "").replace(/^\[[^\]]+\]\s*/, "").trim();
  const featNames = feats.map(f => stripTag(f.name));
  const carteNames = carte.map(c => c.name);

  let ev = 0, mod = 0, gra = 0, slot = 0;
  const voci = [];
  const add = (label, dEv = 0, dMod = 0, dGra = 0, dSlot = 0) => {
    ev += dEv; mod += dMod; gra += dGra; slot += dSlot;
    voci.push({ label, dEv, dMod, dGra, dSlot });
  };

  // ── 1. PRIVILEGI (sottoclasse / retaggio) per nome ──────────────────
  const has = nome => featNames.includes(nome);

  if (has("Saldo"))          add("Saldo", 0, 1, 1);
  if (has("Implacabile"))    add("Implacabile", 0, 2, 2);
  if (has("Imperturbabile")) add("Imperturbabile", 0, 3, 3);
  if (has("Ascendente"))     add("Ascendente", 0, 0, 4);
  if (has("Ombra Sfuggente"))add("Ombra Sfuggente", 1, 0, 0);
  if (has("Evoca Scudo") && (sys.speranza?.value ?? 0) >= 2)
    add(`Evoca Scudo (+${comp} Ev, Speranza≥2)`, comp, 0, 0);

  // Tratti di retaggio
  if (has("Guscio"))     add("Guscio", 0, comp, comp);
  if (has("Scioltezza")) add("Scioltezza", 1, 0, 0);

  // ── 2. CARTE DOMINIO PASSIVE ────────────────────────────────────────
  if (carteNames.includes("Intoccabile")) {
    const b = Math.floor(agi / 2);
    if (b > 0) add(`Intoccabile (+${b} Ev)`, b, 0, 0);
  }
  if (carteNames.includes("Armatura Rinforzata") && haArmatura)
    add("Armatura Rinforzata (+2 soglie)", 0, 2, 2);

  // Padronanza della Lama: 4+ carte del dominio "Lama" in dotazione
  if (carteNames.includes("Padronanza Della Lama")) {
    const cnt = carte.filter(c => c.system?.dominio === "Lama").length;
    if (cnt >= 4) add(`Padronanza della Lama (${cnt} Lame, +4 Grave)`, 0, 0, 4);
  }

  // ── 3. FEATURE ARMA (dal campo speciale) ────────────────────────────
  for (const arma of armi) {
    const f = arma.system?.speciale || "";
    if (!f) continue;
    const m = f.match(/Barriera:\s*\+(\d+)\s*Armatura/i);
    if (m) add(`${arma.name}: Barriera (+${m[1]} slot, -1 Ev)`, -1, 0, 0, parseInt(m[1], 10));
    if (/(Pesante|Massiccia):/i.test(f) && /-1\s*Evasione/i.test(f))
      add(`${arma.name}: -1 Ev`, -1, 0, 0);
  }

  // ── 4. FEATURE ARMATURA ─────────────────────────────────────────────
  if (armEquip?.system?.speciale && /\+1\s*Evasione/i.test(armEquip.system.speciale))
    add(`${armEquip.name}: +1 Ev (Flessibile)`, 1, 0, 0);

  // ── 5. TOGGLE MANUALI ───────────────────────────────────────────────
  if (ba.frenesia)          add("Frenesia (+8 Grave, no Armatura)", 0, 0, 8);
  if (ba.incarnazioneTerra) add(`Incarn. Terra (+${comp} soglie)`, 0, comp, comp);
  if (ba.cacciaNotturna)    add("Caccia Notturna (+1 Ev)", 1, 0, 0);
  if (ba.dominioAria)       add("Dominio Aria (+1 Ev)", 1, 0, 0);

  return { ev, mod, gra, slot, voci, toggles: toggleDisponibili(actor) };
}

/**
 * Quali toggle può attivare il personaggio (in base a privilegi/carte posseduti).
 */
export function toggleDisponibili(actor) {
  const feats = actor.items.filter(i => i.type === "feature");
  const carte = actor.items.filter(i => i.type === "domainCard");
  const stripTag = n => (n || "").replace(/^\[[^\]]+\]\s*/, "").trim();
  const names = [...feats.map(f => stripTag(f.name)), ...carte.map(c => c.name)];
  const has = n => names.includes(n);

  const res = [];
  if (has("Frenesia"))
    res.push({ key: "frenesia", label: "Frenesia", note: "+8 Grave, Armatura bloccata" });
  if (has("Incarnazione Elementale"))
    res.push({ key: "incarnazioneTerra", label: "Incarn. Terra", note: "+Comp soglie" });
  if (has("Caccia Notturna"))
    res.push({ key: "cacciaNotturna", label: "Caccia Notturna", note: "+1 Ev" });
  if (has("Dominio Elementale"))
    res.push({ key: "dominioAria", label: "Dom. Aria", note: "+1 Ev" });
  return res;
}
