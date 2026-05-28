// Dialog di avanzamento di livello: mostra le opzioni del rango corrente
// (da AVANZAMENTI_RANGO) e applica gli effetti scelti all'attore.

const { DialogV2 } = foundry.applications.api;

const RANGO_DA_LIVELLO = lv => lv <= 1 ? 1 : lv <= 4 ? 2 : lv <= 7 ? 3 : 4;

export async function apriAvanzamento(actor) {
  const url = "systems/daggerheart-ita/assets/srd/all.json";
  let data;
  try {
    data = await foundry.utils.fetchJsonWithTimeout(url);
  } catch (e) {
    ui.notifications.error("Impossibile caricare i dati di avanzamento.");
    return;
  }

  const lv    = actor.system.livello?.value ?? 1;
  const rango = RANGO_DA_LIVELLO(lv);
  const opzioni = (data.AVANZAMENTI_RANGO ?? {})[String(rango)] ?? [];

  if (!opzioni.length) {
    ui.notifications.info("Nessuna opzione di avanzamento per questo rango.");
    return;
  }

  const righe = opzioni.map((o, idx) => `
    <label class="dh-adv-opt">
      <input type="checkbox" name="adv" value="${idx}"/>
      <span class="dh-adv-opt-body">
        <strong>${o.label}</strong> <em>(${o.caselle} ${o.caselle === 1 ? "casella" : "caselle"}${o.doppia ? ", doppia" : ""})</em>
        <span class="dh-adv-desc">${o.desc}</span>
      </span>
    </label>
  `).join("");

  const content = `
    <div class="dh-adv-dialog">
      <p>Livello attuale: <strong>${lv}</strong> · Rango <strong>${rango}</strong>. Seleziona le opzioni di avanzamento (2 caselle totali per livello).</p>
      <div class="dh-adv-list">${righe}</div>
    </div>`;

  const scelte = await DialogV2.prompt({
    window: { title: `Avanzamento — Livello ${lv + 1}` },
    content,
    position: { width: 560 },
    ok: {
      label: "Applica e sali di livello",
      callback: (event, button) => {
        const checked = button.form.querySelectorAll('input[name="adv"]:checked');
        return Array.from(checked).map(c => parseInt(c.value, 10));
      }
    }
  }).catch(() => null);

  if (!scelte || !scelte.length) return;

  // Applica gli effetti
  const updates = { "system.livello.value": lv + 1 };
  const messaggi = [];

  for (const idx of scelte) {
    const o = opzioni[idx];
    if (!o) continue;
    switch (o.id) {
      case "pf":
        updates["system.pf.max"] = (actor.system.pf?.max ?? 6) + 1; break;
      case "stress":
        updates["system.stress.max"] = (actor.system.stress?.max ?? 6) + 1; break;
      case "evasione":
        updates["system.evasione.value"] = (actor.system.evasione?.value ?? 10) + 1; break;
      case "competenza":
        updates["system.competenza.value"] = (actor.system.competenza?.value ?? 1) + 1; break;
      // tratti / esperienze / carta / sottoclasse / multiclasse: vanno gestiti a mano
      default: break;
    }
    messaggi.push(o.label);
  }

  await actor.update(updates);

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="dh-adv-chat">
      <strong>${actor.name}</strong> sale al livello <strong>${lv + 1}</strong>!<br>
      Avanzamenti scelti: ${messaggi.join(", ")}
    </div>`
  });

  // Promemoria per gli avanzamenti che richiedono scelte manuali
  const manuali = scelte.map(i => opzioni[i]).filter(o =>
    ["tratti", "esperienze", "carta", "sottoclasse", "multiclasse"].includes(o?.id));
  if (manuali.length) {
    ui.notifications.info(`Ricorda di applicare manualmente: ${manuali.map(o => o.label).join(", ")}`);
  }
}
