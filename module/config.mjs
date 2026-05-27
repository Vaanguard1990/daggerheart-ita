// Costanti di sistema per Daggerheart ITA
export const DH = {};

DH.tratti = {
  agilita:    "Agilità",
  forza:      "Forza",
  astuzia:    "Astuzia",
  istinto:    "Istinto",
  presenza:   "Presenza",
  conoscenza: "Conoscenza"
};

DH.portate = ["Mischia", "Prossima", "Ravvicinata", "Lontana", "Remota"];
DH.dadiDanno = ["d4", "d6", "d8", "d10", "d12", "d20"];
DH.tipiDanno = { fisico: "Fisico", magico: "Magico" };

DH.tipiAvversario = [
  "Avversario Base","Seguace","Tiratore","Sicario","Solitario",
  "Bruto","Orda","Supporto","Condottiero","Controparte"
];
DH.tipiAvversarioColore = {
  "Avversario Base": "#6e6e6e",
  "Seguace":         "#7a8a3a",
  "Tiratore":        "#3a7aaa",
  "Sicario":         "#5a3a9a",
  "Solitario":       "#9a3a3a",
  "Bruto":           "#aa6a3a",
  "Orda":            "#7a5a3a",
  "Supporto":        "#3a9a8a",
  "Condottiero":     "#9a7a20",
  "Controparte":     "#3a7a5a"
};

DH.tipiAmbiente = ["Esplorazione", "Sociale", "Tana", "Evento", "Itinerante"];
DH.tipiAmbienteColore = {
  "Esplorazione": "#3d6e3d",
  "Sociale":      "#3d5a7a",
  "Tana":         "#7a3d3d",
  "Evento":       "#7a5a3d",
  "Itinerante":   "#5a3d7a"
};

DH.classi = ["Bardo","Consacrato","Druido","Fuorilegge","Guardiano","Guerriero","Mago","Ranger","Stregone"];
DH.domini = ["Arcano","Lama","Ossa","Codice","Grazia","Mezzanotte","Saggezza","Splendore","Valore"];

// Tier da livello (1: 1; 2: 2-4; 3: 5-7; 4: 8-10)
DH.tierDaLivello = (lv) => lv <= 1 ? 1 : lv <= 4 ? 2 : lv <= 7 ? 3 : 4;

// Soglie iniziali (Lv1): Maggiore = 6+lv, Grave = 12+lv (regola generica; classi le sovrascrivono)
DH.soglieDaLivello = (lv, base = { maggiore: 6, grave: 12 }) => ({
  maggiore: base.maggiore + Math.max(0, lv - 1),
  grave:    base.grave    + Math.max(0, lv - 1)
});

DH.categorieArma = ["Primaria", "Secondaria"];
