import './style.css';
import { getTileSvgPath } from './tileMap';
import {
  TIME_CHALLENGE_FAST_BONUS_SECONDS,
  TIME_CHALLENGE_FAST_BONUS_THRESHOLD_SECONDS,
  TIME_CHALLENGE_INCORRECT_PENALTY_SECONDS,
  TIME_CHALLENGE_INITIAL_TIME_SECONDS,
  TIME_CHALLENGE_MID_BONUS_SECONDS,
  TIME_CHALLENGE_MID_BONUS_THRESHOLD_SECONDS,
  TIME_CHALLENGE_QUESTION_GAUGE_MAX_SECONDS,
  TIME_CHALLENGE_STREAK_BONUS_MULTIPLIER_SECONDS,
  TIME_CHALLENGE_STREAK_STEP,
} from './gameConfig';

type Question = {
  questionId: string;
  discards: string[];
  correctCount: number;
  level?: string | number;
};

type GameState = 'ready' | 'countdown' | 'playing' | 'result' | 'paused';
type AnswerEffect = 'correct' | 'incorrect' | null;
type Screen = 'title' | 'settings' | 'modeSelect' | 'training' | 'timeAttackResult' | 'timeChallengeResult';
type GameMode = 'training' | 'timeChallenge' | 'timeAttack';
type Difficulty = 'easy' | 'advanced' | 'expert';
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
type CountdownState = {
  isActive: boolean;
  labels: string[];
  currentIndex: number;
  timerId: number | null;
  stepMs: number;
  onComplete: (() => void) | null;
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

function stopCountdown(): void {
  if (countdownState.timerId !== null) {
    window.clearTimeout(countdownState.timerId);
  }
  countdownState.isActive = false;
  countdownState.labels = [];
  countdownState.currentIndex = 0;
  countdownState.timerId = null;
  countdownState.stepMs = GAME_START_COUNTDOWN_STEP_MS;
  countdownState.onComplete = null;
}

function advanceCountdown(): void {
  if (!countdownState.isActive) {
    return;
  }
  if (countdownState.currentIndex >= countdownState.labels.length) {
    const callback = countdownState.onComplete;
    stopCountdown();
    callback?.();
    return;
  }
  render();
  countdownState.timerId = window.setTimeout(() => {
    countdownState.currentIndex += 1;
    advanceCountdown();
  }, countdownState.stepMs);
}

function startCountdown(labels: string[], stepMs: number, onComplete: () => void): void {
  stopCountdown();
  countdownState.isActive = true;
  countdownState.labels = labels;
  countdownState.currentIndex = 0;
  countdownState.stepMs = stepMs;
  countdownState.onComplete = onComplete;
  state = 'countdown';
  advanceCountdown();
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
let isHowToModalOpen = false;
let selectedGameMode: GameMode = 'training';
let selectedDifficulty: Difficulty = 'expert';
let modeSelectError: string | null = null;
let timeAttackAnsweredCount = 0;
let timeAttackIncorrectCount = 0;
let timeAttackElapsedMs = 0;
let timeAttackPenaltyMs = 0;
let timeAttackStartedAt: number | null = null;
let timeAttackTickTimerId: number | null = null;
let timeAttackResultTimeMs = 0;
let timeAttackPenaltyNoticeUntil = 0;
let timeChallengeRemainingMs = TIME_CHALLENGE_INITIAL_TIME_SECONDS * 1000;
let timeChallengeQuestionStartedAt: number | null = null;
let timeChallengeTickTimerId: number | null = null;
let timeChallengeNoticeReason = '';
let timeChallengeNoticeAmount = '';
let timeChallengeNoticeVariant: 'bonus' | 'penalty' | null = null;
let timeChallengeNoticeUntil = 0;
let timeChallengeResultCorrectCount = 0;
let timeChallengeResultIncorrectCount = 0;
const countdownState: CountdownState = {
  isActive: false,
  labels: [],
  currentIndex: 0,
  timerId: null,
  stepMs: 700,
  onComplete: null,
};

applyEffectAudioSettings();
applyUiAssetPaths();

const QUESTION_FETCH_TIMEOUT_MS = 15000;
const QUESTION_INIT_TIMEOUT_MS = 20000;
const GAME_START_COUNTDOWN_LABELS = ['3', '2', '1', 'START!'];
const GAME_START_COUNTDOWN_STEP_MS = 700;
const TIME_ATTACK_QUESTION_LIMIT = 20;
const TIME_ATTACK_INCORRECT_PENALTY_MS = 5000;
const TIME_ATTACK_TICK_INTERVAL_MS = 30;
const TIME_CHALLENGE_INCORRECT_PENALTY_MS = TIME_CHALLENGE_INCORRECT_PENALTY_SECONDS * 1000;
const TIME_CHALLENGE_QUESTION_GAUGE_MAX_MS = TIME_CHALLENGE_QUESTION_GAUGE_MAX_SECONDS * 1000;
const TIME_CHALLENGE_TICK_INTERVAL_MS = 30;
const GAME_MODE_DESCRIPTIONS: Record<GameMode, string> = {
  training: '正解・不正解を確認しながら、次へボタンで進む練習モードです。',
  timeAttack: '20問正解するまでのタイムを競います。不正解時は +5秒 ペナルティです。',
  timeChallenge: '制限時間内に正解数を伸ばします。不正解時は -5秒、正解時はボーナスがあります。',
};
const DIFFICULTY_DESCRIPTIONS: Record<Difficulty, string> = {
  easy: '<strong>Easy:</strong><br>捨牌に萬子/筒子/索子のうち<strong>一色のみ</strong>が含まれる問題を出題します。',
  advanced: '<strong>Advanced:</strong><br>捨牌に萬子/筒子/索子のうち<strong>二色まで</strong>が含まれる問題を出題します。',
  expert: '<strong>Expert:</strong><br>収録されている<strong>すべての問題</strong>から出題されます。',
};

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

function applyUiAssetPaths(): void {
  document.documentElement.style.setProperty(
    '--return-icon-url',
    `url("${buildAssetPath('icons/return_symbol_u23ce_filled.svg')}")`,
  );
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
    level: typeof raw.level === 'string' || typeof raw.level === 'number' ? raw.level : undefined,
  };
}

function parseQuestionLevelRank(level: Question['level']): number | null {
  if (typeof level === 'number' && Number.isFinite(level)) {
    return level;
  }
  if (typeof level !== 'string') {
    return null;
  }
  const normalized = level.trim().toLowerCase();
  if (normalized.length === 0) {
    return null;
  }
  const parsed = Number(normalized);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  if (normalized === 'beginner' || normalized === 'easy') {
    return 1;
  }
  if (normalized === 'intermediate') {
    return 2;
  }
  if (normalized === 'advanced') {
    return 3;
  }
  return null;
}

function filterQuestionsByDifficulty(allQuestions: Question[], difficulty: Difficulty): Question[] {
  if (difficulty === 'expert') {
    return [...allQuestions];
  }
  const maxRank = difficulty === 'easy' ? 1 : 2;
  return allQuestions.filter((question) => {
    const rank = parseQuestionLevelRank(question.level);
    return rank !== null && rank <= maxRank;
  });
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
  if (selectedGameMode === 'timeAttack') {
    pauseTimeAttackClock();
    stopTimeAttackTickTimer();
  } else if (selectedGameMode === 'timeChallenge') {
    pauseTimeChallengeClock();
    stopTimeChallengeTickTimer();
  }
}

function resumeGameTimers(): void {
  resumeAnswerEffectTimer();
  if (selectedGameMode === 'timeAttack' && stateBeforePause === 'playing') {
    startTimeAttackClock();
  } else if (selectedGameMode === 'timeChallenge' && stateBeforePause === 'playing') {
    startTimeChallengeQuestionTimer();
  }
}

function pauseGame(): void {
  if (screen !== 'training' || state === 'ready' || state === 'countdown' || state === 'paused') {
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
  stopCountdown();
  pauseTimeAttackClock();
  stopTimeAttackTickTimer();
  answerEffect = null;
  state = 'ready';
  screen = 'title';
  questions = [...initialQuestions];
  currentQuestion = null;
  selectedAnswer = null;
  totalAnswerCount = 0;
  correctAnswerCount = 0;
  resetTimeAttackState();
  resetTimeChallengeState();
  render();
}

function goToNextQuestion(): void {
  stopAnswerEffectTimer();
  stopCountdown();
  answerEffect = null;

  if (selectedGameMode === 'timeAttack' && timeAttackAnsweredCount >= TIME_ATTACK_QUESTION_LIMIT) {
    finishTimeAttack();
    return;
  }
  if (selectedGameMode === 'timeChallenge' && getTimeChallengeRemainingMs() <= 0) {
    finishTimeChallenge();
    return;
  }

  const nextQuestion = getRandomQuestion();
  if (!nextQuestion) {
    if (selectedGameMode === 'timeAttack') {
      finishTimeAttack();
      return;
    }
    currentQuestion = null;
    questions = [...initialQuestions];
    selectedAnswer = null;
    state = 'ready';
    screen = 'title';
    render();
    return;
  }

  currentQuestion = nextQuestion;
  selectedAnswer = null;
  state = 'playing';
  if (selectedGameMode === 'timeChallenge') {
    timeChallengeQuestionStartedAt = Date.now();
  }
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

function resetTimeAttackState(): void {
  timeAttackAnsweredCount = 0;
  timeAttackIncorrectCount = 0;
  timeAttackElapsedMs = 0;
  timeAttackPenaltyMs = 0;
  timeAttackStartedAt = null;
  timeAttackResultTimeMs = 0;
  timeAttackPenaltyNoticeUntil = 0;
  stopTimeAttackTickTimer();
}

function resetTimeChallengeState(): void {
  timeChallengeRemainingMs = TIME_CHALLENGE_INITIAL_TIME_SECONDS * 1000;
  timeChallengeQuestionStartedAt = null;
  timeChallengeNoticeReason = '';
  timeChallengeNoticeAmount = '';
  timeChallengeNoticeVariant = null;
  timeChallengeNoticeUntil = 0;
  timeChallengeResultCorrectCount = 0;
  timeChallengeResultIncorrectCount = 0;
  stopTimeChallengeTickTimer();
}

function stopTimeAttackTickTimer(): void {
  if (timeAttackTickTimerId !== null) {
    window.clearInterval(timeAttackTickTimerId);
    timeAttackTickTimerId = null;
  }
}

function stopTimeChallengeTickTimer(): void {
  if (timeChallengeTickTimerId !== null) {
    window.clearInterval(timeChallengeTickTimerId);
    timeChallengeTickTimerId = null;
  }
}

function startTimeAttackTickTimer(): void {
  if (timeAttackTickTimerId !== null) {
    return;
  }
  timeAttackTickTimerId = window.setInterval(() => {
    updateTimeAttackElapsedDisplay();
  }, TIME_ATTACK_TICK_INTERVAL_MS);
}

function startTimeChallengeTickTimer(): void {
  if (timeChallengeTickTimerId !== null) {
    return;
  }
  timeChallengeTickTimerId = window.setInterval(() => {
    updateTimeChallengeDisplay();
  }, TIME_CHALLENGE_TICK_INTERVAL_MS);
}

function startTimeAttackClock(): void {
  if (timeAttackStartedAt !== null) {
    return;
  }
  timeAttackStartedAt = Date.now();
  startTimeAttackTickTimer();
}

function startTimeChallengeQuestionTimer(): void {
  if (timeChallengeQuestionStartedAt !== null) {
    return;
  }
  timeChallengeQuestionStartedAt = Date.now();
  startTimeChallengeTickTimer();
}

function pauseTimeAttackClock(): void {
  if (timeAttackStartedAt === null) {
    return;
  }
  timeAttackElapsedMs += Date.now() - timeAttackStartedAt;
  timeAttackStartedAt = null;
}

function pauseTimeChallengeClock(): void {
  if (timeChallengeQuestionStartedAt === null) {
    return;
  }
  const elapsed = Date.now() - timeChallengeQuestionStartedAt;
  timeChallengeRemainingMs = Math.max(0, timeChallengeRemainingMs - elapsed);
  timeChallengeQuestionStartedAt = null;
}

function getTimeAttackTotalMs(): number {
  const runningElapsed = timeAttackStartedAt === null ? 0 : Date.now() - timeAttackStartedAt;
  return timeAttackElapsedMs + runningElapsed + timeAttackPenaltyMs;
}

function getTimeChallengeRemainingMs(): number {
  const runningElapsed = timeChallengeQuestionStartedAt === null ? 0 : Date.now() - timeChallengeQuestionStartedAt;
  return Math.max(0, timeChallengeRemainingMs - runningElapsed);
}

function updateTimeAttackElapsedDisplay(): void {
  if (screen !== 'training' || selectedGameMode !== 'timeAttack' || state !== 'playing') {
    return;
  }
  const elapsedElement = document.querySelector<HTMLElement>('#time-attack-elapsed');
  if (!elapsedElement) {
    return;
  }
  elapsedElement.textContent = formatTimeAttackMs(getTimeAttackTotalMs());
  updateTimeAttackPenaltyDisplay();
}

function getTimeChallengeQuestionElapsedMs(): number {
  if (timeChallengeQuestionStartedAt === null) {
    return 0;
  }
  return Date.now() - timeChallengeQuestionStartedAt;
}

function updateTimeChallengeDisplay(): void {
  if (screen !== 'training' || selectedGameMode !== 'timeChallenge' || state !== 'playing') {
    return;
  }
  const remainingMs = getTimeChallengeRemainingMs();
  const remainingElement = document.querySelector<HTMLElement>('#time-challenge-remaining');
  if (remainingElement) {
    remainingElement.textContent = formatTimeChallengeRemainingMs(remainingMs);
  }
  const gaugeFill = document.querySelector<HTMLElement>('#time-challenge-gauge-fill');
  if (gaugeFill) {
    const elapsedMs = getTimeChallengeQuestionElapsedMs();
    const ratio = Math.max(0, 1 - (elapsedMs / TIME_CHALLENGE_QUESTION_GAUGE_MAX_MS));
    gaugeFill.style.width = `${Math.round(ratio * 100)}%`;
  }
  updateTimeChallengeNoticeDisplay();

  if (remainingMs <= 0) {
    finishTimeChallenge();
  }
}

function updateTimeAttackPenaltyDisplay(): void {
  const penaltyElement = document.querySelector<HTMLElement>('#time-attack-penalty');
  if (!penaltyElement) {
    return;
  }
  const shouldShow = screen === 'training'
    && selectedGameMode === 'timeAttack'
    && Date.now() < timeAttackPenaltyNoticeUntil;
  penaltyElement.classList.toggle('is-visible', shouldShow);
}

function updateTimeChallengeNoticeDisplay(): void {
  const reasonElement = document.querySelector<HTMLElement>('#time-challenge-notice-reason');
  const amountElement = document.querySelector<HTMLElement>('#time-challenge-notice-amount');
  if (!reasonElement || !amountElement) {
    return;
  }
  const showNotice = screen === 'training'
    && selectedGameMode === 'timeChallenge'
    && timeChallengeNoticeVariant !== null
    && timeChallengeNoticeReason.length > 0
    && timeChallengeNoticeAmount.length > 0
    && Date.now() < timeChallengeNoticeUntil;

  const noticeClass = timeChallengeNoticeVariant === 'penalty' ? 'time-attack-penalty' : 'time-attack-bonus';
  reasonElement.className = `time-challenge-notice ${noticeClass} ${showNotice ? 'is-visible' : ''}`;
  amountElement.className = `time-challenge-notice ${noticeClass} ${showNotice ? 'is-visible' : ''}`;
  reasonElement.textContent = timeChallengeNoticeReason;
  amountElement.textContent = timeChallengeNoticeAmount;
}

function formatTimeAttackMs(totalMs: number): string {
  const clamped = Math.max(0, Math.floor(totalMs));
  const minutes = Math.floor(clamped / 60000);
  const seconds = Math.floor((clamped % 60000) / 1000);
  const centiseconds = Math.floor((clamped % 1000) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(centiseconds).padStart(2, '0')}`;
}

function formatTimeChallengeRemainingMs(totalMs: number): string {
  const clamped = Math.max(0, Math.floor(totalMs));
  const totalSeconds = Math.floor(clamped / 1000);
  const centiseconds = Math.floor((clamped % 1000) / 10);
  return `${String(totalSeconds).padStart(2, '0')}:${String(centiseconds).padStart(2, '0')}`;
}

function addTimeChallengeBonus(seconds: number, label: string): void {
  if (seconds <= 0) {
    return;
  }
  timeChallengeRemainingMs += seconds * 1000;
  setTimeChallengeNotice(label, `+${seconds}秒`, 'bonus');
}

function setTimeChallengeNotice(
  reason: string,
  amount: string,
  variant: 'bonus' | 'penalty',
  durationMs = 1200,
): void {
  timeChallengeNoticeReason = reason;
  timeChallengeNoticeAmount = amount;
  timeChallengeNoticeVariant = variant;
  timeChallengeNoticeUntil = Date.now() + durationMs;
  updateTimeChallengeNoticeDisplay();
}

function finishTimeAttack(): void {
  pauseTimeAttackClock();
  stopTimeAttackTickTimer();
  timeAttackResultTimeMs = getTimeAttackTotalMs();
  state = 'ready';
  screen = 'timeAttackResult';
  answerEffect = null;
  selectedAnswer = null;
  currentQuestion = null;
  render();
}

function finishTimeChallenge(): void {
  pauseTimeChallengeClock();
  stopTimeChallengeTickTimer();
  timeChallengeResultCorrectCount = correctAnswerCount;
  timeChallengeResultIncorrectCount = totalAnswerCount - correctAnswerCount;
  state = 'ready';
  screen = 'timeChallengeResult';
  answerEffect = null;
  selectedAnswer = null;
  currentQuestion = null;
  render();
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

  if (screen === 'title') {
    root.innerHTML = `
      <div class="center-card">
        <div class="start-screen">
          <button class="settings-open-btn" id="settings-open-btn" aria-label="設定画面を開く">
            <span class="settings-gear-icon" aria-hidden="true">⚙</span>
          </button>
          <img class="title-logo-image" src="${titleLogoImage}" alt="麻雀筋トレ ロゴ" />
          <p class="subtitle">捨て牌から残っているスジ候補数を数えるMVPトレーニングです。</p>
          <button class="start-btn" id="start-btn" ${isLoadingQuestions || questionLoadError ? 'disabled' : ''}>トレーニング開始</button>
          <button class="next-btn how-to-btn" id="how-to-btn">遊び方</button>
          ${isLoadingQuestions ? '<p class="status-note">問題データを読み込み中です...</p>' : ''}
          ${questionLoadError ? `<p class="error-note">${questionLoadError}</p><button class="next-btn" id="retry-load-btn">再読み込み</button>` : ''}
          ${isHowToModalOpen ? `
            <div class="how-to-overlay" role="dialog" aria-modal="true" aria-labelledby="how-to-title">
              <div class="how-to-modal">
                <button class="how-to-close-btn" id="how-to-close-btn" aria-label="遊び方を閉じる">×</button>
                <h2 class="how-to-title" id="how-to-title">遊び方</h2>
                <p class="how-to-text">ここに遊び方の説明文を記載します。</p>
                <ul class="how-to-list">
                  <li>捨て牌を見て、残っているスジ候補数を数えます。</li>
                  <li>下の数字ボタンから回答を選んで確定します。</li>
                  <li>正解・不正解の表示後、次の問題へ進みます。</li>
                </ul>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    const startButton = document.querySelector('#start-btn');
    startButton?.addEventListener('click', () => {
      isHowToModalOpen = false;
      modeSelectError = null;
      screen = 'modeSelect';
      render();
    });
    const settingsOpenButton = document.querySelector<HTMLButtonElement>('#settings-open-btn');
    settingsOpenButton?.addEventListener('click', () => {
      isHowToModalOpen = false;
      screen = 'settings';
      render();
    });
    const howToButton = document.querySelector<HTMLButtonElement>('#how-to-btn');
    howToButton?.addEventListener('click', () => {
      isHowToModalOpen = true;
      render();
    });
    const howToCloseButton = document.querySelector<HTMLButtonElement>('#how-to-close-btn');
    howToCloseButton?.addEventListener('click', () => {
      isHowToModalOpen = false;
      render();
    });
    const retryLoadButton = document.querySelector<HTMLButtonElement>('#retry-load-btn');
    retryLoadButton?.addEventListener('click', () => {
      void initializeQuestions();
    });
    return;
  }

  if (screen === 'modeSelect') {
    root.innerHTML = `
      <div class="center-card">
        <div class="mode-select-screen">
          <h1 class="mode-select-title">モード・難易度選択</h1>

          <section class="mode-select-section">
            <h2 class="mode-select-heading">ゲームモード</h2>
            <div class="mode-select-grid">
              <button class="mode-option-btn ${selectedGameMode === 'timeChallenge' ? 'is-selected' : ''}" id="mode-time-challenge-btn">チャレンジモード</button>
              <button class="mode-option-btn ${selectedGameMode === 'timeAttack' ? 'is-selected' : ''}" id="mode-time-attack-btn">タイムアタックモード</button>
              <button class="mode-option-btn ${selectedGameMode === 'training' ? 'is-selected' : ''}" id="mode-training-btn">トレーニングモード</button>
            </div>
            <p class="mode-select-description">${GAME_MODE_DESCRIPTIONS[selectedGameMode]}</p>
          </section>

          <section class="mode-select-section">
            <h2 class="mode-select-heading">難易度</h2>
            <div class="mode-select-grid mode-select-grid-difficulty">
              <button class="mode-option-btn mode-option-btn-compact ${selectedDifficulty === 'easy' ? 'is-selected' : ''}" id="difficulty-easy-btn">Easy</button>
              <button class="mode-option-btn mode-option-btn-compact ${selectedDifficulty === 'advanced' ? 'is-selected' : ''}" id="difficulty-advanced-btn">advanced</button>
              <button class="mode-option-btn mode-option-btn-compact ${selectedDifficulty === 'expert' ? 'is-selected' : ''}" id="difficulty-expert-btn">Expert</button>
            </div>
            <p class="mode-select-description">${DIFFICULTY_DESCRIPTIONS[selectedDifficulty]}</p>
          </section>

          ${modeSelectError ? `<p class="error-note">${modeSelectError}</p>` : ''}

          <div class="mode-select-actions">
            <button class="start-btn" id="mode-select-start-btn">ゲーム開始</button>
            <button class="next-btn" id="mode-select-back-btn">タイトルへ戻る</button>
          </div>
        </div>
      </div>
    `;

    const trainingModeButton = document.querySelector<HTMLButtonElement>('#mode-training-btn');
    trainingModeButton?.addEventListener('click', () => {
      selectedGameMode = 'training';
      modeSelectError = null;
      render();
    });
    const timeAttackModeButton = document.querySelector<HTMLButtonElement>('#mode-time-attack-btn');
    timeAttackModeButton?.addEventListener('click', () => {
      selectedGameMode = 'timeAttack';
      modeSelectError = null;
      render();
    });
    const timeChallengeModeButton = document.querySelector<HTMLButtonElement>('#mode-time-challenge-btn');
    timeChallengeModeButton?.addEventListener('click', () => {
      selectedGameMode = 'timeChallenge';
      modeSelectError = null;
      render();
    });

    const difficultyEasyButton = document.querySelector<HTMLButtonElement>('#difficulty-easy-btn');
    difficultyEasyButton?.addEventListener('click', () => {
      selectedDifficulty = 'easy';
      modeSelectError = null;
      render();
    });

    const difficultyAdvancedButton = document.querySelector<HTMLButtonElement>('#difficulty-advanced-btn');
    difficultyAdvancedButton?.addEventListener('click', () => {
      selectedDifficulty = 'advanced';
      modeSelectError = null;
      render();
    });

    const difficultyExpertButton = document.querySelector<HTMLButtonElement>('#difficulty-expert-btn');
    difficultyExpertButton?.addEventListener('click', () => {
      selectedDifficulty = 'expert';
      modeSelectError = null;
      render();
    });

    const modeSelectStartButton = document.querySelector<HTMLButtonElement>('#mode-select-start-btn');
    modeSelectStartButton?.addEventListener('click', startGame);

    const modeSelectBackButton = document.querySelector<HTMLButtonElement>('#mode-select-back-btn');
    modeSelectBackButton?.addEventListener('click', () => {
      modeSelectError = null;
      screen = 'title';
      render();
    });
    return;
  }

  if (screen === 'timeAttackResult') {
    root.innerHTML = `
      <div class="center-card">
        <div class="mode-select-screen">
          <h1 class="mode-select-title">time attack 結果</h1>
          <section class="mode-select-section">
            <h2 class="mode-select-heading">タイム</h2>
            <p class="time-attack-result-value">${formatTimeAttackMs(timeAttackResultTimeMs)}</p>
          </section>
          <section class="mode-select-section">
            <h2 class="mode-select-heading">不正解数</h2>
            <p class="time-attack-result-value">${timeAttackIncorrectCount}</p>
          </section>
          <div class="mode-select-actions">
            <button class="start-btn" id="time-attack-retry-btn">もう一度プレイ</button>
            <button class="next-btn" id="time-attack-title-btn">タイトルへ戻る</button>
          </div>
        </div>
      </div>
    `;

    const retryButton = document.querySelector<HTMLButtonElement>('#time-attack-retry-btn');
    retryButton?.addEventListener('click', startGame);
    const titleButton = document.querySelector<HTMLButtonElement>('#time-attack-title-btn');
    titleButton?.addEventListener('click', () => {
      screen = 'title';
      state = 'ready';
      resetTimeAttackState();
      render();
    });
    return;
  }

  if (screen === 'timeChallengeResult') {
    root.innerHTML = `
      <div class="center-card">
        <div class="mode-select-screen">
          <h1 class="mode-select-title">time challenge 結果</h1>
          <section class="mode-select-section">
            <h2 class="mode-select-heading">正解数</h2>
            <p class="time-attack-result-value">${timeChallengeResultCorrectCount}</p>
          </section>
          <section class="mode-select-section">
            <h2 class="mode-select-heading">不正解数</h2>
            <p class="time-attack-result-value">${timeChallengeResultIncorrectCount}</p>
          </section>
          <div class="mode-select-actions">
            <button class="start-btn" id="time-challenge-retry-btn">もう一度プレイ</button>
            <button class="next-btn" id="time-challenge-title-btn">タイトルへ戻る</button>
          </div>
        </div>
      </div>
    `;

    const retryButton = document.querySelector<HTMLButtonElement>('#time-challenge-retry-btn');
    retryButton?.addEventListener('click', startGame);
    const titleButton = document.querySelector<HTMLButtonElement>('#time-challenge-title-btn');
    titleButton?.addEventListener('click', () => {
      screen = 'title';
      state = 'ready';
      resetTimeChallengeState();
      render();
    });
    return;
  }

  const isPaused = state === 'paused';
  const isCountdown = state === 'countdown' && countdownState.isActive;
  const isEffectActive = answerEffect !== null;
  const isAnswerLocked = state === 'result' || isEffectActive || isPaused || isCountdown;
  const discardRows = chunkDiscards(currentQuestion?.discards ?? []);
  const countdownLabel = countdownState.labels[countdownState.currentIndex] ?? '';
  const isTimeAttack = selectedGameMode === 'timeAttack';
  const isTimeChallenge = selectedGameMode === 'timeChallenge';
  const timeAttackDisplayBase = state === 'result' ? timeAttackAnsweredCount : timeAttackAnsweredCount + 1;
  const timeAttackDisplayCount = Math.min(Math.max(timeAttackDisplayBase, 1), TIME_ATTACK_QUESTION_LIMIT);
  const headerQuestionProgress = `${String(timeAttackDisplayCount).padStart(2, '0')}/${TIME_ATTACK_QUESTION_LIMIT}`;
  const headerElapsedTime = formatTimeAttackMs(getTimeAttackTotalMs());
  const timeChallengeRemainingDisplay = formatTimeChallengeRemainingMs(getTimeChallengeRemainingMs());
  const questionGaugeRatio = isTimeChallenge
    ? Math.max(0, 1 - (getTimeChallengeQuestionElapsedMs() / TIME_CHALLENGE_QUESTION_GAUGE_MAX_MS))
    : 0;
  const questionGaugePercent = Math.round(questionGaugeRatio * 100);
  const showTimeChallengeNotice = Date.now() < timeChallengeNoticeUntil
    && timeChallengeNoticeVariant !== null
    && timeChallengeNoticeReason.length > 0
    && timeChallengeNoticeAmount.length > 0;
  const timeChallengeNoticeClass = timeChallengeNoticeVariant === 'penalty' ? 'time-attack-penalty' : 'time-attack-bonus';
  const showTimeAttackPenalty = Date.now() < timeAttackPenaltyNoticeUntil;

  root.innerHTML = `
    <div class="app">
      <header class="status-bar ${isTimeChallenge ? 'status-bar-time-challenge' : ''}">
        ${isTimeAttack ? `
        <div class="status-item">
          <span class="status-label">問題</span>
          <span class="status-value">${headerQuestionProgress}</span>
        </div>
        <div class="status-item">
          <span class="status-label">経過時間</span>
          <span class="status-value time-attack-time-row">
            <span id="time-attack-elapsed">${headerElapsedTime}</span>
            <span class="time-attack-penalty ${showTimeAttackPenalty ? 'is-visible' : ''}" id="time-attack-penalty">+5秒</span>
          </span>
        </div>
        ` : isTimeChallenge ? `
        <div class="status-item">
          <span class="status-label">正解数</span>
          <span class="status-value status-value-compact">${correctAnswerCount}</span>
          <span class="status-note-slot" aria-hidden="true"></span>
        </div>
        <div class="status-item status-item-time-challenge-time">
          <span class="status-split-row">
            <span class="status-label">残り時間</span>
            <span class="time-challenge-notice ${timeChallengeNoticeClass} ${showTimeChallengeNotice ? 'is-visible' : ''}" id="time-challenge-notice-reason">${timeChallengeNoticeReason}</span>
          </span>
          <span class="status-split-row status-split-row-time status-value status-value-compact">
            <span id="time-challenge-remaining">${timeChallengeRemainingDisplay}</span>
            <span class="time-challenge-notice ${timeChallengeNoticeClass} ${showTimeChallengeNotice ? 'is-visible' : ''}" id="time-challenge-notice-amount">${timeChallengeNoticeAmount}</span>
          </span>
          <span class="status-note-slot" aria-hidden="true"></span>
        </div>
        <div class="status-item status-item-wide">
          <span class="status-label">正解ボーナス残り</span>
          <span class="challenge-gauge">
            <span class="challenge-gauge-fill" id="time-challenge-gauge-fill" style="width: ${questionGaugePercent}%"></span>
          </span>
          <span class="status-note-slot" aria-hidden="true"></span>
        </div>
        ` : `
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
        `}
        <button class="pause-btn" id="pause-btn" aria-label="一時停止" ${isPaused || isCountdown ? 'disabled' : ''}>
          <span class="pause-icon" aria-hidden="true">⏸</span>
        </button>
      </header>

      <main class="board">
        <div class="tile-area ${isEffectActive ? 'answer-effect' : ''}">
          ${isCountdown ? `
            <div class="countdown-overlay" aria-live="assertive" aria-label="カウントダウン">
              <p class="countdown-message">捨牌から残っているスジを数えろ！</p>
              <div class="countdown-ring">
                <span class="countdown-text">${countdownLabel}</span>
              </div>
            </div>
          ` : isPaused ? `
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
          ${selectedGameMode === 'training'
            ? `<button class="next-btn" id="next-btn" ${isEffectActive ? 'disabled' : ''}>次の問題へ</button>`
            : ''}
        </div>
      </main>
    </div>
  `;

  document.querySelectorAll<HTMLButtonElement>('.answer-btn[data-value]').forEach((button) => {
    button.addEventListener('click', () => {
      if (state !== 'playing' || answerEffect !== null) {
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
    if (selectedAnswer === null || !currentQuestion || state !== 'playing' || answerEffect !== null) {
      return;
    }

    totalAnswerCount += 1;
    const isCorrect = selectedAnswer === currentQuestion.correctCount;
    if (selectedGameMode === 'timeAttack') {
      if (isCorrect) {
        timeAttackAnsweredCount += 1;
      } else {
        timeAttackIncorrectCount += 1;
        timeAttackPenaltyMs += TIME_ATTACK_INCORRECT_PENALTY_MS;
        timeAttackPenaltyNoticeUntil = Date.now() + 1200;
      }
    } else if (selectedGameMode === 'timeChallenge') {
      const elapsedSeconds = getTimeChallengeQuestionElapsedMs() / 1000;
      pauseTimeChallengeClock();
      if (isCorrect) {
        let bonusSeconds = 0;
        let speedBonusReason = '';
        if (elapsedSeconds <= TIME_CHALLENGE_FAST_BONUS_THRESHOLD_SECONDS) {
          bonusSeconds += TIME_CHALLENGE_FAST_BONUS_SECONDS;
          speedBonusReason = 'Awesome!!';
        } else if (elapsedSeconds <= TIME_CHALLENGE_MID_BONUS_THRESHOLD_SECONDS) {
          bonusSeconds += TIME_CHALLENGE_MID_BONUS_SECONDS;
          speedBonusReason = 'fast!';
        }

        let streakBonusAdded = false;
        if (correctAnswerCount + 1 > 0 && (correctAnswerCount + 1) % TIME_CHALLENGE_STREAK_STEP === 0) {
          const streakBonus = ((correctAnswerCount + 1) / TIME_CHALLENGE_STREAK_STEP) * TIME_CHALLENGE_STREAK_BONUS_MULTIPLIER_SECONDS;
          bonusSeconds += streakBonus;
          streakBonusAdded = true;
        }

        if (bonusSeconds > 0) {
          const bonusReason = speedBonusReason && streakBonusAdded
            ? 'Combo Bonus!'
            : speedBonusReason
              ? speedBonusReason
              : 'Streak!';
          addTimeChallengeBonus(bonusSeconds, bonusReason);
        }
      } else {
        timeChallengeRemainingMs = Math.max(0, timeChallengeRemainingMs - TIME_CHALLENGE_INCORRECT_PENALTY_MS);
        setTimeChallengeNotice('Oops!', `-${TIME_CHALLENGE_INCORRECT_PENALTY_SECONDS}秒`, 'penalty');
      }
    }
    state = 'result';
    answerEffect = isCorrect ? 'correct' : 'incorrect';
    playEffectAudio(answerEffect);
    if (isCorrect) {
      correctAnswerCount += 1;
    }
    render();

    if (selectedGameMode === 'timeAttack') {
      startAnswerEffectTimer(isCorrect ? 1200 : 1000, () => {
        goToNextQuestion();
      });
      return;
    }

    if (selectedGameMode === 'timeChallenge') {
      startAnswerEffectTimer(isCorrect ? 1200 : 1000, () => {
        if (getTimeChallengeRemainingMs() <= 0) {
          finishTimeChallenge();
          return;
        }
        goToNextQuestion();
      });
      return;
    }

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
  stopCountdown();
  pauseTimeAttackClock();
  stopTimeAttackTickTimer();
  pauseTimeChallengeClock();
  stopTimeChallengeTickTimer();
  answerEffect = null;
  isHowToModalOpen = false;
  modeSelectError = null;
  screen = 'training';
  questions = filterQuestionsByDifficulty(initialQuestions, selectedDifficulty);
  if (selectedGameMode === 'timeAttack' && questions.length < TIME_ATTACK_QUESTION_LIMIT) {
    modeSelectError = `選択した難易度の問題数が不足しています（${questions.length}/${TIME_ATTACK_QUESTION_LIMIT}問）。`;
    screen = 'modeSelect';
    state = 'ready';
    render();
    return;
  }
  resetTimeAttackState();
  resetTimeChallengeState();
  currentQuestion = getRandomQuestion();
  selectedAnswer = null;
  totalAnswerCount = 0;
  correctAnswerCount = 0;
  if (!currentQuestion) {
    modeSelectError = '選択した難易度に該当する問題がありません。難易度を変更してください。';
    screen = 'modeSelect';
    state = 'ready';
    render();
    return;
  }
  startCountdown(GAME_START_COUNTDOWN_LABELS, GAME_START_COUNTDOWN_STEP_MS, () => {
    state = 'playing';
    if (selectedGameMode === 'timeAttack') {
      startTimeAttackClock();
    } else if (selectedGameMode === 'timeChallenge') {
      startTimeChallengeQuestionTimer();
    }
    render();
  });
}

render();
void initializeQuestions();
