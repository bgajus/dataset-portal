import"./includes-C1Ym7nk7.js";import{S as u,g as f}from"./shared-store-ByScQMD0.js";import{g}from"./demo-datasets-ROcwX3iX.js";const m=10,_=4,c=e=>document.getElementById(e);function l(e){return String(e||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function A(e,s=18){const n=String(e||"").trim();if(!n)return"";const r=n.split(/\s+/).filter(Boolean);return r.length<=s?n:r.slice(0,s).join(" ")+"…"}function p(e){if(!e)return 0;const n=new Date(String(e).includes("T")?e:`${e}T00:00:00`).getTime();return Number.isFinite(n)?n:0}function b(){const e=f(),s=Array.isArray(e)?e.filter(n=>String(n.status||"").toLowerCase()==="published"):[];return s.length?s:g()}function S(){const e=c("homeSearch"),s=c("homeClear");if(!e||!s)return;const n=()=>{const r=(e.value||"").trim();s.hidden=r.length===0};n(),e.addEventListener("input",n),e.addEventListener("blur",n),s.addEventListener("click",()=>{e.value="",n(),e.focus()})}function T(){const e=c("homeSubjects"),s=c("homeSubjectsToggle");if(!e||!s)return;const n=Array.isArray(u)?u.slice():[],r=n.length,a={expanded:!1},t=()=>{e.innerHTML="",n.forEach((d,h)=>{const o=document.createElement("a");o.setAttribute("role","listitem"),o.className="home-catcard",o.href=`/src/pages/search/index.html?subject=${encodeURIComponent(d)}`,o.textContent=d,!a.expanded&&h>=m&&o.classList.add("home-catcard--hidden"),e.appendChild(o)});const i=r>m;s.hidden=!i,s.setAttribute("aria-expanded",a.expanded?"true":"false"),s.textContent=a.expanded?"See less":"See more",i&&s.setAttribute("aria-label",a.expanded?"See fewer subjects":`See all subjects (${r})`)};s.addEventListener("click",()=>{a.expanded=!a.expanded,t()}),t()}function v(){const e=c("homeLatest");if(!e)return;const a=b().map(t=>{const i=t.createdAt||t.publishedAt||t.publishedDate||t.updatedAt||"";return{doi:String(t.doi||"").trim(),title:String(t.title||"Untitled dataset").trim(),description:String(t.description||"").trim(),createdAt:i,_isDemo:!!t._isDemo}}).filter(t=>t.doi).slice().sort((t,i)=>p(i.createdAt)-p(t.createdAt)).slice(0,_);if(a.length===0){e.innerHTML=`
      <div class="usa-alert usa-alert--info">
        <div class="usa-alert__body">
          <p class="usa-alert__text">No published datasets yet.</p>
        </div>
      </div>
    `;return}e.innerHTML=`
    <div class="home-latest__grid" role="list">
      ${a.map(t=>{const i=`/src/pages/dataset/index.html?doi=${encodeURIComponent(t.doi)}`,d=A(t.description,18);return`
            <article class="home-ds-card" role="listitem">
              <h3 class="home-ds-card__title">${l(t.title)}</h3>
              <p class="home-ds-card__desc">${l(d||"—")}</p>
              <div class="home-ds-card__doi">DOI: <span class="home-ds-card__doiVal">${l(t.doi)}</span></div>
              <div class="home-ds-card__actions">
                <a class="usa-button btnBrandOutline" href="${i}">View dataset</a>
              </div>
            </article>
          `}).join("")}
    </div>
  `}function C(){S(),T(),v()}C();
