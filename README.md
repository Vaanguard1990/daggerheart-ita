# Daggerheart (ITA) — Sistema per Foundry VTT

Sistema italiano non ufficiale per **Daggerheart** di Darrington Press,
compagno della suite *Daggerheart Strumenti del DM* e *Daggerheart Strumenti del PG*.

Compatibile con **Foundry VTT v13+ (verificato su v14)**.

## Installazione utente finale

### Da manifest URL
1. In Foundry: **Configuration → Game Systems → Install System**
2. Incolla:
   ```
   https://github.com/giuseppesantostasi90-lang/daggerheart-ita/releases/latest/download/system.json
   ```
3. Foundry scaricherà e installerà l'ultima versione.

### Aggiornamento
Foundry controlla automaticamente il manifest a ogni avvio.
Quando una nuova versione è pubblicata, vedrai il badge **"Update"** accanto al sistema
nella schermata di setup. Click → aggiornamento automatico.

## Primo avvio

1. Crea un mondo con il sistema **Daggerheart (ITA)**
2. Entra come GM → sidebar **Actors** → due pulsanti:
   - **Speranza / Paura** — apre il tracker globale
   - **Importa SRD** — popola il mondo con tutti i dati ufficiali italiani
3. Crea un Personaggio e trascina dalle cartelle "Discendenze", "Classi", ecc.

## Pubblicazione di una nuova versione (per lo sviluppatore)

Il sistema usa il flusso **tag-driven** standard di Foundry:

### Setup iniziale (una sola volta)
1. Crea un repo GitHub pubblico chiamato `daggerheart-ita`
2. Pusha tutto il contenuto di questa cartella nel repo
3. Assicurati che `system.json` abbia il campo `url`, `manifest` e `download`
   puntanti al tuo repo (già configurati)

### Rilascio di una nuova versione

**Modo automatico (consigliato):**
```bash
./tools/release.sh 0.1.4
```

Lo script:
- aggiorna la versione in `system.json`
- crea il commit `release: v0.1.4`
- crea il tag `v0.1.4`
- pusha tutto su GitHub
- GitHub Actions costruisce automaticamente la release con `system.zip`

**Modo manuale:**
```bash
# 1. Modifica system.json e cambia "version": "X.Y.Z"
# 2. Commit
git add system.json
git commit -m "release: v0.1.4"

# 3. Tag
git tag -a v0.1.4 -m "Daggerheart ITA v0.1.4"

# 4. Push
git push origin main
git push origin v0.1.4
```

Dopo il push del tag, l'Action **Release** parte automaticamente:
- builda `system.zip`
- crea la GitHub Release `v0.1.4`
- carica `system.json` + `system.zip` come asset
- Foundry, alla prossima apertura, mostrerà il badge "Update"

### Come funziona l'auto-update di Foundry

Foundry, all'avvio, fetcha l'URL nel campo `manifest` di `system.json`:
```
https://github.com/giuseppesantostasi90-lang/daggerheart-ita/releases/latest/download/system.json
```

Questo URL **risolve sempre alla release più recente**. Se la `version` lì
è maggiore di quella installata, Foundry mostra "Update Available" e scarica il
file in `download`:
```
https://github.com/giuseppesantostasi90-lang/daggerheart-ita/releases/latest/download/system.zip
```

Nessuna configurazione extra necessaria dopo il setup iniziale.

## Architettura

```
daggerheart-ita/
├── system.json          # manifest (versione, compatibilità, manifest URL)
├── template.json        # schemi dati Actor / Item
├── module/              # codice JS (ES modules)
├── templates/           # Handlebars
├── styles/              # CSS
├── lang/it.json         # localizzazione
├── assets/srd/all.json  # dati SRD italiani (importabili a un click)
├── tools/
│   ├── extract.js       # estrae dati dal daggerheart-dm-fix12.jsx
│   └── release.sh       # script di rilascio
└── .github/workflows/
    └── release.yml      # GitHub Actions per build automatico
```

### Rigenerare i dati SRD

I dati vengono dal file `daggerheart-dm-fix12.jsx` del DM tool. Per aggiornarli:

```bash
cd tools && node extract.js
# Output: ../assets/srd/all.json
```

## Crediti & Licenza

- Sistema: Giuseppe Santostasi
- Daggerheart: © Darrington Press
- Termini italiani: traduzione ufficiale ITA

Codice MIT. Il materiale di gioco è proprietà di Darrington Press e richiede il manuale.
