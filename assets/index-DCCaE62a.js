(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();function e(e){let t=`/`.endsWith(`/`)?`/`.slice(0,-1):`/`,n=e.startsWith(`/`)?e.slice(1):e;return t?`${t}/${n}`:`/${n}`}var t={"1m":`tiles/Regular/Man1.svg`,"2m":`tiles/Regular/Man2.svg`,"3m":`tiles/Regular/Man3.svg`,"4m":`tiles/Regular/Man4.svg`,"5m":`tiles/Regular/Man5.svg`,"6m":`tiles/Regular/Man6.svg`,"7m":`tiles/Regular/Man7.svg`,"8m":`tiles/Regular/Man8.svg`,"9m":`tiles/Regular/Man9.svg`,"1p":`tiles/Regular/Pin1.svg`,"2p":`tiles/Regular/Pin2.svg`,"3p":`tiles/Regular/Pin3.svg`,"4p":`tiles/Regular/Pin4.svg`,"5p":`tiles/Regular/Pin5.svg`,"6p":`tiles/Regular/Pin6.svg`,"7p":`tiles/Regular/Pin7.svg`,"8p":`tiles/Regular/Pin8.svg`,"9p":`tiles/Regular/Pin9.svg`,"1s":`tiles/Regular/Sou1.svg`,"2s":`tiles/Regular/Sou2.svg`,"3s":`tiles/Regular/Sou3.svg`,"4s":`tiles/Regular/Sou4.svg`,"5s":`tiles/Regular/Sou5.svg`,"6s":`tiles/Regular/Sou6.svg`,"7s":`tiles/Regular/Sou7.svg`,"8s":`tiles/Regular/Sou8.svg`,"9s":`tiles/Regular/Sou9.svg`,"1z":`tiles/Regular/Ton.svg`,"2z":`tiles/Regular/Nan.svg`,"3z":`tiles/Regular/Shaa.svg`,"4z":`tiles/Regular/Pei.svg`,"5z":`tiles/Regular/Haku.svg`,"6z":`tiles/Regular/Hatsu.svg`,"7z":`tiles/Regular/Chun.svg`};function n(n){return e(t[n]??`tiles/Regular/Man1.svg`)}var r=new Audio(new URL(`../mp3/correct_pinpon.mp3`,``+import.meta.url).href),i=new Audio(new URL(`../mp3/cancel_invalid.mp3`,``+import.meta.url).href),a=new URL(`/assets/logo_image-CciETBwt.png`,``+import.meta.url).href,o=`mahjong-suji-audio-settings`,s={bgmVolume:100,bgmMuted:!1,effectVolume:100,effectMuted:!1},c=document.querySelector(`#app`);if(!c)throw Error(`App root not found`);var l=c,u=`ready`,d=`title`,f=[],p=[],m=null,h=null,g=0,_=0,v=null,y=`playing`,b={timerId:null,startedAt:0,remainingMs:0,callback:null},x=D(),S=!0,C=null;A();var w=15e3,T=2e4;function E(e){return Math.min(100,Math.max(0,Math.round(e)))}function D(){try{let e=window.localStorage.getItem(o);if(!e)return{...s};let t=JSON.parse(e);return{bgmVolume:E(Number(t.bgmVolume??s.bgmVolume)),bgmMuted:!!t.bgmMuted,effectVolume:E(Number(t.effectVolume??s.effectVolume)),effectMuted:!!t.effectMuted}}catch(e){return console.error(`Failed to load audio settings from localStorage.`,e),{...s}}}function O(){try{window.localStorage.setItem(o,JSON.stringify(x))}catch(e){console.error(`Failed to save audio settings to localStorage.`,e)}}function k(e){let t=e===`bgm`?x.bgmMuted:x.effectMuted,n=e===`bgm`?x.bgmVolume:x.effectVolume;return t?0:E(n)/100}function A(){let e=k(`effect`);r.volume=e,i.volume=e}function j(e){let t=`/`.endsWith(`/`)?`/`.slice(0,-1):`/`,n=e.startsWith(`/`)?e.slice(1):e;return t?`${t}/${n}`:`/${n}`}async function M(e,t){let n=new AbortController,r=window.setTimeout(()=>{n.abort()},t);try{let t=await fetch(e,{cache:`no-store`,signal:n.signal});if(!t.ok)throw Error(`Failed to fetch ${e}: ${t.status}`);return await t.json()}catch(n){throw n instanceof DOMException&&n.name===`AbortError`?Error(`Timed out after ${t}ms while fetching ${e}`):n}finally{window.clearTimeout(r)}}function N(e,t){if(typeof e!=`object`||!e)return null;let n=e,r=typeof n.questionId==`string`&&n.questionId.length>0?n.questionId:typeof n.id==`string`&&n.id.length>0?n.id:t;if(!Array.isArray(n.discards)||!n.discards.every(e=>typeof e==`string`))return null;let i=n.correctCount??n.correct_count,a=Number(i);return Number.isInteger(a)?{questionId:r,discards:n.discards,correctCount:a,level:typeof n.level==`string`?n.level:void 0}:null}async function P(e){let t=j(`${e}/index.json`),n=await M(t,w);if(!Array.isArray(n)||!n.every(e=>typeof e==`string`))throw Error(`Invalid index.json format at ${t}`);let r=n.map(async t=>{let n=j(`${e}/${t}`),r=await M(n,w);if(!Array.isArray(r))throw Error(`Invalid question array in ${n}`);return{filename:t,fileData:r}}),i=await Promise.all(r),a=[];for(let{filename:e,fileData:t}of i)t.forEach((t,n)=>{let r=N(t,`${e}_${n}`);r&&a.push(r)});let o=new Map;return a.forEach(e=>{o.has(e.questionId)||o.set(e.questionId,e)}),Array.from(o.values())}async function F(){let e=`data`,t=await P(e);if(t.length===0)throw Error(`No questions loaded from ${j(`${e}/index.json`)}`);return t}async function I(){let e=!1,t=window.setTimeout(()=>{e=!0,S=!1,C=`問題データの読み込みがタイムアウトしました（${T/1e3}秒）。再読み込みしてください。`,X()},T);S=!0,C=null,X();try{let t=await F();if(e)return;f=t,p=[...f]}catch(t){if(e)return;C=`問題データの読み込みに失敗しました: ${t instanceof Error?t.message:String(t)}`,f=[],p=[],console.error(`Failed to initialize questions.`,t)}finally{if(window.clearTimeout(t),e)return;S=!1,X()}}function L(){b.timerId!==null&&window.clearTimeout(b.timerId),b.timerId=null,b.startedAt=0,b.remainingMs=0,b.callback=null}function R(){if(b.timerId===null)return;window.clearTimeout(b.timerId),b.timerId=null;let e=Date.now()-b.startedAt;b.remainingMs=Math.max(0,b.remainingMs-e)}function z(){b.timerId!==null||b.callback===null||b.remainingMs<=0||(b.startedAt=Date.now(),b.timerId=window.setTimeout(()=>{let e=b.callback;L(),e?.()},b.remainingMs))}function B(e,t){L(),b.remainingMs=e,b.callback=t,z()}function V(){R()}function H(){z()}function U(){d===`training`&&u!==`ready`&&u!==`paused`&&(y=u,u=`paused`,V(),X())}function W(){u===`paused`&&(u=y,H(),X())}function G(){L(),v=null,u=`ready`,d=`title`,p=[...f],m=null,h=null,g=0,_=0,X()}function K(){L(),v=null;let e=q();e?(m=e,h=null,u=`playing`,X()):(m=null,p=[...f],h=null,u=`ready`,X())}function q(){if(p.length===0)return null;let e=Math.floor(Math.random()*p.length),[t]=p.splice(e,1);return t??null}function J(e){let t=e.length>=7?6:e.length||1,n=[];for(let r=0;r<e.length;r+=t)n.push(e.slice(r,r+t));return n}function Y(e){if(k(`effect`)===0)return;let t=e===`correct`?r:i;t.currentTime=0,t.play().catch(t=>{console.error(`Failed to play ${e} effect audio.`,t)})}function X(){let e=g===0?`---`:`${(_/g*100).toFixed(1)}%`;if(d===`settings`){l.innerHTML=`
      <div class="center-card">
        <div class="settings-screen">
          <h1 class="settings-title">サウンド設定</h1>
          <p class="settings-subtitle">BGMは現時点では未実装です。設定値は次回アクセス時にも保持されます。</p>

          <div class="audio-setting-card">
            <h2 class="audio-setting-title">BGM</h2>
            <div class="audio-control-row">
              <button class="mute-btn ${x.bgmMuted?`is-muted`:``}" id="bgm-mute-btn" aria-label="BGMのミュート切り替え">
                ${x.bgmMuted?`🔇`:`🔊`}
              </button>
              <input
                type="range"
                class="volume-slider"
                id="bgm-volume-slider"
                min="0"
                max="100"
                step="1"
                value="${x.bgmVolume}"
                aria-label="BGM音量"
              />
              <span class="volume-value">${x.bgmVolume}%</span>
            </div>
          </div>

          <div class="audio-setting-card">
            <h2 class="audio-setting-title">効果音</h2>
            <div class="audio-control-row">
              <button class="mute-btn ${x.effectMuted?`is-muted`:``}" id="effect-mute-btn" aria-label="効果音のミュート切り替え">
                ${x.effectMuted?`🔇`:`🔊`}
              </button>
              <input
                type="range"
                class="volume-slider"
                id="effect-volume-slider"
                min="0"
                max="100"
                step="1"
                value="${x.effectVolume}"
                aria-label="効果音音量"
              />
              <span class="volume-value">${x.effectVolume}%</span>
            </div>
          </div>

          <button class="next-btn" id="settings-back-btn">タイトルへ戻る</button>
        </div>
      </div>
    `,document.querySelector(`#bgm-mute-btn`)?.addEventListener(`click`,()=>{x={...x,bgmMuted:!x.bgmMuted},O(),X()}),document.querySelector(`#effect-mute-btn`)?.addEventListener(`click`,()=>{x={...x,effectMuted:!x.effectMuted},O(),A(),X()});let e=document.querySelector(`#bgm-volume-slider`);e?.addEventListener(`input`,()=>{x={...x,bgmVolume:E(Number(e.value))},O(),X()});let t=document.querySelector(`#effect-volume-slider`);t?.addEventListener(`input`,()=>{x={...x,effectVolume:E(Number(t.value))},O(),A(),X()}),document.querySelector(`#settings-back-btn`)?.addEventListener(`click`,()=>{d=`title`,X()});return}if(d===`title`||u===`ready`){l.innerHTML=`
      <div class="center-card">
        <div class="start-screen">
          <button class="settings-open-btn" id="settings-open-btn" aria-label="設定画面を開く">
            <span class="settings-gear-icon" aria-hidden="true">⚙</span>
          </button>
          <img class="title-logo-image" src="${a}" alt="麻雀筋トレ ロゴ" />
          <h1 class="title">麻雀筋トレ</h1>
          <p class="subtitle">捨て牌から残っているスジ候補数を数えるMVPトレーニングです。</p>
          <button class="start-btn" id="start-btn" ${S||C?`disabled`:``}>トレーニング開始</button>
          ${S?`<p class="status-note">問題データを読み込み中です...</p>`:``}
          ${C?`<p class="error-note">${C}</p><button class="next-btn" id="retry-load-btn">再読み込み</button>`:``}
        </div>
      </div>
    `,document.querySelector(`#start-btn`)?.addEventListener(`click`,Z),document.querySelector(`#settings-open-btn`)?.addEventListener(`click`,()=>{d=`settings`,X()}),document.querySelector(`#retry-load-btn`)?.addEventListener(`click`,()=>{I()});return}let t=u===`paused`,r=v!==null,i=u===`result`||r||t,o=J(m?.discards??[]);l.innerHTML=`
    <div class="app">
      <header class="status-bar">
        <div class="status-item">
          <span class="status-label">正解数</span>
          <span class="status-value">${_}</span>
        </div>
        <div class="status-item">
          <span class="status-label">回答数</span>
          <span class="status-value">${g}</span>
        </div>
        <div class="status-item">
          <span class="status-label">正答率</span>
          <span class="status-value">${e}</span>
        </div>
        <button class="pause-btn" id="pause-btn" aria-label="一時停止" ${t?`disabled`:``}>
          <span class="pause-icon" aria-hidden="true">⏸</span>
        </button>
      </header>

      <main class="board">
        <div class="tile-area ${r?`answer-effect`:``}">
          ${t?`
            <div class="pause-overlay" aria-live="polite" aria-label="一時停止中">
              <p class="pause-title">Pause</p>
              <div class="pause-actions">
                <button class="next-btn pause-action-btn" id="pause-title-btn">タイトルに戻る</button>
                <button class="confirm-btn pause-action-btn" id="pause-resume-btn">ゲームを続行する</button>
              </div>
            </div>
          `:r?`
            <div class="correct-overlay ${v===`incorrect`?`incorrect-overlay`:``}" aria-live="polite" aria-label="判定エフェクト">
              <span class="correct-effect-text ${v===`incorrect`?`incorrect-effect-text`:``}">
                ${v===`incorrect`?`×`:`○`}
              </span>
            </div>
          `:``}
          <div class="tile-stack">
            ${o.map(e=>`
              <div class="tile-row">
                ${e.map(e=>`
                  <div class="tile">
                    <img class="tile-svg" src="${n(e)}" alt="${e}" />
                  </div>
                `).join(``)}
              </div>
            `).join(``)}
          </div>
        </div>

        <div class="answer-grid">
          ${Array.from({length:19},(e,t)=>{let n=t;return`<button class="answer-btn ${h===n?`selected`:``}" data-value="${n}" ${i?`disabled`:``}>${n}</button>`}).join(``)}
          <button class="answer-btn enter-btn" id="quick-confirm-btn" aria-label="回答を確定" ${h===null||i?`disabled`:``}>
            <span class="enter-icon" aria-hidden="true"></span>
          </button>
        </div>

        <div class="action-buttons">
          <button class="confirm-btn" id="confirm-btn" ${h===null||i?`disabled`:``}>
            回答を確定
          </button>
          <button class="next-btn" id="next-btn" ${r?`disabled`:``}>次の問題へ</button>
        </div>
      </main>
    </div>
  `,document.querySelectorAll(`.answer-btn[data-value]`).forEach(e=>{e.addEventListener(`click`,()=>{if(u===`result`||v!==null)return;let t=e.dataset.value,n=t===void 0?NaN:Number(t);Number.isFinite(n)&&(h=n,X())})});let s=()=>{if(h===null||!m||u===`result`||v!==null)return;g+=1;let e=h===m.correctCount;u=`result`,v=e?`correct`:`incorrect`,Y(v),e&&(_+=1),X(),e?B(2e3,()=>{K()}):B(1e3,()=>{v=null,u=`playing`,h=null,X()})};document.querySelector(`#confirm-btn`)?.addEventListener(`click`,s),document.querySelector(`#quick-confirm-btn`)?.addEventListener(`click`,s),document.querySelector(`#next-btn`)?.addEventListener(`click`,()=>{v===null&&K()}),document.querySelector(`#pause-btn`)?.addEventListener(`click`,()=>{U()}),document.querySelector(`#pause-title-btn`)?.addEventListener(`click`,()=>{G()}),document.querySelector(`#pause-resume-btn`)?.addEventListener(`click`,()=>{W()})}function Z(){L(),v=null,d=`training`,p=[...f],m=q(),h=null,g=0,_=0,u=m?`playing`:`ready`,X()}X(),I();