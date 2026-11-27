#!/usr/bin/env node
// Joueur 1 « fantôme » : rejoint la partie à ta place pour que ton téléphone soit le joueur 2 (la manette).
//
//   node outils/joueur-fantome.mjs PONG:7K3QX9MZ           serveur en ligne
//   node outils/joueur-fantome.mjs PONG:7K3QX9MZ --local   API du Mac (docker compose)
//
// 1. Lance la borne virtuelle (./outils/borne-virtuelle/lancer.sh) et coche « Robot » à gauche.
// 2. Copie le code affiché sous la matrice (« QR affiché : PONG:… ») et lance ce script avec.
// 3. Scanne le nouveau QR avec ton téléphone : tu es le joueur 2, puis « Lancer la partie ».
// Ctrl+C : le fantôme quitte la salle, ou demande la fin si la partie est lancée.
//
// Compte « FANTOME » créé au premier lancement ; son mot de passe est gardé dans ~/.pong-fantome (jamais dans le dépôt).
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const local = args.includes('--local');
const code = args.find((a) => !a.startsWith('--'))?.trim().toUpperCase();
const API = local ? 'http://localhost:3001/api' : 'https://pong.164-132-199-27.sslip.io/api';
const PSEUDO = 'FANTOME';
const SECRET = join(homedir(), local ? '.pong-fantome-local' : '.pong-fantome');

if (!code || !/^PONG:[2-9A-HJ-NP-Z]{8}$/.test(code)) {
  console.error('Donne le code affiché sous la matrice de la borne virtuelle, par exemple :');
  console.error('  node outils/joueur-fantome.mjs PONG:7K3QX9MZ');
  process.exit(1);
}

async function call(path, token, body, method) {
  const res = await fetch(API + path, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(Array.isArray(data?.message) ? data.message.join(', ') : (data?.message ?? `HTTP ${res.status}`));
  return data;
}

async function session() {
  if (existsSync(SECRET)) {
    const password = readFileSync(SECRET, 'utf8').trim();
    return (await call('/auth/login', null, { pseudo: PSEUDO, password })).token;
  }
  const password = randomBytes(18).toString('base64url');
  const { token } = await call('/auth/register', null, { pseudo: PSEUDO, password, consent: true });
  writeFileSync(SECRET, password + '\n');
  chmodSync(SECRET, 0o600);
  console.log(`Compte ${PSEUDO} créé (mot de passe dans ${SECRET}).`);
  return token;
}

const token = await session().catch((e) => {
  console.error(`Connexion du fantôme impossible : ${e.message}`);
  if (existsSync(SECRET)) console.error(`(mot de passe lu dans ${SECRET} ; supprime ce fichier si le compte a été effacé)`);
  process.exit(1);
});

let match = await call('/matches/join', token, { code }).catch((e) => {
  console.error(`Impossible de rejoindre : ${e.message}`);
  process.exit(1);
});
const side = match.left?.pseudo === PSEUDO ? 'gauche (joueur 1)' : 'droite (joueur 2)';
console.log(`${PSEUDO} a rejoint ${match.borneId}, à ${side}.`);
if (side.startsWith('droite')) console.log("Attention : quelqu'un était déjà dans la salle, ton téléphone ne sera pas le joueur 2.");
else console.log('Scanne maintenant le nouveau QR de la borne avec ton téléphone, puis « Lancer la partie ».');

let last = '';
const timer = setInterval(async () => {
  try {
    const current = await call('/matches/current', token);
    if (current) match = current;
    const line = current
      ? `${current.status} · ${current.left?.pseudo ?? '???'} ${current.score.left} - ${current.score.right} ${current.right?.pseudo ?? '???'}`
      : 'partie terminée';
    if (line !== last) console.log(`[${new Date().toLocaleTimeString('fr-FR')}] ${line}`);
    last = line;
    if (!current) {
      clearInterval(timer);
      console.log('Le fantôme a fini. Relance-le avec le prochain code pour une autre partie.');
      process.exit(0);
    }
  } catch (e) {
    console.log(`(serveur injoignable : ${e.message})`);
  }
}, 1500);

process.on('SIGINT', async () => {
  clearInterval(timer);
  try {
    if (match.status === 'WAITING' || match.status === 'READY') {
      await call(`/matches/${match.id}/leave`, token, {});
      console.log('\nLe fantôme a quitté la salle.');
    } else if (match.status === 'COUNTDOWN' || match.status === 'LIVE') {
      await call(`/matches/${match.id}/end-request`, token, {});
      console.log('\nLe fantôme demande la fin du match (il faut aussi la demander depuis le téléphone).');
    }
  } catch (e) {
    console.log(`\n${e.message}`);
  }
  process.exit(0);
});
