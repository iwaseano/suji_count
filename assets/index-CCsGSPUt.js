const BASE_PATH = '/suji_count/';

function buildAssetPath(path) {
  const normalizedBase = BASE_PATH.endsWith('/') ? BASE_PATH : `${BASE_PATH}/`;
  return `${normalizedBase}${path.replace(/^\/+/, '')}`;
}

const tilePathMap = {
  '1m': buildAssetPath('tiles/Regular/Man1.svg'),
  '2m': buildAssetPath('tiles/Regular/Man2.svg'),
  '3m': buildAssetPath('tiles/Regular/Man3.svg'),
  '4m': buildAssetPath('tiles/Regular/Man4.svg'),
  '5m': buildAssetPath('tiles/Regular/Man5.svg'),
  '6m': buildAssetPath('tiles/Regular/Man6.svg'),
  '7m': buildAssetPath('tiles/Regular/Man7.svg'),
  '8m': buildAssetPath('tiles/Regular/Man8.svg'),
  '9m': buildAssetPath('tiles/Regular/Man9.svg'),
  '1p': buildAssetPath('tiles/Regular/Pin1.svg'),
  '2p': buildAssetPath('tiles/Regular/Pin2.svg'),
  '3p': buildAssetPath('tiles/Regular/Pin3.svg'),
  '4p': buildAssetPath('tiles/Regular/Pin4.svg'),
  '5p': buildAssetPath('tiles/Regular/Pin5.svg'),
  '6p': buildAssetPath('tiles/Regular/Pin6.svg'),
  '7p': buildAssetPath('tiles/Regular/Pin7.svg'),
  '8p': buildAssetPath('tiles/Regular/Pin8.svg'),
  '9p': buildAssetPath('tiles/Regular/Pin9.svg'),
  '1s': buildAssetPath('tiles/Regular/Sou1.svg'),
  '2s': buildAssetPath('tiles/Regular/Sou2.svg'),
  '3s': buildAssetPath('tiles/Regular/Sou3.svg'),
  '4s': buildAssetPath('tiles/Regular/Sou4.svg'),
  '5s': buildAssetPath('tiles/Regular/Sou5.svg'),
  '6s': buildAssetPath('tiles/Regular/Sou6.svg'),
  '7s': buildAssetPath('tiles/Regular/Sou7.svg'),
  '8s': buildAssetPath('tiles/Regular/Sou8.svg'),
  '9s': buildAssetPath('tiles/Regular/Sou9.svg'),
  '1z': buildAssetPath('tiles/Regular/Ton.svg'),
  '2z': buildAssetPath('tiles/Regular/Nan.svg'),
  '3z': buildAssetPath('tiles/Regular/Shaa.svg'),
  '4z': buildAssetPath('tiles/Regular/Pei.svg'),
  '5z': buildAssetPath('tiles/Regular/Haku.svg'),
  '6z': buildAssetPath('tiles/Regular/Hatsu.svg'),
  '7z': buildAssetPath('tiles/Regular/Chun.svg'),
};

function getTileSvgPath(tileId) {
  return tilePathMap[tileId] ?? buildAssetPath('tiles/Regular/Man1.svg');
}

const app = document.querySelector('#app');
if (!app) {
  throw new Error('App root not found');
}

const correctAudio = new Audio(new URL('/suji_count/assets/correct_pinpon-C6TqvGh8.mp3', `${import.meta.url}`).href);
const incorrectAudio = new Audio(new URL('/suji_count/assets/cancel_invalid-nBq4QEbL.mp3', `${import.meta.url}`).href);

document.documentElement.style.setProperty('--return-icon-url', `url("${buildAssetPath('icons/return_symbol_u23ce_filled.svg')}")`);

let initialQuestions = [];
let loadingQuestions = true;
let loadingError = null;

let state = 'ready';
let questions = [];
let currentQuestion = null;
let selectedAnswer = null;
let totalAnswerCount = 0;
let correctAnswerCount = 0;
let answerEffect = null;
let answerEffectTimer = null;

function stopAnswerEffectTimer() {
  if (answerEffectTimer !== null) {
    window.clearTimeout(answerEffectTimer);
    answerEffectTimer = null;
  }
}

function normalizeQuestion(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const source = value;
  const questionId = typeof source.questionId === 'string'
    ? source.questionId
    : (typeof source.id === 'string' ? source.id : null);
  const discards = Array.isArray(source.discards) ? source.discards.filter((item) => typeof item === 'string') : null;
  const correctCount = typeof source.correctCount === 'number'
    ? source.correctCount
    : (typeof source.correct_count === 'number' ? source.correct_count : null);
  const level = typeof source.level === 'string' || source.level === null ? source.level : null;

  if (!questionId || !discards || discards.length === 0 || correctCount === null) {
    return null;
  }

  if (!Number.isInteger(correctCount) || correctCount < 0 || correctCount > 18) {
    return null;
  }

  return { questionId, discards, correctCount, level };
}

function toAbsoluteDataUrl(relativeOrAbsolute) {
  if (/^https?:\/\//.test(relativeOrAbsolute)) {
    return relativeOrAbsolute;
  }
  const cleaned = relativeOrAbsolute.replace(/^\.?\//, '');
  return buildAssetPath(`data/${cleaned}`);
}

async function discoverDataJsonUrls() {
  const indexUrl = buildAssetPath('data/index.json');
  const indexResponse = await fetch(indexUrl, { cache: 'no-store' });
  if (indexResponse.ok) {
    const files = await indexResponse.json();
    if (!Array.isArray(files)) {
      throw new Error('data/index.json must be an array');
    }
    return files
      .filter((value) => typeof value === 'string' && value.trim().endsWith('.json'))
      .map((value) => toAbsoluteDataUrl(value.trim()));
  }

  const directoryUrl = buildAssetPath('data/');
  const directoryResponse = await fetch(directoryUrl, { cache: 'no-store' });
  if (!directoryResponse.ok) {
    throw new Error('Failed to load data/index.json and data directory listing');
  }
  const html = await directoryResponse.text();
  const urls = [];
  const pattern = /href="([^"]+\.json)"/g;
  for (const match of html.matchAll(pattern)) {
    const href = match[1];
    if (href.endsWith('index.json')) {
      continue;
    }
    if (href.startsWith('/')) {
      urls.push(href);
    } else {
      urls.push(toAbsoluteDataUrl(href));
    }
  }
  const unique = [...new Set(urls)];
  if (unique.length === 0) {
    throw new Error('No JSON files found in data folder');
  }
  return unique;
}

async function loadQuestionsFromDataFolder() {
  const urls = await discoverDataJsonUrls();
  const loaded = await Promise.all(
    urls.map(async (url) => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to load ${url}: ${response.status}`);
      }
      return response.json();
    }),
  );

  const merged = [];
  for (const fileData of loaded) {
    if (!Array.isArray(fileData)) {
      throw new Error('Each data JSON must be an array');
    }
    for (const item of fileData) {
      const normalized = normalizeQuestion(item);
      if (normalized) {
        merged.push(normalized);
      }
    }
  }

  if (merged.length === 0) {
    throw new Error('No valid question records found in data JSON files');
  }
  return merged;
}

function getRandomQuestion() {
  if (questions.length === 0) {
    return null;
  }
  const index = Math.floor(Math.random() * questions.length);
  const [chosen] = questions.splice(index, 1);
  return chosen ?? null;
}

function chunkDiscards(discards) {
  const chunkSize = discards.length >= 7 ? 6 : (discards.length || 1);
  const rows = [];
  for (let index = 0; index < discards.length; index += chunkSize) {
    rows.push(discards.slice(index, index + chunkSize));
  }
  return rows;
}

function playAnswerEffectSound(effect) {
  const audio = effect === 'correct' ? correctAudio : incorrectAudio;
  audio.currentTime = 0;
  audio.play().catch((error) => {
    console.error(`Failed to play ${effect} effect audio.`, error);
  });
}

function goToNextQuestion() {
  stopAnswerEffectTimer();
  answerEffect = null;

  const nextQuestion = getRandomQuestion();
  if (!nextQuestion) {
    currentQuestion = null;
    questions = [...initialQuestions];
    selectedAnswer = null;
    state = 'ready';
    render();
    return;
  }

  currentQuestion = nextQuestion;
  selectedAnswer = null;
  state = 'playing';
  render();
}

function startGame() {
  if (loadingQuestions || loadingError) {
    return;
  }
  stopAnswerEffectTimer();
  answerEffect = null;
  questions = [...initialQuestions];
  currentQuestion = getRandomQuestion();
  selectedAnswer = null;
  totalAnswerCount = 0;
  correctAnswerCount = 0;
  state = currentQuestion ? 'playing' : 'ready';
  render();
}

function render() {
  const accuracy = totalAnswerCount === 0 ? '---' : `${((correctAnswerCount / totalAnswerCount) * 100).toFixed(1)}%`;

  if (state === 'ready') {
    const loadingText = loadingQuestions
      ? '問題データを読み込み中です...'
      : (loadingError ?? '捨て牌から残っているスジ候補数を数えるMVPトレーニングです。');
    const canStart = !loadingQuestions && !loadingError;
    const buttonLabel = canStart ? 'トレーニング開始' : '読み込み待機中';

    app.innerHTML = `
      <div class="center-card">
        <div class="start-screen">
          <h1 class="title">麻雀スジ残数</h1>
          <p class="subtitle">${loadingText}</p>
          <button class="start-btn" id="start-btn" ${canStart ? '' : 'disabled'}>${buttonLabel}</button>
        </div>
      </div>
    `;
    document.querySelector('#start-btn')?.addEventListener('click', startGame);
    return;
  }

  const isEffectActive = answerEffect !== null;
  const controlsDisabled = state === 'result' || isEffectActive;
  const discardRows = chunkDiscards(currentQuestion?.discards ?? []);

  app.innerHTML = `
    <div class="app">
      <header class="status-bar">
        <div class="status-item">
          <span class="status-label">正解数</span>
          <span class="status-value">${correctAnswerCount}</span>
        </div>
        <div class="status-item">
          <span class="status-label">回答数</span>
          <span class="status-value">${totalAnswerCount}</span>
        </div>
        <div class="status-item">
          <span class="status-label">正答率</span>
          <span class="status-value">${accuracy}</span>
        </div>
      </header>

      <main class="board">
        <div class="tile-area ${isEffectActive ? 'answer-effect' : ''}">
          ${isEffectActive ? `
            <div class="correct-overlay ${answerEffect === 'incorrect' ? 'incorrect-overlay' : ''}" aria-live="polite" aria-label="判定エフェクト">
              <span class="correct-effect-text ${answerEffect === 'incorrect' ? 'incorrect-effect-text' : ''}">
                ${answerEffect === 'incorrect' ? '×' : '○'}
              </span>
            </div>
          ` : ''}
          <div class="tile-stack">
            ${discardRows.map((row) => `
              <div class="tile-row">
                ${row.map((tile) => `
                  <div class="tile">
                    <img class="tile-svg" src="${getTileSvgPath(tile)}" alt="${tile}" />
                  </div>
                `).join('')}
              </div>
            `).join('')}
          </div>
        </div>

        <div class="answer-grid">
          ${Array.from({ length: 19 }, (_, index) => {
            const value = index;
            const selectedClass = selectedAnswer === value ? 'selected' : '';
            return `<button class="answer-btn ${selectedClass}" data-value="${value}" ${controlsDisabled ? 'disabled' : ''}>${value}</button>`;
          }).join('')}
          <button class="answer-btn enter-btn" id="quick-confirm-btn" aria-label="回答を確定" ${selectedAnswer === null || controlsDisabled ? 'disabled' : ''}>
            <span class="enter-icon" aria-hidden="true"></span>
          </button>
        </div>

        <div class="action-buttons">
          <button class="confirm-btn" id="confirm-btn" ${selectedAnswer === null || controlsDisabled ? 'disabled' : ''}>
            回答を確定
          </button>
          <button class="next-btn" id="next-btn" ${isEffectActive ? 'disabled' : ''}>次の問題へ</button>
        </div>
      </main>
    </div>
  `;

  document.querySelectorAll('.answer-btn[data-value]').forEach((button) => {
    button.addEventListener('click', () => {
      if (state === 'result' || answerEffect !== null) {
        return;
      }
      const value = Number(button.dataset.value);
      if (!Number.isInteger(value) || value < 0 || value > 18) {
        return;
      }
      selectedAnswer = value;
      render();
    });
  });

  const confirmAnswer = () => {
    if (selectedAnswer === null || !currentQuestion || state === 'result' || answerEffect !== null) {
      return;
    }

    totalAnswerCount += 1;
    const isCorrect = selectedAnswer === currentQuestion.correctCount;
    state = 'result';
    answerEffect = isCorrect ? 'correct' : 'incorrect';
    playAnswerEffectSound(answerEffect);
    if (isCorrect) {
      correctAnswerCount += 1;
    }
    render();

    if (isCorrect) {
      answerEffectTimer = window.setTimeout(() => {
        goToNextQuestion();
      }, 2000);
      return;
    }

    answerEffectTimer = window.setTimeout(() => {
      answerEffect = null;
      state = 'playing';
      selectedAnswer = null;
      render();
    }, 1000);
  };

  document.querySelector('#confirm-btn')?.addEventListener('click', confirmAnswer);
  document.querySelector('#quick-confirm-btn')?.addEventListener('click', confirmAnswer);
  document.querySelector('#next-btn')?.addEventListener('click', () => {
    if (answerEffect === null) {
      goToNextQuestion();
    }
  });
}

async function initialize() {
  render();
  try {
    initialQuestions = await loadQuestionsFromDataFolder();
    questions = [...initialQuestions];
    loadingError = null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    loadingError = `問題データの読み込みに失敗しました: ${message}`;
    console.error(loadingError, error);
  } finally {
    loadingQuestions = false;
    render();
  }
}

void initialize();
