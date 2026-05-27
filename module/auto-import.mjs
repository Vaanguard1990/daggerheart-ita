// Auto-import: quando un item di tipo class/subclass/ancestry/community
// viene aggiunto a un personaggio (drag&drop dalla sidebar),
// applica le statistiche base e crea le feature collegate.

const FONTI = {
  class:     "Classe",
  subclass:  "Sottoclasse",
  ancestry:  "Discendenza",
  community: "Comunità"
};

const CAMPO_ATTORE = {
  class:     "classe",
  subclass:  "sottoclasse",
  ancestry:  "retaggio",
  community: "comunita"
};

export function registerAutoImport() {

  // Quando un item embedded viene creato su un PG, controlla se è di un tipo
  // gestito e in tal caso applica le derivate.
  Hooks.on("createItem", async (item, options, userId) => {
    if (userId !== game.user.id) return;
    const actor = item.parent;
    if (!actor || actor.documentName !== "Actor" || actor.type !== "character") return;
    const fonteLabel = FONTI[item.type];
    if (!fonteLabel) return;
    try {
      await applyItemToActor(actor, item, fonteLabel);
    } catch (e) {
      console.error("Daggerheart auto-import error:", e);
    }
  });

  // Quando un item "fonte" viene rimosso, rimuovi anche le sue feature derivate.
  Hooks.on("deleteItem", async (item, options, userId) => {
    if (userId !== game.user.id) return;
    const actor = item.parent;
    if (!actor || actor.documentName !== "Actor" || actor.type !== "character") return;
    const fonteLabel = FONTI[item.type];
    if (!fonteLabel) return;
    const fonteTag = `${fonteLabel}:${item.name}`;
    const orfani = actor.items.filter(i => i.type === "feature" && i.system?.fonte === fonteTag);
    if (orfani.length) {
      await actor.deleteEmbeddedDocuments("Item", orfani.map(i => i.id));
    }
  });
}

async function applyItemToActor(actor, item, fonteLabel) {
  const fonteTag = `${fonteLabel}:${item.name}`;
  const sys = item.system ?? {};

  // 1. Se l'attore aveva già un altro item dello stesso tipo, rimuovilo
  const vecchi = actor.items.filter(i => i.type === item.type && i.id !== item.id);
  if (vecchi.length) {
    await actor.deleteEmbeddedDocuments("Item", vecchi.map(i => i.id));
  }

  // 2. Aggiorna il campo descrittivo dell'attore
  const campo = CAMPO_ATTORE[item.type];
  const updates = { [`system.${campo}`]: item.name };

  // 3. Se è una classe, applica anche le statistiche base
  if (item.type === "class") {
    if (Number.isFinite(sys.evasioneBase)) updates["system.evasione.value"] = sys.evasioneBase;
    if (Number.isFinite(sys.pfBase))       updates["system.pf.max"]         = sys.pfBase;
    // Soglie da classe (Moderato = Soglia Maggiore, Grave = Soglia Grave)
    const sd = sys.soglieDanno ?? {};
    if (Number.isFinite(sd.Moderato)) updates["system.soglie.maggiore"] = sd.Moderato;
    if (Number.isFinite(sd.Grave))    updates["system.soglie.grave"]    = sd.Grave;
    updates["system.stress.max"] = 6;
    updates["system.speranza.max"] = 6;
    updates["system.speranza.value"] = 2;
  }

  await actor.update(updates);

  // 4. Costruisci le feature da creare
  const features = [];

  const push = (nome, descrizione, tipo) => {
    if (!nome) return;
    features.push({
      name: nome,
      type: "feature",
      system: { description: descrizione || "", tipoPrivilegio: tipo, fonte: fonteTag }
    });
  };

  if (item.type === "class") {
    if (sys.privilegioSperanza?.nome) {
      push(`[Speranza] ${sys.privilegioSperanza.nome}`, sys.privilegioSperanza.descrizione, "Classe");
    }
    for (const p of (sys.privilegiClasse ?? [])) {
      push(p.nome, p.descrizione, "Classe");
    }
  }
  if (item.type === "subclass") {
    const lv = actor.system.livello?.value ?? 1;
    for (const p of (sys.base ?? [])) {
      push(p.nome, p.descrizione, "Fondamento");
    }
    if (lv >= (sys.livelloSpec ?? 2)) {
      for (const p of (sys.spec ?? [])) {
        push(`[Specializzazione] ${p.nome}`, p.descrizione, "Specializzazione");
      }
    }
    if (lv >= (sys.livelloMaestria ?? 5)) {
      for (const p of (sys.maestria ?? [])) {
        push(`[Maestria] ${p.nome}`, p.descrizione, "Maestria");
      }
    }
  }
  if (item.type === "ancestry") {
    for (const t of (sys.tratti ?? [])) {
      push(t.nome, t.descrizione, "Discendenza");
    }
    // fallback se sono in formato tratto1/tratto2
    if (!sys.tratti?.length) {
      push(sys.tratto1?.nome, sys.tratto1?.descrizione, "Discendenza");
      push(sys.tratto2?.nome, sys.tratto2?.descrizione, "Discendenza");
    }
  }
  if (item.type === "community") {
    push(sys.privilegio?.nome, sys.privilegio?.descrizione, "Comunità");
  }

  if (features.length) {
    await actor.createEmbeddedDocuments("Item", features);
    ui.notifications.info(`${item.name}: importate ${features.length} caratteristiche.`);
  }
}
