import { socket } from "./socket.js";

// Leaderboard-Seite: Button oben rechts im Rahmen öffnet eine Vollbild-Ansicht
// über der Stage mit einer Karte pro NFC-Konto (Daten von GET /leaderboard,
// backend/accounts.py: leaderboard). Bleibt als Ansicht innerhalb der Seite,
// damit Musik, Socket-Verbindung und Ladescreen beim Wechsel nicht neu starten.

// Ohne Interaktion schließt sich die Seite von selbst wieder (Kiosk).
const AUTO_CLOSE_MS = 30000;

const buttonEl = document.getElementById("leaderboard-button");
const pageEl = document.getElementById("leaderboard-page");
const listEl = document.getElementById("leaderboard-list");
const closeEl = document.getElementById("leaderboard-close");
let autoCloseTimer = null;

// Statt Emoji (auf dem Pi fehlt die Farb-Emoji-Schrift) ein Pokal als SVG.
buttonEl.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3Zm0 4H6v1a2 2 0 0 0 1 1.7V7Zm10 0v2.7A2 2 0 0 0 18 8V7h-1Z"/>
</svg>`;

function isOpen() {
  return pageEl.classList.contains("visible");
}

function resetAutoClose() {
  clearTimeout(autoCloseTimer);
  autoCloseTimer = setTimeout(close, AUTO_CLOSE_MS);
}

function shortUid(uid) {
  return uid.length > 14 ? `${uid.slice(0, 14)}…` : uid;
}

function createStat(label, value) {
  const stat = document.createElement("div");
  stat.className = "leaderboard-stat";
  const valueEl = document.createElement("span");
  valueEl.className = "leaderboard-stat-value";
  valueEl.textContent = value;
  const labelEl = document.createElement("span");
  labelEl.className = "leaderboard-stat-label";
  labelEl.textContent = label;
  stat.append(valueEl, labelEl);
  return stat;
}

function createCard(card, rank, isActive) {
  const el = document.createElement("div");
  el.className = "leaderboard-card";
  if (rank <= 3) el.dataset.rank = String(rank);
  if (isActive) el.classList.add("active");

  const head = document.createElement("div");
  head.className = "leaderboard-card-head";
  const rankEl = document.createElement("span");
  rankEl.className = "leaderboard-rank";
  rankEl.textContent = `#${rank}`;
  // Name kommt optional aus accounts.json (von Hand gesetzt), sonst die UID.
  const name = card.name?.trim();
  const uidEl = document.createElement("span");
  uidEl.className = name ? "leaderboard-name" : "leaderboard-uid";
  uidEl.textContent = name || shortUid(card.uid);
  uidEl.title = card.uid;
  head.append(rankEl, uidEl);
  if (isActive) {
    const activeEl = document.createElement("span");
    activeEl.className = "leaderboard-active";
    activeEl.textContent = "aktiv";
    head.appendChild(activeEl);
  }

  const credits = document.createElement("div");
  credits.className = "leaderboard-credits";
  credits.textContent = card.credits;

  const stats = document.createElement("div");
  stats.className = "leaderboard-stats";
  stats.append(
    createStat("Höchststand", card.peak),
    createStat("Aufladungen", card.topups),
    createStat("Aufgeladen", card.topup_total),
  );

  el.append(head, credits, stats);
  return el;
}

async function refresh() {
  try {
    const res = await fetch("/leaderboard");
    const data = await res.json();
    listEl.replaceChildren(...data.cards.map((card, i) => createCard(card, i + 1, card.uid === data.active_uid)));
    if (data.cards.length === 0) {
      const empty = document.createElement("div");
      empty.className = "leaderboard-empty";
      empty.textContent = "Noch keine Karten registriert";
      listEl.appendChild(empty);
    }
  } catch (err) {
    console.warn("Leaderboard konnte nicht geladen werden:", err);
  }
}

function open() {
  pageEl.classList.add("visible");
  listEl.scrollTop = 0;
  resetAutoClose();
  refresh();
}

function close() {
  clearTimeout(autoCloseTimer);
  pageEl.classList.remove("visible");
}

// pointerdown nicht bis zur Stage durchlassen - dort würde der Tipp sonst den
// Einsatz wechseln bzw. im Debug-Modus spinnen (socket.js).
buttonEl.addEventListener("pointerdown", (e) => e.stopPropagation());
pageEl.addEventListener("pointerdown", (e) => {
  e.stopPropagation();
  resetAutoClose();
});
pageEl.addEventListener("scroll", resetAutoClose, { passive: true, capture: true });
buttonEl.addEventListener("click", open);
closeEl.addEventListener("click", close);

// Guthaben hat sich geändert (Spin, Aufladen, Kartenwechsel) -> offene Seite aktualisieren.
socket.on("credits_update", () => {
  if (isOpen()) refresh();
});

// Hebel gezogen: zurück zu den Walzen, damit der Spin sichtbar ist.
socket.on("state_update", (data) => {
  if (data.state === "SPINNING") close();
});
