(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=[{questionId:`q1`,discards:[`1m`,`2m`,`3m`,`4m`,`5m`],correctCount:13},{questionId:`q2`,discards:[`1p`,`4p`,`5p`,`8p`,`9p`],correctCount:13},{questionId:`q3`,discards:[`2s`,`3s`,`4s`,`5s`,`6s`,`2z`,`3z`,`4p`,`5s`,`1s`],correctCount:10},{questionId:`q4`,discards:[`1m`,`3m`,`4m`,`6m`,`7m`],correctCount:14},{questionId:`q5`,discards:[`2p`,`3p`,`5p`,`6p`,`9p`],correctCount:14},{questionId:`q6`,discards:[`1s`,`2m`,`5p`,`6s`,`8s`],correctCount:11}],t=`/suji_count/`.endsWith(`/`)?`/suji_count/`:`/suji_count//`;function n(e){return`${t}${e.replace(/^\/+/,``)}`}var r={"1m":n(`tiles/Regular/Man1.svg`),"2m":n(`tiles/Regular/Man2.svg`),"3m":n(`tiles/Regular/Man3.svg`),"4m":n(`tiles/Regular/Man4.svg`),"5m":n(`tiles/Regular/Man5.svg`),"6m":n(`tiles/Regular/Man6.svg`),"7m":n(`tiles/Regular/Man7.svg`),"8m":n(`tiles/Regular/Man8.svg`),"9m":n(`tiles/Regular/Man9.svg`),"1p":n(`tiles/Regular/Pin1.svg`),"2p":n(`tiles/Regular/Pin2.svg`),"3p":n(`tiles/Regular/Pin3.svg`),"4p":n(`tiles/Regular/Pin4.svg`),"5p":n(`tiles/Regular/Pin5.svg`),"6p":n(`tiles/Regular/Pin6.svg`),"7p":n(`tiles/Regular/Pin7.svg`),"8p":n(`tiles/Regular/Pin8.svg`),"9p":n(`tiles/Regular/Pin9.svg`),"1s":n(`tiles/Regular/Sou1.svg`),"2s":n(`tiles/Regular/Sou2.svg`),"3s":n(`tiles/Regular/Sou3.svg`),"4s":n(`tiles/Regular/Sou4.svg`),"5s":n(`tiles/Regular/Sou5.svg`),"6s":n(`tiles/Regular/Sou6.svg`),"7s":n(`tiles/Regular/Sou7.svg`),"8s":n(`tiles/Regular/Sou8.svg`),"9s":n(`tiles/Regular/Sou9.svg`),"1z":n(`tiles/Regular/Ton.svg`),"2z":n(`tiles/Regular/Nan.svg`),"3z":n(`tiles/Regular/Shaa.svg`),"4z":n(`tiles/Regular/Pei.svg`),"5z":n(`tiles/Regular/Haku.svg`),"6z":n(`tiles/Regular/Hatsu.svg`),"7z":n(`tiles/Regular/Chun.svg`)};function i(e){return r[e]??n(`tiles/Regular/Man1.svg`)}var a=Array.isArray(e)?e:[],o=new Audio(new URL(`/suji_count/assets/correct_pinpon-C6TqvGh8.mp3`,``+import.meta.url).href),s=new Audio(new URL(`/suji_count/assets/cancel_invalid-nBq4QEbL.mp3`,``+import.meta.url).href),c=document.querySelector(`#app`);if(!c)throw Error(`App root not found`);var l=`/suji_count/`.endsWith(`/`)?`/suji_count/`:`/suji_count//`;document.documentElement.style.setProperty(`--return-icon-url`,`url("${l}icons/return_symbol_u23ce_filled.svg")`);var u=c,d=`ready`,f=[...a],p=null,m=null,h=0,g=0,_=null,v=null;function y(){v!==null&&(window.clearTimeout(v),v=null)}function b(){y(),_=null;let e=x();e?(p=e,m=null,d=`playing`,w()):(p=null,f=[...a],m=null,d=`ready`,w())}function x(){if(f.length===0)return null;let e=Math.floor(Math.random()*f.length),[t]=f.splice(e,1);return t??null}function S(e){let t=e.length>=7?6:e.length||1,n=[];for(let r=0;r<e.length;r+=t)n.push(e.slice(r,r+t));return n}function C(e){let t=e===`correct`?o:s;t.currentTime=0,t.play().catch(t=>{console.error(`Failed to play ${e} effect audio.`,t)})}function w(){let e=h===0?`---`:`${(g/h*100).toFixed(1)}%`;if(d===`ready`){u.innerHTML=`
      <div class="center-card">
        <div class="start-screen">
          <h1 class="title">麻雀スジ残数</h1>
          <p class="subtitle">捨て牌から残っているスジ候補数を数えるMVPトレーニングです。</p>
          <button class="start-btn" id="start-btn">トレーニング開始</button>
        </div>
      </div>
    `,document.querySelector(`#start-btn`)?.addEventListener(`click`,T);return}let t=_!==null,n=d===`result`||t,r=S(p?.discards??[]);u.innerHTML=`
    <div class="app">
      <header class="status-bar">
        <div class="status-item">
          <span class="status-label">正解数</span>
          <span class="status-value">${g}</span>
        </div>
        <div class="status-item">
          <span class="status-label">回答数</span>
          <span class="status-value">${h}</span>
        </div>
        <div class="status-item">
          <span class="status-label">正答率</span>
          <span class="status-value">${e}</span>
        </div>
      </header>

      <main class="board">
        <div class="tile-area ${t?`answer-effect`:``}">
          ${t?`
            <div class="correct-overlay ${_===`incorrect`?`incorrect-overlay`:``}" aria-live="polite" aria-label="判定エフェクト">
              <span class="correct-effect-text ${_===`incorrect`?`incorrect-effect-text`:``}">
                ${_===`incorrect`?`×`:`○`}
              </span>
            </div>
          `:``}
          <div class="tile-stack">
            ${r.map(e=>`
              <div class="tile-row">
                ${e.map(e=>`
                  <div class="tile">
                    <img class="tile-svg" src="${i(e)}" alt="${e}" />
                  </div>
                `).join(``)}
              </div>
            `).join(``)}
          </div>
        </div>

        <div class="answer-grid">
          ${Array.from({length:19},(e,t)=>{let r=t;return`<button class="answer-btn ${m===r?`selected`:``}" data-value="${r}" ${n?`disabled`:``}>${r}</button>`}).join(``)}
          <button class="answer-btn enter-btn" id="quick-confirm-btn" aria-label="回答を確定" ${m===null||n?`disabled`:``}>
            <span class="enter-icon" aria-hidden="true"></span>
          </button>
        </div>

        <div class="action-buttons">
          <button class="confirm-btn" id="confirm-btn" ${m===null||n?`disabled`:``}>
            回答を確定
          </button>
          <button class="next-btn" id="next-btn" ${t?`disabled`:``}>次の問題へ</button>
        </div>
      </main>
    </div>
  `,document.querySelectorAll(`.answer-btn`).forEach(e=>{e.addEventListener(`click`,()=>{d!==`result`&&_===null&&(m=Number(e.dataset.value??0),w())})});let a=()=>{if(m===null||!p||d===`result`||_!==null)return;h+=1;let e=m===p.correctCount;d=`result`,_=e?`correct`:`incorrect`,C(_),e&&(g+=1),w(),v=e?window.setTimeout(()=>{b()},2e3):window.setTimeout(()=>{_=null,d=`playing`,m=null,w()},1e3)};document.querySelector(`#confirm-btn`)?.addEventListener(`click`,a),document.querySelector(`#quick-confirm-btn`)?.addEventListener(`click`,a),document.querySelector(`#next-btn`)?.addEventListener(`click`,()=>{_===null&&b()})}function T(){y(),_=null,f=[...a],p=x(),m=null,h=0,g=0,d=p?`playing`:`ready`,w()}w();