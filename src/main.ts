import './style.css';
import { getTileSvgPath } from './tileMap';

type Question = {
  questionId: string;
  discards: string[];
  correctCount: number;
  level?: string;
};

type GameState = 'ready' | 'playing' | 'result' | 'paused';
type AnswerEffect = 'correct' | 'incorrect' | null;
type Screen = 'title' | 'settings' | 'training';
type AudioSettings = {
  bgmVolume: number;
  bgmMuted: boolean;
  effectVolume: number;
  effectMuted: boolean;
};
type PauseAwareTimer = {
  timerId: number | null;
  startedAt: number;
  remainingMs: number;
  callback: (() => void) | null;
};

const correctEffectAudio = new Audio(new URL('../mp3/correct_pinpon.mp3', import.meta.url).href);
const incorrectEffectAudio = new Audio(new URL('../mp3/cancel_invalid.mp3', import.meta.url).href);
const titleLogoImage = new URL('../assets/logo_image.png', import.meta.url).href;
const AUDIO_SETTINGS_STORAGE_KEY = 'mahjong-suji-audio-settings';
const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  bgmVolume: 100,
  bgmMuted: false,
  effectVolume: 100,
  effectMuted: false,
};

const app = document.querySelector('#app') as HTMLElement | null;

if (!app) {
  throw new Error('App root not found');
}

const root = app;

let state: GameState = 'ready';
let screen: Screen = 'title';
let initialQuestions: Question[] = [];
let questions: Question[] = [];
let currentQuestion: Question | null = null;
let selectedAnswer: number | null = null;
let totalAnswerCount = 0;
let correctAnswerCount = 0;
let answerEffect: AnswerEffect = null;
let stateBeforePause: Exclude<GameState, 'paused'> = 'playing';
const answerEffectTimer: PauseAwareTimer = {
  timerId: null,
  startedAt: 0,
  remainingMs: 0,
  callback: null,
};
let audioSettings: AudioSettings = loadAudioSettings();
let isLoadingQuestions = true;
let questionLoadError: string | null = null;

applyEffectAudioSettings();

const QUESTION_FETCH_TIMEOUT_MS = 15000;
const QUESTION_INIT_TIMEOUT_MS = 20000;

function clampVolume(volume: number): number {
  return Math.min(100, Math.max(0, Math.round(volume)));
}

function loadAudioSettings(): AudioSettings {
  try {
    const raw = window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_AUDIO_SETTINGS };
    }
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      bgmVolume: clampVolume(Number(parsed.bgmVolume ?? DEFAULT_AUDIO_SETTINGS.bgmVolume)),
      bgmMuted: Boolean(parsed.bgmMuted),
      effectVolume: clampVolume(Number(parsed.effectVolume ?? DEFAULT_AUDIO_SETTINGS.effectVolume)),
      effectMuted: Boolean(parsed.effectMuted),
    };
  } catch (error: unknown) {
    console.error('Failed to load audio settings from localStorage.', error);
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

function saveAudioSettings(): void {
  try {
    window.localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(audioSettings));
  } catch (error: unknown) {
    console.error('Failed to save audio settings to localStorage.', error);
  }
}

function getEffectiveVolume(channel: 'bgm' | 'effect'): number {
  const isMuted = channel === 'bgm' ? audioSettings.bgmMuted : audioSettings.effectMuted;
  const volumePercent = channel === 'bgm' ? audioSettings.bgmVolume : audioSettings.effectVolume;
  if (isMuted) {
    return 0;
  }
  return clampVolume(volumePercent) / 100;
}

function applyEffectAudioSettings(): void {
  const effectVolume = getEffectiveVolume('effect');
  correctEffectAudio.volume = effectVolume;
  incorrectEffectAudio.volume = effectVolume;
}

function buildAssetPath(path: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return normalizedBase ? `${normalizedBase}/${normalizedPath}` : `/${normalizedPath}`;
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    return await response.json();
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Timed out after ${timeoutMs}ms while fetching ${url}`);
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

function normalizeQuestionRecord(record: unknown, fallbackId: string): Question | null {
  if (typeof record !== 'object' || record === null) {
    return null;
  }
  const raw = record as {
    questionId?: unknown;
    id?: unknown;
    discards?: unknown;
    correctCount?: unknown;
    correct_count?: unknown;
    level?: unknown;
  };
  const questionId = typeof raw.questionId === 'string' && raw.questionId.length > 0
    ? raw.questionId
    : typeof raw.id === 'string' && raw.id.length > 0
      ? raw.id
      : fallbackId;
  if (!Array.isArray(raw.discards) || !raw.discards.every((tile) => typeof tile === 'string')) {
    return null;
  }

  const correctCountRaw = raw.correctCount ?? raw.correct_count;
  const correctCount = Number(correctCountRaw);
  if (!Number.isInteger(correctCount)) {
    return null;
  }

  return {
    questionId,
    discards: raw.discards,
    correctCount,
    level: typeof raw.level === 'string' ? raw.level : undefined,
  };
}

async function fetchQuestionsFromDataRoot(dataRootPath: string): Promise<Question[]> {
  const indexUrl = buildAssetPath(`${dataRootPath}/index.json`);
  const filenames = await fetchJsonWithTimeout(indexUrl, QUESTION_FETCH_TIMEOUT_MS);
  if (!Array.isArray(filenames) || !filenames.every((name) => typeof name === 'string')) {
    throw new Error(`Invalid index.json format at ${indexUrl}`);
  }

  const filePromises = filenames.map(async (filename) => {
    const fileUrl = buildAssetPath(`${dataRootPath}/${filename}`);
    const fileData = await fetchJsonWithTimeout(fileUrl, QUESTION_FETCH_TIMEOUT_MS);
    if (!Array.isArray(fileData)) {
      throw new Error(`Invalid question array in ${fileUrl}`);
    }
    return { filename, fileData };
  });

  const fileResults = await Promise.all(filePromises);
  const loadedQuestions: Question[] = [];

  for (const { filename, fileData } of fileResults) {
    fileData.forEach((record, index) => {
      const normalized = normalizeQuestionRecord(record, `${filename}_${index}`);
      if (normalized) {
        loadedQuestions.push(normalized);
      }
    });
  }

  const deduped = new Map<string, Question>();
  loadedQuestions.forEach((question) => {
    if (!deduped.has(question.questionId)) {
      deduped.set(question.questionId, question);
    }
  });
  return Array.from(deduped.values());
}

async function loadQuestions(): Promise<Question[]> {
  const dataRoot = 'data';
  const loaded = await fetchQuestionsFromDataRoot(dataRoot);
  if (loaded.length === 0) {
    throw new Error(`No questions loaded from ${buildAssetPath(`${dataRoot}/index.json`)}`);
  }
  return loaded;
}

async function initializeQuestions(): Promise<void> {
  let initTimedOut = false;
  const initTimeout = window.setTimeout(() => {
    initTimedOut = true;
    isLoadingQuestions = false;
    questionLoadError = `問題データの読み込みがタイムアウトしました（${QUESTION_INIT_TIMEOUT_MS / 1000}秒）。再読み込みしてください。`;
    render();
  }, QUESTION_INIT_TIMEOUT_MS);

  isLoadingQuestions = true;
  questionLoadError = null;
  render();

  try {
    const loaded = await loadQuestions();
    if (initTimedOut) {
      return;
    }
    initialQuestions = loaded;
    questions = [...initialQuestions];
  } catch (error: unknown) {
    if (initTimedOut) {
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    questionLoadError = `問題データの読み込みに失敗しました: ${message}`;
    initialQuestions = [];
    questions = [];
    console.error('Failed to initialize questions.', error);
  } finally {
    window.clearTimeout(initTimeout);
    if (initTimedOut) {
      return;
    }
    isLoadingQuestions = false;
    render();
  }
}

function stopAnswerEffectTimer(): void {
  if (answerEffectTimer.timerId !== null) {
    window.clearTimeout(answerEffectTimer.timerId);
  }
  answerEffectTimer.timerId = null;
  answerEffectTimer.startedAt = 0;
  answerEffectTimer.remainingMs = 0;
  answerEffectTimer.callback = null;
}

function pauseAnswerEffectTimer(): void {
  if (answerEffectTimer.timerId === null) {
    return;
  }
  window.clearTimeout(answerEffectTimer.timerId);
  answerEffectTimer.timerId = null;
  const elapsed = Date.now() - answerEffectTimer.startedAt;
  answerEffectTimer.remainingMs = Math.max(0, answerEffectTimer.remainingMs - elapsed);
}

function resumeAnswerEffectTimer(): void {
  if (answerEffectTimer.timerId !== null || answerEffectTimer.callback === null || answerEffectTimer.remainingMs <= 0) {
    return;
  }
  answerEffectTimer.startedAt = Date.now();
  answerEffectTimer.timerId = window.setTimeout(() => {
    const callback = answerEffectTimer.callback;
    stopAnswerEffectTimer();
    callback?.();
  }, answerEffectTimer.remainingMs);
}

function startAnswerEffectTimer(durationMs: number, callback: () => void): void {
  stopAnswerEffectTimer();
  answerEffectTimer.remainingMs = durationMs;
  answerEffectTimer.callback = callback;
  resumeAnswerEffectTimer();
}

function pauseGameTimers(): void {
  pauseAnswerEffectTimer();
}

function resumeGameTimers(): void {
  resumeAnswerEffectTimer();
}

function pauseGame(): void {
  if (screen !== 'training' || state === 'ready' || state === 'paused') {
    return;
  }
  stateBeforePause = state;
  state = 'paused';
  pauseGameTimers();
  render();
}

function resumeGame(): void {
  if (state !== 'paused') {
    return;
  }
  state = stateBeforePause;
  resumeGameTimers();
  render();
}

function returnToTitleFromPause(): void {
  stopAnswerEffectTimer();
  answerEffect = null;
  state = 'ready';
  screen = 'title';
  questions = [...initialQuestions];
  currentQuestion = null;
  selectedAnswer = null;
  totalAnswerCount = 0;
  correctAnswerCount = 0;
  render();
}

function goToNextQuestion(): void {
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

function getRandomQuestion(): Question | null {
  if (questions.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * questions.length);
  const [chosen] = questions.splice(index, 1);
  return chosen ?? null;
}

function chunkDiscards(discards: string[]): string[][] {
  const chunkSize = discards.length >= 7 ? 6 : discards.length || 1;
  const rows: string[][] = [];

  for (let index = 0; index < discards.length; index += chunkSize) {
    rows.push(discards.slice(index, index + chunkSize));
  }

  return rows;
}

function playEffectAudio(effect: Exclude<AnswerEffect, null>): void {
  if (getEffectiveVolume('effect') === 0) {
    return;
  }
  const targetAudio = effect === 'correct' ? correctEffectAudio : incorrectEffectAudio;
  targetAudio.currentTime = 0;
  void targetAudio.play().catch((error: unknown) => {
    console.error(`Failed to play ${effect} effect audio.`, error);
  });
}

function render(): void {
  const accuracy = totalAnswerCount === 0 ? '---' : `${((correctAnswerCount / totalAnswerCount) * 100).toFixed(1)}%`;

  if (screen === 'settings') {
    root.innerHTML = `
      <div class="center-card">
        <div class="settings-screen">
          <h1 class="settings-title">サウンド設定</h1>
          <p class="settings-subtitle">BGMは現時点では未実装です。設定値は次回アクセス時にも保持されます。</p>

          <div class="audio-setting-card">
            <h2 class="audio-setting-title">BGM</h2>
            <div class="audio-control-row">
              <button class="mute-btn ${audioSettings.bgmMuted ? 'is-muted' : ''}" id="bgm-mute-btn" aria-label="BGMのミュート切り替え">
                ${audioSettings.bgmMuted ? '🔇' : '🔊'}
              </button>
              <input
                type="range"
                class="volume-slider"
                id="bgm-volume-slider"
                min="0"
                max="100"
                step="1"
                value="${audioSettings.bgmVolume}"
                aria-label="BGM音量"
              />
              <span class="volume-value">${audioSettings.bgmVolume}%</span>
            </div>
          </div>

          <div class="audio-setting-card">
            <h2 class="audio-setting-title">効果音</h2>
            <div class="audio-control-row">
              <button class="mute-btn ${audioSettings.effectMuted ? 'is-muted' : ''}" id="effect-mute-btn" aria-label="効果音のミュート切り替え">
                ${audioSettings.effectMuted ? '🔇' : '🔊'}
              </button>
              <input
                type="range"
                class="volume-slider"
                id="effect-volume-slider"
                min="0"
                max="100"
                step="1"
                value="${audioSettings.effectVolume}"
                aria-label="効果音音量"
              />
              <span class="volume-value">${audioSettings.effectVolume}%</span>
            </div>
          </div>

          <button class="next-btn" id="settings-back-btn">タイトルへ戻る</button>
        </div>
      </div>
    `;

    const bgmMuteButton = document.querySelector<HTMLButtonElement>('#bgm-mute-btn');
    bgmMuteButton?.addEventListener('click', () => {
      audioSettings = { ...audioSettings, bgmMuted: !audioSettings.bgmMuted };
      saveAudioSettings();
      render();
    });

    const effectMuteButton = document.querySelector<HTMLButtonElement>('#effect-mute-btn');
    effectMuteButton?.addEventListener('click', () => {
      audioSettings = { ...audioSettings, effectMuted: !audioSettings.effectMuted };
      saveAudioSettings();
      applyEffectAudioSettings();
      render();
    });

    const bgmVolumeSlider = document.querySelector<HTMLInputElement>('#bgm-volume-slider');
    bgmVolumeSlider?.addEventListener('input', () => {
      audioSettings = { ...audioSettings, bgmVolume: clampVolume(Number(bgmVolumeSlider.value)) };
      saveAudioSettings();
      render();
    });

    const effectVolumeSlider = document.querySelector<HTMLInputElement>('#effect-volume-slider');
    effectVolumeSlider?.addEventListener('input', () => {
      audioSettings = { ...audioSettings, effectVolume: clampVolume(Number(effectVolumeSlider.value)) };
      saveAudioSettings();
      applyEffectAudioSettings();
      render();
    });

    const backButton = document.querySelector<HTMLButtonElement>('#settings-back-btn');
    backButton?.addEventListener('click', () => {
      screen = 'title';
      render();
    });
    return;
  }

  if (screen === 'title' || state === 'ready') {
    root.innerHTML = `
      <div class="center-card">
        <div class="start-screen">
          <button class="settings-open-btn" id="settings-open-btn" aria-label="設定画面を開く">
            <span class="settings-gear-icon" aria-hidden="true">⚙</span>
          </button>
          <img class="title-logo-image" src="${titleLogoImage}" alt="麻雀筋トレ ロゴ" />
          <p class="subtitle">捨て牌から残っているスジ候補数を数えるMVPトレーニングです。</p>
          <button class="start-btn" id="start-btn" ${isLoadingQuestions || questionLoadError ? 'disabled' : ''}>トレーニング開始</button>
          ${isLoadingQuestions ? '<p class="status-note">問題データを読み込み中です...</p>' : ''}
          ${questionLoadError ? `<p class="error-note">${questionLoadError}</p><button class="next-btn" id="retry-load-btn">再読み込み</button>` : ''}
        </div>
      </div>
    `;

    const startButton = document.querySelector('#start-btn');
    startButton?.addEventListener('click', startGame);
    const settingsOpenButton = document.querySelector<HTMLButtonElement>('#settings-open-btn');
    settingsOpenButton?.addEventListener('click', () => {
      screen = 'settings';
      render();
    });
    const retryLoadButton = document.querySelector<HTMLButtonElement>('#retry-load-btn');
    retryLoadButton?.addEventListener('click', () => {
      void initializeQuestions();
    });
    return;
  }

  const isPaused = state === 'paused';
  const isEffectActive = answerEffect !== null;
  const isAnswerLocked = state === 'result' || isEffectActive || isPaused;
  const discardRows = chunkDiscards(currentQuestion?.discards ?? []);

  root.innerHTML = `
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
        <button class="pause-btn" id="pause-btn" aria-label="一時停止" ${isPaused ? 'disabled' : ''}>
          <span class="pause-icon" aria-hidden="true">⏸</span>
        </button>
      </header>

      <main class="board">
        <div class="tile-area ${isEffectActive ? 'answer-effect' : ''}">
          ${isPaused ? `
            <div class="pause-overlay" aria-live="polite" aria-label="一時停止中">
              <p class="pause-title">Pause</p>
              <div class="pause-actions">
                <button class="next-btn pause-action-btn" id="pause-title-btn">タイトルに戻る</button>
                <button class="confirm-btn pause-action-btn" id="pause-resume-btn">ゲームを続行する</button>
              </div>
            </div>
          ` : isEffectActive ? `
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
            const isSelected = selectedAnswer === value;
            return `<button class="answer-btn ${isSelected ? 'selected' : ''}" data-value="${value}" ${isAnswerLocked ? 'disabled' : ''}>${value}</button>`;
          }).join('')}
          <button class="answer-btn enter-btn" id="quick-confirm-btn" aria-label="回答を確定" ${selectedAnswer === null || isAnswerLocked ? 'disabled' : ''}>
            <span class="enter-icon" aria-hidden="true"></span>
          </button>
        </div>

        <div class="action-buttons">
          <button class="confirm-btn" id="confirm-btn" ${selectedAnswer === null || isAnswerLocked ? 'disabled' : ''}>
            回答を確定
          </button>
          <button class="next-btn" id="next-btn" ${isEffectActive ? 'disabled' : ''}>次の問題へ</button>
        </div>
      </main>
    </div>
  `;

  document.querySelectorAll<HTMLButtonElement>('.answer-btn[data-value]').forEach((button) => {
    button.addEventListener('click', () => {
      if (state === 'result' || answerEffect !== null) {
        return;
      }
      const raw = button.dataset.value;
      const parsed = raw === undefined ? Number.NaN : Number(raw);
      if (!Number.isFinite(parsed)) {
        return;
      }
      selectedAnswer = parsed;
      render();
    });
  });

  const submitCurrentAnswer = (): void => {
    if (selectedAnswer === null || !currentQuestion || state === 'result' || answerEffect !== null) {
      return;
    }

    totalAnswerCount += 1;
    const isCorrect = selectedAnswer === currentQuestion.correctCount;
    state = 'result';
    answerEffect = isCorrect ? 'correct' : 'incorrect';
    playEffectAudio(answerEffect);
    if (isCorrect) {
      correctAnswerCount += 1;
    }
    render();

    if (isCorrect) {
      startAnswerEffectTimer(2000, () => {
        goToNextQuestion();
      });
      return;
    }

    startAnswerEffectTimer(1000, () => {
      answerEffect = null;
      state = 'playing';
      selectedAnswer = null;
      render();
    });
  };

  const confirmButton = document.querySelector('#confirm-btn');
  confirmButton?.addEventListener('click', submitCurrentAnswer);

  const quickConfirmButton = document.querySelector('#quick-confirm-btn');
  quickConfirmButton?.addEventListener('click', submitCurrentAnswer);

  const nextButton = document.querySelector('#next-btn');
  nextButton?.addEventListener('click', () => {
    if (answerEffect !== null) {
      return;
    }
    goToNextQuestion();
  });

  const pauseButton = document.querySelector<HTMLButtonElement>('#pause-btn');
  pauseButton?.addEventListener('click', () => {
    pauseGame();
  });

  const pauseTitleButton = document.querySelector<HTMLButtonElement>('#pause-title-btn');
  pauseTitleButton?.addEventListener('click', () => {
    returnToTitleFromPause();
  });

  const pauseResumeButton = document.querySelector<HTMLButtonElement>('#pause-resume-btn');
  pauseResumeButton?.addEventListener('click', () => {
    resumeGame();
  });
}

function startGame(): void {
  stopAnswerEffectTimer();
  answerEffect = null;
  screen = 'training';
  questions = [...initialQuestions];
  currentQuestion = getRandomQuestion();
  selectedAnswer = null;
  totalAnswerCount = 0;
  correctAnswerCount = 0;
  state = currentQuestion ? 'playing' : 'ready';
  render();
}

render();
void initializeQuestions();
