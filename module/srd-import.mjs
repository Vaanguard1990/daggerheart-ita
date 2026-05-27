// Importatore SRD: crea Items / Actors nelle cartelle del mondo
// a partire dai dati JSON in assets/srd/

const SRD_URL = "systems/daggerheart-ita/assets/srd/all.json";

export async function importSRD({ silent = false } = {}) {
  if (!game.user.isGM) {
    ui.notifications.warn("Solo il GM può importare l'SRD.");
    return;
  }

  const data = await foundry.utils.fetchJsonWithTimeout(SRD_URL).catch(() => null);
  if (!data) {
    ui.notifications.error("Impossibile caricare i dati SRD da " + SRD_URL);
    return;
  }

  if (!silent) {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Importazione SRD Daggerheart (ITA)" },
      content: `<p>Verranno create cartelle e oggetti nel mondo per:</p>
        <ul>
          <li>${Object.keys(data.CLASSI ?? {}).length} Classi</li>
          <li>${Object.keys(data.SOTTOCLASSI ?? {}).length} Sottoclassi</li>
          <li>${Object.keys(data.ORIGINI ?? {}).length} Discendenze</li>
          <li>${Object.keys(data.COMUNITA ?? {}).length} Comunità</li>
          <li>${Object.values(data.CARTE_DOMINI ?? {}).reduce((n, arr) => n + arr.length, 0)} Carte Dominio</li>
          <li>${(data.ARMI ?? []).length} Armi</li>
          <li>${(data.ARMATURE ?? []).length} Armature</li>
          <li>${(data.MOSTRI_MANUALE ?? []).length} Avversari</li>
          <li>${(data.AMBIENTI_MANUALE ?? []).length} Ambienti</li>
        </ul>
        <p>Procedere?</p>`
    });
    if (!ok) return;
  }

  ui.notifications.info("Importazione SRD avviata…");

  // Helper: ottieni/crea cartella
  async function ensureFolder(name, type) {
    let f = game.folders.find(x => x.name === name && x.type === type);
    if (!f) f = await Folder.create({ name, type, color: "#7a3a3a" });
    return f;
  }

  const items = [];
  const actors = [];

  // CLASSI
  const fClassi = await ensureFolder("Classi", "Item");
  for (const [nome, c] of Object.entries(data.CLASSI ?? {})) {
    items.push({
      name: nome, type: "class", folder: fClassi.id,
      system: {
        description: c.descrizione || "",
        domini: c.domini || [],
        evasioneBase: c.evasione ?? 10,
        pfBase: c.pf ?? 6,
        stressBase: c.stress ?? 6,
        speranzaBase: c.speranza ?? 2,
        esperienzaIniziale: c.esperienzaIniziale ?? "",
        equipaggiamentoIniziale: c.equipaggiamento ?? "",
        privilegioClasse: c.privilegio ?? { nome: "", descrizione: "" },
        movimentoSpe: c.movimento ?? { nome: "", descrizione: "" }
      }
    });
  }

  // SOTTOCLASSI
  const fSotto = await ensureFolder("Sottoclassi", "Item");
  for (const [nome, s] of Object.entries(data.SOTTOCLASSI ?? {})) {
    items.push({
      name: nome, type: "subclass", folder: fSotto.id,
      system: {
        description: s.descrizione ?? "",
        classe: s.classe ?? "",
        spellcast: s.spellcast ?? "",
        fondamento: s.fondamento ?? { nome: "", descrizione: "" },
        specializzazione: s.specializzazione ?? { nome: "", descrizione: "" },
        maestria: s.maestria ?? { nome: "", descrizione: "" }
      }
    });
  }

  // ORIGINI -> ancestry
  const fAnc = await ensureFolder("Discendenze", "Item");
  for (const [nome, o] of Object.entries(data.ORIGINI ?? {})) {
    items.push({
      name: nome, type: "ancestry", folder: fAnc.id,
      system: {
        description: o.descrizione ?? "",
        tratto1: o.tratti?.[0] ?? { nome: "", descrizione: "" },
        tratto2: o.tratti?.[1] ?? { nome: "", descrizione: "" }
      }
    });
  }

  // COMUNITA
  const fCom = await ensureFolder("Comunità", "Item");
  for (const [nome, c] of Object.entries(data.COMUNITA ?? {})) {
    items.push({
      name: nome, type: "community", folder: fCom.id,
      system: {
        description: c.descrizione ?? "",
        privilegio: c.privilegio ?? { nome: "", descrizione: c.descrizione ?? "" }
      }
    });
  }

  // CARTE_DOMINI
  const fDom = await ensureFolder("Carte Dominio", "Item");
  for (const [dominio, carte] of Object.entries(data.CARTE_DOMINI ?? {})) {
    const fSub = await ensureFolder(`Dominio: ${dominio}`, "Item");
    fSub.update({ folder: fDom.id }).catch(() => {});
    for (const c of carte) {
      items.push({
        name: c.n ?? c.nome ?? "Carta", type: "domainCard", folder: fSub.id,
        system: {
          description: c.d ?? c.descrizione ?? "",
          dominio: dominio,
          livello: c.lv ?? c.livello ?? 1,
          tipo: c.t ?? c.tipo ?? "Privilegio",
          ricarica: c.ric ?? c.ricarica ?? ""
        }
      });
    }
  }

  // ARMI
  const fArm = await ensureFolder("Armi", "Item");
  for (const a of (data.ARMI ?? [])) {
    // formato atteso: { nome, categoria, tratto, portata, danno: "1d8 fis", tier, ... }
    const dannoMatch = /(\d+)d(\d+)(?:([+-]\d+))?\s*(fis|mag)?/.exec(a.danno || "");
    items.push({
      name: a.nome ?? "Arma", type: "weapon", folder: fArm.id,
      system: {
        description: a.descrizione ?? "",
        categoria: a.categoria ?? "Primaria",
        tratto: a.tratto ?? "Agilità",
        portata: a.portata ?? "Mischia",
        danno: {
          numDadi: dannoMatch ? parseInt(dannoMatch[1], 10) : 1,
          dado: dannoMatch ? `d${dannoMatch[2]}` : "d6",
          bonus: dannoMatch && dannoMatch[3] ? parseInt(dannoMatch[3], 10) : 0,
          tipoDanno: dannoMatch && dannoMatch[4] === "mag" ? "magico" : "fisico"
        },
        speciale: a.speciale ?? "",
        tier: a.tier ?? 1,
        magica: !!a.magica,
        dueMani: !!a.dueMani
      }
    });
  }

  // ARMATURE
  const fArmo = await ensureFolder("Armature", "Item");
  for (const a of (data.ARMATURE ?? [])) {
    items.push({
      name: a.nome ?? a.n ?? "Armatura", type: "armor", folder: fArmo.id,
      system: {
        description: a.descrizione ?? "",
        sogliaMaggiore: a.mj ?? a.sogliaMaggiore ?? 0,
        sogliaGrave: a.sv ?? a.sogliaGrave ?? 0,
        caselleArmatura: a.sc ?? a.caselleArmatura ?? 0,
        speciale: a.f ?? a.speciale ?? "",
        tier: a.tier ?? 1
      }
    });
  }

  if (items.length) {
    ui.notifications.info(`Creazione di ${items.length} oggetti…`);
    await Item.createDocuments(items, { keepId: false });
  }

  // AVVERSARI
  const fAvv = await ensureFolder("Avversari", "Actor");
  for (const m of (data.MOSTRI_MANUALE ?? [])) {
    const features = (m.caratteristiche ?? []).map(c => ({
      name: c.nome || "Caratteristica", type: "feature",
      system: { description: c.descrizione || "", tipoPrivilegio: c.tipo || "Passiva" }
    }));
    // Estrai bonus attacco numerico
    const bonusAtk = parseInt(String(m.attacco?.bonus ?? "0").replace("+", ""), 10) || 0;
    actors.push({
      name: m.nome || "Avversario", type: "adversary", folder: fAvv.id,
      system: {
        description: m.descrizione || "",
        tipo: m.tipo || "Avversario Base",
        rango: m.rango || 1,
        difficolta: m.difficolta || 10,
        soglie: { maggiore: m.soglie?.maggiore || 0, grave: m.soglie?.grave || 0 },
        pf: { value: 0, max: m.pf || 1 },
        stress: { value: 0, max: m.stress || 1 },
        motivazioni: m.motivazioni || "",
        esperienze: m.esperienza || "",
        attacco: {
          nome: m.attacco?.nome || "",
          bonus: bonusAtk,
          portata: m.attacco?.portata || "",
          danno: m.attacco?.danno || ""
        }
      },
      items: features
    });
  }

  // AMBIENTI
  const fAmb = await ensureFolder("Ambienti", "Actor");
  for (const e of (data.AMBIENTI_MANUALE ?? [])) {
    const features = (e.caratteristiche ?? []).map(c => ({
      name: c.nome || "Caratteristica", type: "feature",
      system: { description: c.descrizione || "", tipoPrivilegio: c.tipo || "Passiva" }
    }));
    actors.push({
      name: e.nome || "Ambiente", type: "environment", folder: fAmb.id,
      system: {
        description: e.descrizione || "",
        tipo: e.tipo || "Esplorazione",
        rango: e.rango || 1,
        difficolta: e.difficolta || 10,
        impeti: e.impeti || "",
        potenzialiAvversari: e.potenzialiAvversari || ""
      },
      items: features
    });
  }

  if (actors.length) {
    ui.notifications.info(`Creazione di ${actors.length} attori…`);
    await Actor.createDocuments(actors, { keepId: false });
  }

  ui.notifications.info(`Importazione SRD completata: ${items.length} items, ${actors.length} attori.`);
}
