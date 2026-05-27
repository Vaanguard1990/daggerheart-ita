#!/usr/bin/env node
// Estrae le costanti dati dal file daggerheart-dm-fix12.jsx in JSON.
const fs = require('fs');
const path = require('path');

const SRC = '../../daggerheart-dm-fix12.jsx';
const OUT_DIR = '../assets/srd';
fs.mkdirSync(OUT_DIR, { recursive: true });

const src = fs.readFileSync(SRC, 'utf8');

// Trova `const NAME = ` (top-level), poi raccoglie il testo fino al terminatore
// tenendo conto di parentesi (), {}, [], stringhe singole/doppie/backtick.
function extractConstValue(name) {
  const re = new RegExp(`^const\\s+${name}\\s*=\\s*`, 'm');
  const m = src.match(re);
  if (!m) return null;
  const start = m.index + m[0].length;

  let i = start;
  let depthParen = 0, depthBrace = 0, depthBracket = 0;
  let inStr = null; // "'", '"', "`"
  let escape = false;

  while (i < src.length) {
    const c = src[i];
    if (inStr) {
      if (escape) { escape = false; }
      else if (c === '\\') { escape = true; }
      else if (c === inStr) { inStr = null; }
      i++;
      continue;
    }
    if (c === '/' && src[i+1] === '/') {
      // line comment
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i+1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i+1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; i++; continue; }
    if (c === '(') depthParen++;
    else if (c === ')') depthParen--;
    else if (c === '{') depthBrace++;
    else if (c === '}') depthBrace--;
    else if (c === '[') depthBracket++;
    else if (c === ']') depthBracket--;
    else if (c === ';' && depthParen === 0 && depthBrace === 0 && depthBracket === 0) {
      return src.slice(start, i);
    }
    i++;
  }
  return src.slice(start);
}

function evalExpr(name, txt) {
  // Wrap in parens and eval con Function
  try {
    // Some constants reference TRATTI etc. We replace identifier refs we know are arrays/strings
    // For our subset of data constants, they should be self-contained literals.
    const fn = new Function('"use strict"; return (' + txt + ');');
    return fn();
  } catch (e) {
    console.error(`ERR eval ${name}:`, e.message);
    return null;
  }
}

const targets = [
  'CLASSI',
  'SOTTOCLASSI',
  'ORIGINI',
  'COMUNITA',
  'TRATTI',
  'LIVELLI',
  'AVANZAMENTI_RANGO',
  'CARTE_DOMINI',
  'ARMI',
  'FORME_BESTIALI',
  'ARMATURE',
  'PORTATE',
  'TRATTI_ARMA',
  'DADI_DANNO',
  'TIPI_DANNO',
  'MOSTRI_MANUALE',
  'AMBIENTI_MANUALE',
];

const out = {};
for (const t of targets) {
  const txt = extractConstValue(t);
  if (!txt) {
    console.error(`${t}: NON TROVATO`);
    continue;
  }
  const val = evalExpr(t, txt);
  if (val === null) {
    console.error(`${t}: NON VALUTATO (${txt.slice(0, 80)}...)`);
    continue;
  }
  out[t] = val;
  // Stat sommaria
  if (Array.isArray(val)) {
    console.log(`${t}: array(${val.length})`);
  } else if (typeof val === 'object') {
    console.log(`${t}: object(keys=${Object.keys(val).length})`);
  } else {
    console.log(`${t}: ${typeof val}`);
  }
}

fs.writeFileSync(path.join(OUT_DIR, 'all.json'), JSON.stringify(out, null, 2));
console.log(`\nScritto ${path.join(OUT_DIR, 'all.json')}`);
console.log(`Size: ${fs.statSync(path.join(OUT_DIR, 'all.json')).size} bytes`);
