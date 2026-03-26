const HISTORY_STORAGE_KEY = "toefl-speaking-practice-history";

const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const progressEmpty = document.getElementById("progressEmpty");
const progressCurve = document.getElementById("progressCurve");
const historyEmpty = document.getElementById("historyEmpty");
const historyList = document.getElementById("historyList");
const historyLimit = Number(historyList?.dataset?.limit || 0);
const AUDIO_DB_NAME = "toefl-speaking-practice-audio";
const AUDIO_STORE_NAME = "recordings";

function normalizeHistoryItem(item) {
  const fallbackId =
    item?.id ||
    item?.timestamp ||
    [item?.question, item?.transcript].filter(Boolean).join("::") ||
    `history-${Math.random().toString(36).slice(2, 10)}`;

  return {
    id: fallbackId,
    question: item?.question || "Practice session",
    transcript: item?.transcript || "",
    timestamp: item?.timestamp || new Date().toISOString(),
    scores: {
      content: item?.scores?.content ?? null,
      organization: item?.scores?.organization ?? null,
      fluency: item?.scores?.fluency ?? null
    },
    self_ratings: {
      content: item?.self_ratings?.content ?? null,
      organization: item?.self_ratings?.organization ?? null,
      fluency: item?.self_ratings?.fluency ?? null
    },
    audio_recording: item?.audio_recording
      ? {
          id: item.audio_recording.id || fallbackId,
          storage: item.audio_recording.storage || "indexeddb",
          mime_type: item.audio_recording.mime_type || null
        }
      : null,
    strengths: Array.isArray(item?.strengths) ? item.strengths : [],
    suggestions: Array.isArray(item?.suggestions) ? item.suggestions : [],
    better_structure: Array.isArray(item?.better_structure) ? item.better_structure : []
  };
}

function openAudioDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB is not supported in this browser."));
      return;
    }

    const request = window.indexedDB.open(AUDIO_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AUDIO_STORE_NAME)) {
        db.createObjectStore(AUDIO_STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open audio database."));
  });
}

async function clearAllAudioRecordings() {
  try {
    const db = await openAudioDatabase();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(AUDIO_STORE_NAME, "readwrite");
      transaction.objectStore(AUDIO_STORE_NAME).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Failed to clear audio."));
    });
    db.close();
  } catch (error) {
    console.error("Audio clear failed:", error);
  }
}

function getPracticeHistory() {
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw).map(normalizeHistoryItem) : [];
  } catch (error) {
    console.error("History load failed:", error);
    return [];
  }
}

function savePracticeHistory(items) {
  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items));
}

function formatHistoryTime(timestamp) {
  try {
    return new Date(timestamp).toLocaleString();
  } catch (error) {
    return timestamp;
  }
}

function truncateQuestion(question) {
  return question.length > 95 ? `${question.slice(0, 92)}...` : question;
}

function getProgressSessions(items) {
  return items.filter((item) =>
    [item.scores?.content, item.scores?.organization, item.scores?.fluency].every(
      (score) => Number.isFinite(Number(score))
    )
  );
}

function buildProgressCurveSvg(items) {
  const width = 640;
  const height = 240;
  const padding = { top: 24, right: 20, bottom: 36, left: 36 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const total = items.length;
  const scoreToY = (score) => padding.top + ((5 - score) / 4) * innerHeight;
  const indexToX = (index) =>
    padding.left + (total === 1 ? innerWidth / 2 : (index / (total - 1)) * innerWidth);

  const series = [
    { key: "content", color: "#ff4d6d", label: "Content" },
    { key: "organization", color: "#ff8da1", label: "Organization" },
    { key: "fluency", color: "#d95d8c", label: "Fluency" }
  ];

  const gridLines = [1, 2, 3, 4, 5]
    .map((score) => {
      const y = scoreToY(score);
      return `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#f3ccd6" stroke-width="1" />
        <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-size="12" fill="#8d6a74">${score}</text>
      `;
    })
    .join("");

  const xLabels = items
    .map((item, index) => {
      const x = indexToX(index);
      return `<text x="${x}" y="${height - 12}" text-anchor="middle" font-size="12" fill="#8d6a74">#${index + 1}</text>`;
    })
    .join("");

  const lineMarkup = series
    .map((entry) => {
      const points = items.map((item, index) => ({
        x: indexToX(index),
        y: scoreToY(Number(item.scores[entry.key]))
      }));

      const path = points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
        .join(" ");

      const circles = points
        .map(
          (point) =>
            `<circle cx="${point.x}" cy="${point.y}" r="4.5" fill="${entry.color}" stroke="#fff7f9" stroke-width="2" />`
        )
        .join("");

      return `<path d="${path}" fill="none" stroke="${entry.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />${circles}`;
    })
    .join("");

  const legend = `
    <div class="progress-legend">
      ${series
        .map(
          (entry) => `
            <span class="progress-legend-item">
              <span class="progress-legend-swatch" style="background:${entry.color}"></span>
              ${entry.label}
            </span>
          `
        )
        .join("")}
    </div>
  `;

  const svg = `
    <svg class="progress-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Progress curve showing content, organization, and fluency scores over time">
      ${gridLines}
      <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#efbac8" stroke-width="1.2" />
      <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#efbac8" stroke-width="1.2" />
      ${lineMarkup}
      ${xLabels}
    </svg>
  `;

  return `${legend}${svg}`;
}

function renderProgressCurve(items) {
  if (!progressCurve || !progressEmpty) {
    return;
  }

  const progressItems = getProgressSessions(items);

  if (progressItems.length < 2) {
    progressCurve.classList.add("hidden");
    progressEmpty.classList.remove("hidden");
    progressEmpty.textContent = "Complete at least 2 practice sessions to see your progress.";
    progressCurve.innerHTML = "";
    return;
  }

  progressEmpty.classList.add("hidden");
  progressCurve.classList.remove("hidden");
  progressCurve.innerHTML = buildProgressCurveSvg(progressItems);
}

function renderPracticeHistory() {
  if (!historyList || !historyEmpty) {
    return;
  }

  const items = getPracticeHistory();
  const visibleItems = historyLimit > 0 ? items.slice(0, historyLimit) : items;
  historyList.innerHTML = "";
  renderProgressCurve(items);

  if (!visibleItems.length) {
    historyEmpty.classList.remove("hidden");
    return;
  }

  historyEmpty.classList.add("hidden");

  visibleItems.forEach((item) => {
    const link = document.createElement("a");
    link.href = `history-detail.html?id=${encodeURIComponent(item.id)}`;
    link.className = "history-item";

    const aiSummary = [item.scores?.content, item.scores?.organization, item.scores?.fluency].some(
      (score) => score !== null
    )
      ? `AI Scores: C ${item.scores?.content ?? "-"} | O ${item.scores?.organization ?? "-"} | F ${item.scores?.fluency ?? "-"}`
      : "AI Scores: Not analyzed yet";

    link.innerHTML = `
      <p class="history-item-title">${truncateQuestion(item.question)}</p>
      <p class="history-item-time">${formatHistoryTime(item.timestamp)}</p>
      <p class="history-item-scores">${aiSummary}</p>
      <p class="history-item-self">Self Ratings: C ${item.self_ratings?.content ?? "-"} | O ${item.self_ratings?.organization ?? "-"} | F ${item.self_ratings?.fluency ?? "-"}</p>
      <p class="history-item-preview">${item.transcript || "No transcript saved yet."}</p>
    `;

    historyList.appendChild(link);
  });
}

function clearPracticeHistory() {
  window.localStorage.removeItem(HISTORY_STORAGE_KEY);
  clearAllAudioRecordings();
  renderPracticeHistory();
}

if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener("click", clearPracticeHistory);
}

renderPracticeHistory();
