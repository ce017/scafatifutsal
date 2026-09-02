#!/usr/bin/env node
/**
 * sync-home.js
 *
 * Il sito è statico: la home (index.html) mostra un'anteprima dei giocatori
 * (sezione "I nostri giocatori") e delle foto (sezione "Dalla nostra gallery"),
 * ma quei blocchi sono HTML scritto a mano — non si aggiornano da soli quando
 * modifichi squadra/index.html o le pagine di galleria/<stagione>/index.html.
 *
 * Questo script legge i contenuti reali da:
 *   - squadra/index.html      -> prende i primi N giocatori della rosa
 *   - galleria/<stagione>/    -> prende le foto della stagione più recente
 *                                (e, se non bastano, aggiunge quelle della
 *                                stagione precedente, e così via)
 * e riscrive automaticamente i due blocchi corrispondenti in index.html,
 * tra i marcatori:
 *   <!-- SYNC:PLAYERS:START --> ... <!-- SYNC:PLAYERS:END -->
 *   <!-- SYNC:GALLERY:START --> ... <!-- SYNC:GALLERY:END -->
 *
 * Uso:
 *   node scripts/sync-home.js          // aggiorna index.html
 *   node scripts/sync-home.js --check  // non scrive nulla, esce con codice
 *                                       // diverso da 0 se index.html non è
 *                                       // allineato (usato in CI)
 *
 * Non serve installare nulla: usa solo i moduli nativi di Node.js.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PLAYERS_LIMIT = 6;
const GALLERY_LIMIT = 6;

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

// Estrae blocchi <div ...>...</div> bilanciati (gestisce i div annidati)
// a partire da ogni punto in cui `startTagRegex` trova un tag di apertura.
function extractBalancedDivs(html, startTagRegex) {
  const blocks = [];
  const starter = new RegExp(startTagRegex.source, 'g');
  let m;
  while ((m = starter.exec(html))) {
    const start = m.index;
    const tagRe = /<div\b[^>]*>|<\/div>/g;
    tagRe.lastIndex = start;
    let depth = 0;
    let end = -1;
    let t;
    while ((t = tagRe.exec(html))) {
      if (t[0].startsWith('</')) {
        depth -= 1;
        if (depth === 0) {
          end = t.index + t[0].length;
          break;
        }
      } else {
        depth += 1;
      }
      // continua a cercare a partire da dove siamo arrivati
      tagRe.lastIndex = t.index + t[0].length;
    }
    if (end === -1) {
      throw new Error('Blocco <div> non bilanciato nel sorgente HTML.');
    }
    blocks.push(html.slice(start, end));
    starter.lastIndex = end;
  }
  return blocks;
}

function formatDelay(i) {
  const v = 0.05 + i * 0.07;
  let s = v.toFixed(2);
  if (s.endsWith('0')) s = s.slice(0, -1);
  return s.replace(/^0\./, '.') + 's';
}

// ---------------------------------------------------------------------
// 1) Giocatori: leggi squadra/index.html, prendi i primi PLAYERS_LIMIT
// ---------------------------------------------------------------------
function getFeaturedPlayers() {
  const squadraHtml = read('squadra/index.html');
  const blocks = extractBalancedDivs(squadraHtml, /<div class="player reveal"/);

  const players = blocks.slice(0, PLAYERS_LIMIT).map((block) => {
    const nameMatch = block.match(/<div class="player__name">([^<]+)<\/div>/);
    const baseMatch = block.match(/<img class="base" src="([^"]+)"/);
    const exultMatch = block.match(/<img class="exult" src="([^"]+)"/);
    if (!nameMatch || !baseMatch) {
      throw new Error('Impossibile leggere un giocatore da squadra/index.html — struttura inattesa.');
    }
    return {
      name: nameMatch[1],
      base: baseMatch[1],
      exult: exultMatch ? exultMatch[1] : null,
    };
  });

  if (players.length === 0) {
    throw new Error('Nessun giocatore trovato in squadra/index.html.');
  }
  return players;
}

function renderPlayersBlock(players) {
  return players
    .map((p, i) => {
      const delay = formatDelay(i);
      const exultLine = p.exult
        ? `\n            <img class="exult" src="${p.exult}" alt="" loading="lazy">`
        : '';
      return `        <div class="player reveal" style="--d:${delay}">
          <div class="player__frame">
            <img class="base" src="${p.base}" alt="${p.name}" loading="lazy">${exultLine}
            <span class="player__shine"></span>
          </div>
          <div class="player__name">${p.name}</div>
        </div>`;
    })
    .join('\n');
}

// ---------------------------------------------------------------------
// 2) Gallery: prendi le foto della stagione più recente in galleria/,
//    completando con le stagioni precedenti se non bastano.
// ---------------------------------------------------------------------
function getSeasonFolders() {
  const galleriaDir = path.join(ROOT, 'galleria');
  return fs
    .readdirSync(galleriaDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}-\d{2}$/.test(d.name))
    .map((d) => d.name)
    .sort()
    .reverse(); // stagione più recente prima, es. "2025-26" prima di "2024-25"
}

function getSeasonPhotos(season) {
  const seasonHtml = read(`galleria/${season}/index.html`);
  const anchorRe = /<a href="([^"]+)" class="reveal" style="--d:[^"]*">\s*<img src="([^"]+)" alt="([^"]*)" loading="lazy">\s*<\/a>/g;
  const photos = [];
  let m;
  while ((m = anchorRe.exec(seasonHtml))) {
    photos.push({ src: m[2], alt: m[3] });
  }
  return photos;
}

function getFeaturedPhotos() {
  const seasons = getSeasonFolders();
  const photos = [];
  for (const season of seasons) {
    if (photos.length >= GALLERY_LIMIT) break;
    const seasonPhotos = getSeasonPhotos(season);
    for (const photo of seasonPhotos) {
      if (photos.length >= GALLERY_LIMIT) break;
      photos.push(photo);
    }
  }
  if (photos.length === 0) {
    throw new Error('Nessuna foto trovata nelle pagine di galleria/<stagione>/index.html.');
  }
  return photos;
}

function renderGalleryBlock(photos) {
  return photos
    .map((photo, i) => {
      const delay = formatDelay(i);
      return `        <a href="/galleria/" class="reveal" style="--d:${delay}"><img src="${photo.src}" alt="${photo.alt}" loading="lazy"></a>`;
    })
    .join('\n');
}

// ---------------------------------------------------------------------
// 3) Sostituisci il contenuto tra i marcatori in index.html
// ---------------------------------------------------------------------
function replaceBetweenMarkers(html, startMarker, endMarker, innerContent) {
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`Marcatori non trovati in index.html: "${startMarker}" / "${endMarker}". Non li ho toccati apposta — controlla che non siano stati rimossi per errore.`);
  }
  const before = html.slice(0, startIdx + startMarker.length);
  const after = html.slice(endIdx);
  return `${before}\n${innerContent}\n        ${after}`;
}

function main() {
  const checkOnly = process.argv.includes('--check');

  const original = read('index.html');
  let updated = original;

  const players = getFeaturedPlayers();
  updated = replaceBetweenMarkers(
    updated,
    '<!-- SYNC:PLAYERS:START — generato da scripts/sync-home.js, non modificare a mano -->',
    '<!-- SYNC:PLAYERS:END -->',
    renderPlayersBlock(players)
  );

  const photos = getFeaturedPhotos();
  updated = replaceBetweenMarkers(
    updated,
    '<!-- SYNC:GALLERY:START — generato da scripts/sync-home.js, non modificare a mano -->',
    '<!-- SYNC:GALLERY:END -->',
    renderGalleryBlock(photos)
  );

  if (updated === original) {
    console.log('index.html è già allineato a squadra/ e galleria/. Nessuna modifica necessaria.');
    return;
  }

  if (checkOnly) {
    console.error('index.html NON è allineato a squadra/ e galleria/. Esegui: node scripts/sync-home.js');
    process.exit(1);
  }

  fs.writeFileSync(path.join(ROOT, 'index.html'), updated, 'utf8');
  console.log(`index.html aggiornato: ${players.length} giocatori, ${photos.length} foto.`);
}

main();
