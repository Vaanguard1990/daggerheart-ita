// Applica i dati SRD all'attore in modo automatico (scheda data-driven).
// Sostituisce il flusso drag&drop: i selettori in-scheda chiamano queste funzioni.

import * as SRD from "./srd-data.mjs";

// Rimuove le feature embedded provenienti da una certa fonte
async function pulisciFonte(actor, fonteTag) {
  const orfani = actor.items.filter(i => i.type === "feature" && i.system?.fonte === fonteTag);
  if (orfani.length) await actor.deleteEmbeddedDocuments("Item", orfani.map(i => i.id));
}

async function creaFeatures(actor, lista, fonteTag) {
  if (!lista.length) return;
  await actor.createEmbeddedDocuments("Item", lista.map(f => ({
    name: f.nome,
    type: "feature",
    system: { description: f.descrizione || "", tipoPrivilegio: f.tipo || "Generico", fonte: fonteTag }
  })));
}

// === CLASSE ===
export async function applicaClasse(actor, nome) {
  const fonteTag = `Classe:${nome}`;
  const c = await SRD.getClasse(nome);

  // pulisci eventuali feature da una classe precedente
  const vecchie = actor.items.filter(i => i.type === "feature" && /^Classe:/.test(i.system?.fonte || ""));
  if (vecchie.length) await actor.deleteEmbeddedDocuments("Item", vecchie.map(i => i.id));

  if (!nome || !c) {
    await actor.update({ "system.classe": nome || "" });
    return;
  }

  const updates = { "system.classe": nome };
  if (Number.isFinite(c.evasioneIniziale ?? c.evasione)) updates["system.evasione.value"] = c.evasioneIniziale ?? c.evasione;
  if (Number.isFinite(c.pfIniziali ?? c.pf))             updates["system.pf.max"]         = c.pfIniziali ?? c.pf;
  const sd = c.soglieDanno ?? {};
  if (Number.isFinite(sd.Moderato)) updates["system.soglie.maggiore"] = sd.Moderato;
  if (Number.isFinite(sd.Grave))    updates["system.soglie.grave"]    = sd.Grave;
  updates["system.stress.max"] = 6;
  updates["system.speranza.max"] = 6;
  if (!(actor.system.speranza?.value > 0)) updates["system.speranza.value"] = 2;
  // domini della classe → salvati per filtrare le carte
  updates["system.dominiClasse"] = c.domini ?? [];
  await actor.update(updates);

  const feats = [];
  if (c.privilegioSperanza?.nome)
    feats.push({ nome: `[Speranza] ${c.privilegioSperanza.nome}`, descrizione: c.privilegioSperanza.descrizione, tipo: "Classe" });
  for (const p of (c.privilegiClasse ?? []))
    feats.push({ nome: p.nome, descrizione: p.descrizione, tipo: "Classe" });
  await creaFeatures(actor, feats, fonteTag);

  ui.notifications.info(`Classe ${nome} applicata.`);
}

// === SOTTOCLASSE ===
export async function applicaSottoclasse(actor, nome) {
  const fonteTag = `Sottoclasse:${nome}`;
  const vecchie = actor.items.filter(i => i.type === "feature" && /^Sottoclasse:/.test(i.system?.fonte || ""));
  if (vecchie.length) await actor.deleteEmbeddedDocuments("Item", vecchie.map(i => i.id));

  const sc = await SRD.getSottoclasse(nome);
  await actor.update({ "system.sottoclasse": nome || "" });
  if (!nome || !sc) return;

  const lv = actor.system.livello?.value ?? 1;
  const feats = [];
  for (const p of (sc.base ?? []))
    feats.push({ nome: p.nome, descrizione: p.descrizione, tipo: "Fondamento" });
  if (lv >= (sc.livelloSpec ?? 2))
    for (const p of (sc.spec ?? []))
      feats.push({ nome: `[Specializzazione] ${p.nome}`, descrizione: p.descrizione, tipo: "Specializzazione" });
  if (lv >= (sc.livelloMaestria ?? 5))
    for (const p of (sc.maestria ?? []))
      feats.push({ nome: `[Maestria] ${p.nome}`, descrizione: p.descrizione, tipo: "Maestria" });
  await creaFeatures(actor, feats, fonteTag);

  ui.notifications.info(`Sottoclasse ${nome} applicata.`);
}

// === DISCENDENZA ===
export async function applicaDiscendenza(actor, nome) {
  const fonteTag = `Discendenza:${nome}`;
  const vecchie = actor.items.filter(i => i.type === "feature" && /^Discendenza:/.test(i.system?.fonte || ""));
  if (vecchie.length) await actor.deleteEmbeddedDocuments("Item", vecchie.map(i => i.id));

  const o = await SRD.getDiscendenza(nome);
  await actor.update({ "system.retaggio": nome || "" });
  if (!nome || !o) return;

  const feats = (o.tratti ?? []).map(t => ({ nome: t.nome, descrizione: t.descrizione, tipo: "Discendenza" }));
  await creaFeatures(actor, feats, fonteTag);

  ui.notifications.info(`Discendenza ${nome} applicata.`);
}

// === COMUNITÀ ===
export async function applicaComunita(actor, nome) {
  const fonteTag = `Comunità:${nome}`;
  const vecchie = actor.items.filter(i => i.type === "feature" && /^Comunità:/.test(i.system?.fonte || ""));
  if (vecchie.length) await actor.deleteEmbeddedDocuments("Item", vecchie.map(i => i.id));

  const c = await SRD.getComunitaItem(nome);
  await actor.update({ "system.comunita": nome || "" });
  if (!nome || !c) return;

  const t = c.tratto ?? c.privilegio;
  if (t?.nome) await creaFeatures(actor, [{ nome: t.nome, descrizione: t.descrizione, tipo: "Comunità" }], fonteTag);

  ui.notifications.info(`Comunità ${nome} applicata.`);
}

// === CARTA DOMINIO ===
export async function aggiungiCarta(actor, dominio, nomeCarta) {
  const carte = await SRD.getCarteDisponibili([dominio], 10);
  const c = carte.find(x => x.nome === nomeCarta);
  if (!c) return;
  await actor.createEmbeddedDocuments("Item", [{
    name: c.nome, type: "domainCard",
    system: { description: c.descrizione, dominio: c.dominio, livello: c.livello, costo: c.costo, tipo: "Privilegio" }
  }]);
  ui.notifications.info(`Carta "${c.nome}" aggiunta.`);
}

// === EQUIPAGGIAMENTO ===
export async function aggiungiArma(actor, nome) {
  const armi = await SRD.getArmi();
  const a = armi.find(x => x.nome === nome);
  if (!a) return;
  const dadoMatch = /d(\d+)/.exec(a.dado || "d6");
  await actor.createEmbeddedDocuments("Item", [{
    name: a.nome, type: "weapon",
    system: {
      categoria: a.categoria, tratto: a.tratto, portata: a.portata,
      danno: { numDadi: 1, dado: a.dado, bonus: a.bonus, tipoDanno: a.tipoDanno },
      speciale: a.speciale, tier: a.tier, magica: a.magica, dueMani: a.dueMani
    }
  }]);
  ui.notifications.info(`Arma "${a.nome}" aggiunta.`);
}

export async function aggiungiArmatura(actor, nome) {
  const armature = await SRD.getArmature();
  const a = armature.find(x => x.nome === nome);
  if (!a) return;
  await actor.createEmbeddedDocuments("Item", [{
    name: a.nome, type: "armor",
    system: {
      sogliaMaggiore: a.sogliaMaggiore, sogliaGrave: a.sogliaGrave,
      caselleArmatura: a.caselleArmatura, speciale: a.speciale, tier: a.tier
    }
  }]);
  ui.notifications.info(`Armatura "${a.nome}" aggiunta.`);
}
