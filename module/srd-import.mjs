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
        evasioneBase: c.evasioneIniziale ?? c.evasione ?? 10,
        pfBase: c.pfIniziali ?? c.pf ?? 6,
        soglieDanno: c.soglieDanno ?? { Minore: 6, Moderato: 12, Grave: 19, Critico: 27 },
        oggettiClasse: c.oggettiClasse ?? "",
        privilegioSperanza: c.privilegioSperanza ?? { nome: "", descrizione: "" },
        privilegiClasse: Array.isArray(c.privilegiClasse) ? c.privilegiClasse : [],
        sottoclassiNomi: c.sottoclassi ?? []
      }
    });
  }

  // SOTTOCLASSI
  const fSotto = await ensureFolder("Sottoclassi", "Item");
  for (const [nome, sc] of Object.entries(data.SOTTOCLASSI ?? {})) {
    items.push({
      name: nome, type: "subclass", folder: fSotto.id,
      system: {
        description: sc.descrizione ?? "",
        classe: sc.classe ?? "",
        tratto: sc.tratto ?? "",
        base:     Array.isArray(sc.base)     ? sc.base     : [],
        spec:     Array.isArray(sc.spec)     ? sc.spec     : [],
        maestria: Array.isArray(sc.maestria) ? sc.maestria : [],
        livelloSpec:     sc.livelloSpec ?? 2,
        livelloMaestria: sc.livelloMaestria ?? 5
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
        tratti: Array.isArray(o.tratti) ? o.tratti : [],
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
        privilegio: c.tratto ?? c.privilegio ?? { nome: "", descrizione: "" }
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
          livello: c.l ?? c.lv ?? c.livello ?? 1,
          costo: c.c ?? null,
          tipo: c.t ?? c.tipo ?? "Privilegio",
          ricarica: c.ric ?? c.ricarica ?? ""
        }
      });
    }
  }

  // ARMI — suddivise per Tier
  // Schema SRD: { t=tier, c='P'/'S', n=nome, p=portata, r=tratto, d=dado, b=bonus, m=magica, h=mani, f=speciale }
  const fArm = await ensureFolder("Armi", "Item");
  const fArmiTier = {};
  const nomeTierArma = { 1: "Tier 1", 2: "Tier 2", 3: "Tier 3", 4: "Tier 4" };
  for (const [t, label] of Object.entries(nomeTierArma)) {
    const sub = await ensureFolder(`Armi – ${label}`, "Item");
    await sub.update({ folder: fArm.id }).catch(() => {});
    fArmiTier[t] = sub;
  }

  for (const a of (data.ARMI ?? [])) {
    const tier = a.t ?? a.tier ?? 1;
    const folderId = (fArmiTier[tier] ?? fArm).id;
    const dadoMatch = /d(\d+)/.exec(a.d ?? "d6");
    const categoria = (a.c === "S") ? "Secondaria" : "Primaria";
    items.push({
      name: a.n ?? a.nome ?? "Arma senza nome", type: "weapon", folder: folderId,
      system: {
        description: a.f ?? a.speciale ?? "",
        categoria,
        tratto: a.r ?? a.tratto ?? "Agilità",
        portata: a.p ?? a.portata ?? "Mischia",
        danno: {
          numDadi: 1,
          dado: dadoMatch ? `d${dadoMatch[1]}` : "d6",
          bonus: a.b ?? 0,
          tipoDanno: (a.m || a.magica) ? "magico" : "fisico"
        },
        speciale: a.f ?? a.speciale ?? "",
        tier,
        magica: !!(a.m ?? a.magica),
        dueMani: (a.h === "2" || a.h === 2 || a.dueMani === true)
      }
    });
  }

  // ARMATURE — suddivise per Tier
  // Schema SRD: { t=tier, n=nome, mj=sogliaMaggiore, sv=sogliaGrave, sc=caselleArmatura, f=speciale }
  const fArmo = await ensureFolder("Armature", "Item");
  const fArmatureTier = {};
  const nomeTierArmatura = { 1: "Tier 1", 2: "Tier 2", 3: "Tier 3", 4: "Tier 4" };
  for (const [t, label] of Object.entries(nomeTierArmatura)) {
    const sub = await ensureFolder(`Armature – ${label}`, "Item");
    await sub.update({ folder: fArmo.id }).catch(() => {});
    fArmatureTier[t] = sub;
  }

  for (const a of (data.ARMATURE ?? [])) {
    const tier = a.t ?? a.tier ?? 1;
    const folderId = (fArmatureTier[tier] ?? fArmo).id;
    items.push({
      name: a.n ?? a.nome ?? "Armatura senza nome", type: "armor", folder: folderId,
      system: {
        description: a.f ?? a.speciale ?? "",
        sogliaMaggiore: a.mj ?? a.sogliaMaggiore ?? 0,
        sogliaGrave: a.sv ?? a.sogliaGrave ?? 0,
        caselleArmatura: a.sc ?? a.caselleArmatura ?? 0,
        speciale: a.f ?? a.speciale ?? "",
        tier
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
        potenzialiAvversari: e.avversariPotenziali ?? e.potenzialiAvversari ?? ""
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
