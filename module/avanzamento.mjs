// avanzamento.mjs — Level-up automatico Daggerheart ITA
// Regole: 2 caselle per livello (AVANZAMENTI_RANGO per rango corrente).
// Opzioni "doppia" costano 2 caselle e vanno prese da sole.
// Tratti: +1 a 2 tratti non marcati; si marcano fino al reset (Lv5, Lv8).
// Esperienze: +1 bonus a 2 esperienze esistenti.
// Carta dominio: aggiungi una carta SRD disponibile nei tuoi domini.
// Sottoclasse: prendi Specializzazione (Rango 3) o Maestria (Rango 4).
// Multiclasse: scegli classe, dominio e ottieni i privilegi base.

const { DialogV2 } = foundry.applications.api;

const RANGO_DA_LIVELLO = lv => lv <= 1 ? 1 : lv <= 4 ? 2 : lv <= 7 ? 3 : 4;
const RESET_TRATTI     = new Set([5, 8]);
const NOMI_TRATTI      = {
  agilita: "Agilità", forza: "Forza", astuzia: "Astuzia",
  istinto: "Istinto", presenza: "Presenza", conoscenza: "Conoscenza"
};

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function apriAvanzamento(actor) {
  if (actor.type !== "character") return;
  const lv = actor.system.livello?.value ?? 1;
  if (lv >= 10) {
    ui.notifications.info(`${actor.name} è già al livello massimo (10).`);
    return;
  }

  const nuovoLv = lv + 1;
  const rango   = RANGO_DA_LIVELLO(nuovoLv);

  let srd;
  try {
    srd = await foundry.utils.fetchJsonWithTimeout("systems/daggerheart-ita/assets/srd/all.json");
  } catch {
    ui.notifications.error("Impossibile caricare i dati SRD.");
    return;
  }

  const tutteOpzioni = (srd.AVANZAMENTI_RANGO ?? {})[String(rango)] ?? [];
  if (!tutteOpzioni.length) {
    ui.notifications.info("Nessuna opzione di avanzamento definita per questo rango.");
    return;
  }

  // Filtra opzioni non applicabili in base allo stato dell'attore
  const trattiMarcati     = actor.system.trattiMarcati ?? [];
  const trattiDisponibili = Object.keys(NOMI_TRATTI).filter(k => !trattiMarcati.includes(k));
  const esperienze        = actor.items.filter(i => i.type === "experience");
  const opzioni = tutteOpzioni.filter(o => {
    if (o.id === "tratti"      && trattiDisponibili.length < 2) return false;
    if (o.id === "esperienze"  && esperienze.length < 2)        return false;
    if (o.id === "sottoclasse" && !actor.system.sottoclasse)    return false;
    return true;
  });

  // ── Dialog principale (selezione caselle) ──
  const indici = await _dialogPrincipale(lv, nuovoLv, rango, opzioni);
  if (!indici) return;

  // ── Raccogli dati per opzioni complesse tramite sub-dialog ──
  const updates   = { "system.livello.value": nuovoLv };
  const nuoviItem = [];
  const logMsg    = [];

  // Reset marchi tratti ai livelli "reset" (Lv5, Lv8)
  if (RESET_TRATTI.has(nuovoLv)) {
    updates["system.trattiMarcati"] = [];
    logMsg.push("Marchi tratti azzerati (inizio nuovo rango)");
  }

  for (const idx of indici) {
    const o = opzioni[idx];
    if (!o) continue;

    switch (o.id) {

      case "pf": {
        const nuovo = (actor.system.pf?.max ?? 6) + 1;
        updates["system.pf.max"] = nuovo;
        logMsg.push(`+1 Punto Ferita (max ${nuovo})`);
        break;
      }

      case "stress": {
        const nuovo = (actor.system.stress?.max ?? 6) + 1;
        updates["system.stress.max"] = nuovo;
        logMsg.push(`+1 Stress (max ${nuovo})`);
        break;
      }

      case "evasione": {
        const nuovo = (actor.system.evasione?.value ?? 10) + 1;
        updates["system.evasione.value"] = nuovo;
        logMsg.push(`+1 Evasione (base ${nuovo})`);
        break;
      }

      case "competenza": {
        const nuovo = (actor.system.competenza?.value ?? 1) + 1;
        updates["system.competenza.value"] = nuovo;
        logMsg.push(`Competenza +1 (ora ${nuovo})`);
        break;
      }

      case "tratti": {
        const r = await _dialogTratti(actor, trattiDisponibili);
        if (r === null) return;
        for (const key of r) {
          updates[`system.tratti.${key}.valore`] =
            (actor.system.tratti?.[key]?.valore ?? 0) + 1;
        }
        const nuoviMarcati = [...new Set([...trattiMarcati, ...r])];
        updates["system.trattiMarcati"] = nuoviMarcati;
        logMsg.push(`+1 tratti: ${r.map(k => NOMI_TRATTI[k]).join(", ")}`);
        break;
      }

      case "esperienze": {
        const r = await _dialogEsperienze(actor);
        if (r === null) return;
        for (const { id, nuovoBonus } of r) {
          const item = actor.items.get(id);
          if (item) await item.update({ "system.bonus": nuovoBonus });
        }
        logMsg.push(`+1 esperienze: ${r.map(x => x.nome).join(", ")}`);
        break;
      }

      case "carta": {
        const maxLvCarta = rango === 2 ? 4 : rango === 3 ? 7 : 10;
        const r = await _dialogCarta(actor, nuovoLv, maxLvCarta, srd);
        if (r === null) return;
        nuoviItem.push({
          name: r.nome, type: "domainCard",
          system: {
            description: r.descrizione ?? "",
            dominio: r.dominio, livello: r.livello,
            costoSperanza: r.costo ?? 0,
            tipo: r.tipo ?? "Privilegio",
            ricarica: r.ricarica ?? ""
          }
        });
        logMsg.push(`Carta: [${r.dominio}] ${r.nome} (Lv${r.livello})`);
        break;
      }

      case "sottoclasse": {
        const r = await _dialogSottoclasse(actor, rango, srd);
        if (r === null) return;
        nuoviItem.push(...r.items);
        logMsg.push(r.label);
        break;
      }

      case "multiclasse": {
        const r = await _dialogMulticlasse(actor, srd);
        if (r === null) return;
        updates["system.dominiClasse"] = [
          ...(actor.system.dominiClasse ?? []),
          r.dominio
        ];
        nuoviItem.push(...r.items);
        logMsg.push(`Multiclasse: ${r.classe} · Dominio ${r.dominio}`);
        break;
      }
    }
  }

  // Applica tutto all'attore
  await actor.update(updates);
  if (nuoviItem.length) await actor.createEmbeddedDocuments("Item", nuoviItem);

  // Messaggio in chat
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="dh-adv-chat">
      <strong>${actor.name}</strong> sale al <strong>Livello ${nuovoLv}</strong> (Rango ${rango}):
      <ul>${logMsg.map(m => `<li>${m}</li>`).join("")}</ul>
    </div>`
  });

  ui.notifications.info(`${actor.name} è ora al Livello ${nuovoLv}!`);
}

// ─── Dialog principale ────────────────────────────────────────────────────────

async function _dialogPrincipale(lv, nuovoLv, rango, opzioni) {
  const righe = opzioni.map((o, idx) => `
    <label class="dh-adv-opt${o.doppia ? " doppia" : ""}">
      <input type="checkbox" name="adv" value="${idx}"
             data-caselle="${o.caselle}"${o.doppia ? ' data-doppia="1"' : ""}/>
      <span class="dh-adv-opt-body">
        <span class="dh-adv-opt-head">
          <strong>${o.label}</strong>
          <em class="dh-adv-cost">${
            o.caselle === 1 ? "1 casella"
            : o.doppia      ? "2 caselle (doppia)"
            :                 "2 caselle"
          }</em>
        </span>
        <span class="dh-adv-desc">${o.desc}</span>
      </span>
    </label>`
  ).join("");

  const content = `
    <div class="dh-adv-dialog">
      <p class="dh-adv-livello-info">
        Livello <strong>${lv}</strong> → <strong>${nuovoLv}</strong>
        &nbsp;·&nbsp; Rango <strong>${rango}</strong>
        &nbsp;|&nbsp; Caselle rimaste: <strong class="dh-cas-counter">2</strong> / 2
      </p>
      <div class="dh-adv-list">${righe}</div>
    </div>`;

  return DialogV2.wait({
    window:      { title: `Avanzamento — Livello ${nuovoLv}` },
    position:    { width: 580 },
    content,
    rejectClose: false,
    buttons: [
      {
        action: "ok", label: "Sali di livello", default: true, icon: "fas fa-arrow-circle-up",
        callback: (event, button) => {
          const checked = [...button.form.querySelectorAll('input[name="adv"]:checked')];
          const tot = checked.reduce((s, c) => s + Number(c.dataset.caselle), 0);
          if (tot !== 2) {
            ui.notifications.warn(`Seleziona esattamente 2 caselle (ne hai selezionate ${tot}).`);
            return false;
          }
          return checked.map(c => Number(c.value));
        }
      },
      { action: "cancel", label: "Annulla", callback: () => null }
    ],
    render: (_ev, app) => {
      const html = app instanceof HTMLElement ? app : (app.element ?? app);
      _initContatoreCaselle(html);
    }
  }).catch(() => null);
}

function _initContatoreCaselle(html) {
  if (!html) return;
  const counter = html.querySelector(".dh-cas-counter");
  const boxes   = [...html.querySelectorAll('input[name="adv"]')];
  const okBtn   = html.querySelector('button[data-action="ok"]');

  function aggiorna() {
    const tot     = boxes.filter(c => c.checked).reduce((s, c) => s + Number(c.dataset.caselle), 0);
    const rimaste = 2 - tot;

    if (counter) {
      counter.textContent = rimaste > 0 ? String(rimaste) : rimaste === 0 ? "✓" : "!";
      counter.style.color = rimaste === 0 ? "#4a8" : rimaste < 0 ? "#c44" : "";
    }
    if (okBtn) okBtn.disabled = (tot !== 2);

    // Disabilita opzioni che supererebbero il limite (se non già selezionate)
    boxes.forEach(cb => {
      if (!cb.checked) cb.disabled = Number(cb.dataset.caselle) > rimaste;
    });
  }

  boxes.forEach(cb => cb.addEventListener("change", aggiorna));
  aggiorna(); // applica stato iniziale (OK disabilitato)
}

// ─── Sub-dialog: Tratti ───────────────────────────────────────────────────────

async function _dialogTratti(actor, disponibili) {
  const righe = disponibili.map(key => {
    const val   = actor.system.tratti?.[key]?.valore ?? 0;
    const segno = n => n >= 0 ? `+${n}` : String(n);
    return `
      <label class="dh-pick-row">
        <input type="checkbox" name="tratto" value="${key}"/>
        <span>${NOMI_TRATTI[key]}
          <em class="dh-pick-val">${segno(val)} → ${segno(val + 1)}</em>
        </span>
      </label>`;
  }).join("");

  return DialogV2.wait({
    window:      { title: "Scegli 2 tratti da aumentare" },
    position:    { width: 380 },
    rejectClose: false,
    content: `
      <div class="dh-sub-dialog">
        <p>Scegli esattamente <strong>2 tratti</strong> non marcati. Ottengono +1 permanente
           e vengono marcati fino al prossimo reset di rango.</p>
        <div class="dh-pick-list">${righe}</div>
      </div>`,
    buttons: [
      {
        action: "ok", label: "Conferma", default: true,
        callback: (ev, btn) => {
          const sel = [...btn.form.querySelectorAll('input[name="tratto"]:checked')];
          if (sel.length !== 2) {
            ui.notifications.warn("Devi selezionare esattamente 2 tratti.");
            return false;
          }
          return sel.map(c => c.value);
        }
      },
      { action: "cancel", label: "Annulla", callback: () => null }
    ]
  }).catch(() => null);
}

// ─── Sub-dialog: Esperienze ───────────────────────────────────────────────────

async function _dialogEsperienze(actor) {
  const esps  = actor.items.filter(i => i.type === "experience");
  const righe = esps.map(e => {
    const b = e.system.bonus ?? 2;
    return `
      <label class="dh-pick-row">
        <input type="checkbox" name="esp" value="${e.id}"/>
        <span>${e.name} <em class="dh-pick-val">+${b} → +${b + 1}</em></span>
      </label>`;
  }).join("");

  const ids = await DialogV2.wait({
    window:      { title: "Scegli 2 esperienze da aumentare" },
    position:    { width: 420 },
    rejectClose: false,
    content: `
      <div class="dh-sub-dialog">
        <p>Scegli esattamente <strong>2 Esperienze</strong>. Ognuna riceve +1 al suo bonus.</p>
        <div class="dh-pick-list">${righe}</div>
      </div>`,
    buttons: [
      {
        action: "ok", label: "Conferma", default: true,
        callback: (ev, btn) => {
          const sel = [...btn.form.querySelectorAll('input[name="esp"]:checked')];
          if (sel.length !== 2) {
            ui.notifications.warn("Devi selezionare esattamente 2 Esperienze.");
            return false;
          }
          return sel.map(c => c.value);
        }
      },
      { action: "cancel", label: "Annulla", callback: () => null }
    ]
  }).catch(() => null);

  if (!ids) return null;
  return ids.map(id => {
    const item = actor.items.get(id);
    return { id, nome: item.name, nuovoBonus: (item.system.bonus ?? 2) + 1 };
  });
}

// ─── Sub-dialog: Carta Dominio ────────────────────────────────────────────────

async function _dialogCarta(actor, lv, maxLvCarta, srd) {
  const domini = actor.system.dominiClasse ?? [];
  if (!domini.length) {
    ui.notifications.warn("Nessun dominio di classe assegnato al personaggio.");
    return null;
  }

  const gia    = new Set(
    actor.items.filter(i => i.type === "domainCard")
               .map(i => `${i.system.dominio}||${i.name}`)
  );
  const limLv  = Math.min(lv, maxLvCarta);
  const disponibili = [];

  for (const dom of domini) {
    for (const c of (srd.CARTE_DOMINI?.[dom] ?? [])) {
      const livCarta = c.l ?? c.lv ?? c.livello ?? 1;
      const chiave   = `${dom}||${c.n ?? c.nome ?? "Carta"}`;
      if (livCarta <= limLv && !gia.has(chiave)) {
        disponibili.push({
          dominio:     dom,
          nome:        c.n ?? c.nome ?? "Carta",
          livello:     livCarta,
          descrizione: c.d ?? c.descrizione ?? "",
          costo:       c.c ?? null,
          tipo:        c.t ?? c.tipo ?? "Privilegio",
          ricarica:    c.ric ?? c.ricarica ?? ""
        });
      }
    }
  }

  if (!disponibili.length) {
    ui.notifications.warn(`Nessuna carta disponibile per i tuoi domini a livello ≤ ${limLv}.`);
    return null;
  }

  const opzioni = disponibili.map((c, i) =>
    `<option value="${i}">[${c.dominio}] Lv${c.livello} · ${c.nome}</option>`
  ).join("");

  const idx = await DialogV2.prompt({
    window:   { title: `Scegli una carta dominio (livello ≤ ${limLv})` },
    position: { width: 500 },
    content: `
      <div class="dh-sub-dialog">
        <p>Scegli una carta da uno dei tuoi domini:
           <strong>${domini.join(", ")}</strong>.</p>
        <select name="carta" style="width:100%;margin-top:.5em">${opzioni}</select>
      </div>`,
    ok: {
      label: "Prendi carta",
      callback: (ev, btn) => Number(btn.form.querySelector('[name="carta"]').value)
    }
  }).catch(() => null);

  if (idx === null || idx === undefined) return null;
  return disponibili[idx];
}

// ─── Sub-dialog: Sottoclasse (Spec / Maestria) ────────────────────────────────

async function _dialogSottoclasse(actor, rango, srd) {
  const nomeSc = actor.system.sottoclasse;
  if (!nomeSc) { ui.notifications.warn("Nessuna sottoclasse impostata."); return null; }

  const datiSc = srd.SOTTOCLASSI?.[nomeSc];
  if (!datiSc) {
    ui.notifications.warn(`Sottoclasse "${nomeSc}" non trovata nell'SRD.`);
    return null;
  }

  const tipoLabel = rango >= 4 ? "Maestria" : "Specializzazione";
  const privilegi = rango >= 4 ? (datiSc.maestria ?? []) : (datiSc.spec ?? []);

  if (!privilegi.length) {
    ui.notifications.info(`Nessun privilegio di ${tipoLabel} definito per ${nomeSc}.`);
    return null;
  }

  const anteprima = privilegi.map(p => `
    <div class="dh-sc-preview">
      <strong>${p.nome ?? "Privilegio"}</strong>
      <p>${p.descrizione ?? ""}</p>
    </div>`
  ).join("");

  const ok = await DialogV2.confirm({
    window:   { title: `${tipoLabel} — ${nomeSc}` },
    position: { width: 500 },
    content: `
      <div class="dh-sub-dialog">
        <p>Otterrai i seguenti privilegi di <strong>${tipoLabel}</strong>
           per la sottoclasse <em>${nomeSc}</em>:</p>
        ${anteprima}
      </div>`,
    yes: { label: "Ottieni" },
    no:  { label: "Annulla" }
  }).catch(() => false);

  if (!ok) return null;

  return {
    items: privilegi.map(p => ({
      name: p.nome ?? tipoLabel,
      type: "feature",
      system: {
        description: p.descrizione ?? "",
        tipoPrivilegio: "Sottoclasse",
        fonte: `${nomeSc} — ${tipoLabel}`
      }
    })),
    label: `${tipoLabel} ${nomeSc}: ${privilegi.map(p => p.nome ?? "—").join(", ")}`
  };
}

// ─── Sub-dialog: Multiclasse ──────────────────────────────────────────────────

async function _dialogMulticlasse(actor, srd) {
  const classeAtt  = actor.system.classe ?? "";
  const classiDisp = Object.keys(srd.CLASSI ?? {}).filter(c => c !== classeAtt);
  if (!classiDisp.length) {
    ui.notifications.warn("Nessuna classe disponibile per il multiclasse.");
    return null;
  }

  // Step 1: scegli classe aggiuntiva
  const opzClassi = classiDisp.map(c => `<option value="${c}">${c}</option>`).join("");
  const classeScelta = await DialogV2.prompt({
    window:   { title: "Multiclasse — Scegli classe" },
    position: { width: 440 },
    content: `
      <div class="dh-sub-dialog">
        <p>Scegli una <strong>classe aggiuntiva</strong>. Otterrai uno dei suoi domini
           e i suoi privilegi di classe base.</p>
        <select name="classe" style="width:100%;margin-top:.5em">${opzClassi}</select>
      </div>`,
    ok: { label: "Avanti →", callback: (ev, btn) => btn.form.querySelector('[name="classe"]').value }
  }).catch(() => null);
  if (!classeScelta) return null;

  // Step 2: scegli dominio
  const datiClasse  = srd.CLASSI[classeScelta] ?? {};
  const dominiNuovi = (datiClasse.domini ?? []).filter(d => !(actor.system.dominiClasse ?? []).includes(d));
  const privilegiB  = datiClasse.privilegiClasse ?? [];

  if (!dominiNuovi.length) {
    ui.notifications.warn(`Hai già tutti i domini di ${classeScelta}.`);
    return null;
  }

  const opzDomini = dominiNuovi.map(d => `<option value="${d}">${d}</option>`).join("");
  const hintPriv  = privilegiB.length
    ? `<p class="dh-mc-hint" style="margin-top:.5em;font-size:11px;color:var(--dh-fg-dim)">
         Privilegi che otterrai: <em>${privilegiB.map(p => p.nome ?? "Privilegio").join(", ")}</em>
       </p>`
    : "";

  const dominioScelto = await DialogV2.prompt({
    window:   { title: `Multiclasse ${classeScelta} — Scegli dominio` },
    position: { width: 460 },
    content: `
      <div class="dh-sub-dialog">
        <p>Scegli uno dei domini di <strong>${classeScelta}</strong>.</p>
        <select name="dominio" style="width:100%;margin-top:.5em">${opzDomini}</select>
        ${hintPriv}
      </div>`,
    ok: { label: "Conferma", callback: (ev, btn) => btn.form.querySelector('[name="dominio"]').value }
  }).catch(() => null);
  if (!dominioScelto) return null;

  return {
    classe:   classeScelta,
    dominio:  dominioScelto,
    items: privilegiB.map(p => ({
      name: p.nome ?? "Privilegio di Classe",
      type: "feature",
      system: {
        description: p.descrizione ?? "",
        tipoPrivilegio: "Classe",
        fonte: `${classeScelta} (Multiclasse)`
      }
    }))
  };
}
