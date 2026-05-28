// Loader + cache dei dati SRD (all.json) per la scheda data-driven.
// Permette ai selettori in-scheda di pescare classi/sottoclassi/carte/equip
// senza dover importare nulla nel mondo.

let _cache = null;

export async function loadSRD() {
  if (_cache) return _cache;
  const url = "systems/daggerheart-ita/assets/srd/all.json";
  try {
    _cache = await foundry.utils.fetchJsonWithTimeout(url);
  } catch (e) {
    console.error("Daggerheart | impossibile caricare all.json:", e);
    _cache = {};
  }
  return _cache;
}

export async function getClassi() {
  const d = await loadSRD();
  return Object.keys(d.CLASSI ?? {}).sort();
}

export async function getClasse(nome) {
  const d = await loadSRD();
  return d.CLASSI?.[nome] ?? null;
}

export async function getSottoclassiPerClasse(classe) {
  const d = await loadSRD();
  const out = [];
  for (const [nome, sc] of Object.entries(d.SOTTOCLASSI ?? {})) {
    if (!classe || sc.classe === classe) out.push(nome);
  }
  return out.sort();
}

export async function getSottoclasse(nome) {
  const d = await loadSRD();
  return d.SOTTOCLASSI?.[nome] ?? null;
}

export async function getDiscendenze() {
  const d = await loadSRD();
  return Object.keys(d.ORIGINI ?? {}).sort();
}
export async function getDiscendenza(nome) {
  const d = await loadSRD();
  return d.ORIGINI?.[nome] ?? null;
}

export async function getComunita() {
  const d = await loadSRD();
  return Object.keys(d.COMUNITA ?? {}).sort();
}
export async function getComunitaItem(nome) {
  const d = await loadSRD();
  return d.COMUNITA?.[nome] ?? null;
}

// Carte dominio disponibili: per i dominî dati e livello <= lv
export async function getCarteDisponibili(domini = [], lv = 10) {
  const d = await loadSRD();
  const out = [];
  for (const dom of domini) {
    const carte = d.CARTE_DOMINI?.[dom] ?? [];
    for (const c of carte) {
      const liv = c.l ?? c.lv ?? c.livello ?? 1;
      if (liv <= lv) {
        out.push({
          dominio: dom,
          nome: c.n ?? c.nome ?? "Carta",
          livello: liv,
          costo: c.c ?? null,
          descrizione: c.d ?? c.descrizione ?? ""
        });
      }
    }
  }
  return out.sort((a, b) => a.livello - b.livello || a.nome.localeCompare(b.nome));
}

// Equipaggiamento
export async function getArmi() {
  const d = await loadSRD();
  return (d.ARMI ?? []).map(normalizzaArma);
}
export async function getArmature() {
  const d = await loadSRD();
  return (d.ARMATURE ?? []).map(normalizzaArmatura);
}

export function normalizzaArma(a) {
  // Schema jsx arma: { t (tier), c (categoria S/P), n (nome), p (portata), r (tratto), d (dado), b (bonus), m (magica), h (mani), f (feature) }
  const dadoMatch = /d(\d+)/.exec(a.d || "d6");
  return {
    nome: a.n ?? a.nome ?? "Arma",
    tier: a.t ?? a.tier ?? 1,
    categoria: (a.c === "S" || a.categoria === "Secondaria") ? "Secondaria" : "Primaria",
    portata: a.p ?? a.portata ?? "Mischia",
    tratto: a.r ?? a.tratto ?? "Agilità",
    dado: a.d ?? "d6",
    bonus: a.b ?? 0,
    magica: !!a.m,
    dueMani: (a.h === "2" || a.dueMani === true),
    speciale: a.f ?? a.speciale ?? "",
    tipoDanno: /mag/i.test(a.dmg || a.tipo || "") ? "magico" : "fisico"
  };
}

export function normalizzaArmatura(a) {
  // Schema jsx armatura: { t (tier), n (nome), mj (soglia magg), sv (soglia grave), sc (caselle), f (feature) }
  return {
    nome: a.n ?? a.nome ?? "Armatura",
    tier: a.t ?? a.tier ?? 1,
    sogliaMaggiore: a.mj ?? a.sogliaMaggiore ?? 0,
    sogliaGrave: a.sv ?? a.sogliaGrave ?? 0,
    caselleArmatura: a.sc ?? a.caselleArmatura ?? 0,
    speciale: a.f ?? a.speciale ?? ""
  };
}
