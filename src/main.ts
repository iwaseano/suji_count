import './style.css';
import questionData from './data/questions.json';
import { getTileSvgPath } from './data/tileMap';

type Question = {
  questionId: string;
  discards: string[];
  correctCount: number;
};

type GameState = 'ready' | 'playing' | 'result';
type AnswerEffect = 'correct' | 'incorrect' | null;

const initialQuestions: Question[] = Array.isArray(questionData) ? (questionData as Question[]) : [];
const correctEffectAudio = new Audio(new URL('../mp3/correct_pinpon.mp3', import.meta.url).href);
const incorrectEffectAudio = new Audio(new URL('../mp3/cancel_invalid.mp3', import.meta.url).href);

const app = document.querySelector('#app') as HTMLElement | null;

if (!app) {
  throw new Error('App root not found');
}

const root = app;

let state: GameState = 'ready';
let questions: Question[] = [...initialQuestions];
let currentQuestion: Question | null = null;
let selectedAnswer: number | null = null;
let totalAnswerCount = 0;
let correctAnswerCount = 0;
let answerEffect: AnswerEffect = null;
let answerEffectTimer: number | null = null;

function stopAnswerEffectTimer(): void {
  if (answerEffectTimer !== null) {
    window.clearTimeout(answerEffectTimer);
    answerEffectTimer = null;
  }
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
  const targetAudio = effect === 'correct' ? correctEffectAudio : incorrectEffectAudio;
  targetAudio.currentTime = 0;
  void targetAudio.play().catch((error: unknown) => {
    console.error(`Failed to play ${effect} effect audio.`, error);
  });
}

function render(): void {
  const accuracy = totalAnswerCount === 0 ? '---' : `${((correctAnswerCount / totalAnswerCount) * 100).toFixed(1)}%`;

  if (state === 'ready') {
    root.innerHTML = `
      <div class="center-card">
        <div class="start-screen">
          <h1 class="title">麻雀スジ残数</h1>
          <p class="subtitle">捨て牌から残っているスジ候補数を数えるMVPトレーニングです。</p>
          <button class="start-btn" id="start-btn">トレーニング開始</button>
        </div>
      </div>
    `;

    const startButton = document.querySelector('#start-btn');
    startButton?.addEventListener('click', startGame);
    return;
  }

  const isEffectActive = answerEffect !== null;
  const isAnswerLocked = state === 'result' || isEffectActive;
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

  document.querySelectorAll<HTMLButtonElement>('.answer-btn').forEach((button) => {
    button.addEventListener('click', () => {
      if (state === 'result' || answerEffect !== null) {
        return;
      }
      selectedAnswer = Number(button.dataset.value ?? 0);
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
}

function startGame(): void {
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

render();
