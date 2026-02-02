import"./includes-C1Ym7nk7.js";import{g as p,s as $}from"./shared-store-ByScQMD0.js";const d=t=>document.getElementById(t);function s(t){return String(t??"").replace(/[&<>'"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function y(t){try{return new Date(t).toLocaleDateString(void 0,{month:"short",day:"numeric",year:"numeric"})}catch{return""}}function A(){const t=window.DatasetPortal?.getRole?.()||"Submitter";return t==="Curator"||t==="Admin"}function u(t){const e=String(t||"").toLowerCase().trim();return e==="in review"||e==="in-review"?"in-review":e==="needs updates"||e==="needs-updates"?"needs-updates":e==="published"?"published":"draft"}function D(t){const e=u(t);return e==="in-review"||e==="needs-updates"}function f(t){return u(t)==="in-review"}function b(){const t=d("curList"),e=d("curEmpty"),r=d("curAccessDenied");if(!t)return;if(!A()){r&&(r.hidden=!1),e&&(e.hidden=!0),t.innerHTML="";return}r&&(r.hidden=!0);const c=p().filter(i=>D(i.status)).sort((i,n)=>String(n.updatedAt||n.createdAt||"").localeCompare(String(i.updatedAt||i.createdAt||"")));e&&(e.hidden=c.length!==0),t.innerHTML=c.map(i=>{const n=String(i.doi||""),a=String(i.title||"Untitled Dataset"),o=y(i.updatedAt||i.createdAt),l=String(i.submitterEmail||"").trim(),m=u(i.status),g=String(i.status||"Draft"),S=f(i.status),v=m==="needs-updates"?`
          <span class="cur-waiting" aria-label="Waiting on submitter">
            <i class="fa-regular fa-clock" aria-hidden="true"></i>
            Waiting on Submitter
          </span>
        `:"",w=S?`
          <button
            type="button"
            class="usa-button cur-publish"
            data-action="publish"
            data-doi="${s(n)}"
            aria-label="Publish dataset"
          >
            Publish
          </button>
        `:"";return`
        <article class="cur-card" data-doi="${s(n)}">
          <div class="cur-meta">
            <div class="cur-meta__left">
              <div class="cur-titleRow">
                <h3 class="cur-title">${s(a)}</h3>
                <span class="status-chip" data-status="${s(m)}">${s(g)}</span>
                ${v}
              </div>

              <p class="cur-doi">
                ${s(n)} · Updated ${s(o)}${l?` · Submitter: ${s(l)}`:""}
              </p>
            </div>

            <div class="cur-actions">
              <a class="usa-button btnBrandSolid" href="/src/pages/editor/index.html?doi=${encodeURIComponent(n)}&curator=1">
                Review
              </a>
              ${w}
            </div>
          </div>
        </article>
      `}).join(""),t.querySelectorAll('button[data-action="publish"]').forEach(i=>{i.addEventListener("click",()=>{const n=i.getAttribute("data-doi");if(!n)return;const a=p().find(o=>o.doi===n);!a||!f(a.status)||(a.status="Published",$(a),window.DatasetPortal?.notifications?.add?.({toRole:"Submitter",toEmail:a.submitterEmail||"",title:"Dataset published",message:"Your dataset has been published.",href:`/src/pages/dataset/index.html?doi=${encodeURIComponent(n)}`,recordDoi:n,kind:"success"}),b())})})}function h(){b()}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",h):h();
