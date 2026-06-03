// Daggerheart (ITA) — entry point
import { DH } from "./config.mjs";
import { DaggerheartActor, DaggerheartItem } from "./documents.mjs";
import { DaggerheartCharacterSheet } from "./sheets/character-sheet.mjs";
import { DaggerheartAdversarySheet } from "./sheets/adversary-sheet.mjs";
import { DaggerheartEnvironmentSheet } from "./sheets/environment-sheet.mjs";
import { DaggerheartItemSheet } from "./sheets/item-sheet.mjs";
import { registerHopeFearSettings } from "./hope-fear.mjs";
import { openTracker, refreshTracker } from "./hope-fear-tracker.mjs";
import { registerCountdownSettings } from "./countdowns.mjs";
import { openCountdowns, refreshCountdowns } from "./countdown-tracker.mjs";
import { DualityRoll } from "./duality-roll.mjs";
import { importSRD } from "./srd-import.mjs";
import { registerHelpers } from "./handlebars-helpers.mjs";
import { registerAutoImport } from "./auto-import.mjs";

const SYS = "daggerheart-ita";

Hooks.once("init", async () => {
  console.log("Daggerheart ITA | init");
  registerHelpers();
  registerAutoImport();

  // API globale
  game.daggerheart = { DH, DualityRoll, importSRD, openHopeFearTracker: openTracker, openCountdowns };
  CONFIG.DH = DH;

  // Document classes
  CONFIG.Actor.documentClass = DaggerheartActor;
  CONFIG.Item.documentClass  = DaggerheartItem;

  // Sheets — V2 registration
  const Actors = foundry.documents.collections.Actors ?? globalThis.Actors;
  const Items  = foundry.documents.collections.Items  ?? globalThis.Items;
  const baseActorSheet = foundry.appv1?.sheets?.ActorSheet ?? globalThis.ActorSheet;
  const baseItemSheet  = foundry.appv1?.sheets?.ItemSheet  ?? globalThis.ItemSheet;

  if (baseActorSheet) Actors.unregisterSheet?.("core", baseActorSheet);
  Actors.registerSheet(SYS, DaggerheartCharacterSheet,
    { types: ["character"],   makeDefault: true, label: "Daggerheart: Personaggio" });
  Actors.registerSheet(SYS, DaggerheartAdversarySheet,
    { types: ["adversary"],   makeDefault: true, label: "Daggerheart: Avversario" });
  Actors.registerSheet(SYS, DaggerheartEnvironmentSheet,
    { types: ["environment"], makeDefault: true, label: "Daggerheart: Ambiente" });

  if (baseItemSheet) Items.unregisterSheet?.("core", baseItemSheet);
  Items.registerSheet(SYS, DaggerheartItemSheet,
    { makeDefault: true, label: "Daggerheart: Item" });

  // Settings
  registerHopeFearSettings();
  registerCountdownSettings();

  // Pre-load partials (Handlebars)
  const base = `systems/${SYS}/templates/item/parts`;
  const partials = [
    "weapon","armor","ancestry","community","class","subclass",
    "domainCard","feature","experience","consumable","inventory","beastForm"
  ].map(t => `${base}/${t}.hbs`);
  const loader = foundry.applications?.handlebars?.loadTemplates ?? globalThis.loadTemplates;
  if (loader) await loader(partials);

  // Default data per nuovi PG
  Hooks.on("preCreateActor", (doc, data) => {
    if (doc.type === "character") {
      const sys = data.system ?? {};
      const upd = {};
      if (!sys.pf?.max)         upd["system.pf.max"] = 6;
      if (!sys.stress?.max)     upd["system.stress.max"] = 6;
      if (!sys.speranza?.max)   upd["system.speranza.max"] = 6;
      if (!sys.speranza?.value) upd["system.speranza.value"] = 2;
      if (Object.keys(upd).length) doc.updateSource(upd);
    }
  });
});

Hooks.once("ready", () => {
  console.log("Daggerheart ITA | ready");
  Hooks.on("daggerheart.hopeFearChanged", () => refreshTracker());
  Hooks.on("daggerheart.countdownsChanged", () => refreshCountdowns());
  if (game.user.isGM) openTracker();
});

// Pulsanti nella sidebar Actors
Hooks.on("renderActorDirectory", (app, html) => {
  if (!game.user.isGM) return;
  const root = html instanceof HTMLElement ? html : html[0];
  if (!root || root.querySelector(".dh-toolbar")) return;
  const bar = document.createElement("div");
  bar.className = "dh-toolbar";
  bar.innerHTML = `
    <button type="button" class="dh-btn" data-act="hopefear">
      <i class="fa-solid fa-skull"></i> Speranza / Paura
    </button>
    <button type="button" class="dh-btn" data-act="countdown">
      <i class="fa-solid fa-hourglass-half"></i> Countdown
    </button>
    <button type="button" class="dh-btn" data-act="import">
      <i class="fa-solid fa-download"></i> Importa SRD
    </button>`;
  bar.querySelector('[data-act="hopefear"]').addEventListener("click", () => openTracker());
  bar.querySelector('[data-act="countdown"]').addEventListener("click", () => openCountdowns());
  bar.querySelector('[data-act="import"]').addEventListener("click", () => importSRD());
  const header = root.querySelector(".directory-header") || root.firstElementChild;
  header?.parentNode?.insertBefore(bar, header.nextSibling);
});
