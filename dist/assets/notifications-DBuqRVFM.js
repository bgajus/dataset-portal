import"./includes-C1Ym7nk7.js";const r=e=>document.getElementById(e),E="constellation:notifications:v1",d=new Set;let p=null;function f(e){return String(e??"").replace(/[&<>'"]/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function $(e){try{return new Date(e).toLocaleString(void 0,{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"})}catch{return""}}function w(){try{const e=localStorage.getItem(E),t=e?JSON.parse(e):[];return Array.isArray(t)?t:[]}catch{return[]}}function v(e){try{localStorage.setItem(E,JSON.stringify(Array.isArray(e)?e:[]))}catch(t){console.warn("Failed to write notifications:",t)}}function x(e){if(!e)return!1;const t=window.DatasetPortal?.getRole?.()||"Submitter",o=window.DatasetPortal?.getUserProfile?.()||{},n=String(o.email||"").trim().toLowerCase();if(String(e.toRole||"Submitter").trim()!==t)return!1;const l=String(e.toEmail||"").trim().toLowerCase();return l?l===n:!0}function h(){const e=document.getElementById("notifBadge");if(!e)return;const t=window.DatasetPortal?.notifications?.unreadCount?.()??0;e.hidden=t<=0,e.textContent=String(t)}function m(){return window.DatasetPortal?.notifications?.listForMe?window.DatasetPortal.notifications.listForMe():[]}function C(e){const t=new Set((Array.isArray(e)?e:[]).map(String));if(!t.size)return;const n=w().filter(i=>!(i&&t.has(String(i.id))));v(n),t.forEach(i=>d.delete(i)),u(),h()}function M(){const t=w().filter(o=>!x(o));v(t),d.clear(),u(),h()}function b({title:e,desc:t,okLabel:o,action:n}){const i=r("notifConfirmModal"),l=r("notifConfirmTitle"),a=r("notifConfirmDesc"),s=r("notifConfirmOk");if(!(!i||!l||!a||!s)){p=n,l.textContent=e||"Confirm",a.textContent=t||"Are you sure?",s.textContent=o||"Delete",i.hidden=!1,i.setAttribute("aria-hidden","false");try{s.focus()}catch{}}}function g(){const e=r("notifConfirmModal");e&&(e.hidden=!0,e.setAttribute("aria-hidden","true"),p=null)}function I(){const e=r("notifConfirmModal");e&&(e.querySelectorAll("[data-modal-close]").forEach(t=>{t.addEventListener("click",g)}),document.addEventListener("keydown",t=>{t.key==="Escape"&&(!e||e.hidden||g())}),r("notifConfirmOk")?.addEventListener("click",()=>{const t=p;if(g(),!!t){if(t.type==="deleteSelected"){C(t.ids||[]);return}if(t.type==="deleteAll"){M();return}}}))}function k(e){const t=r("selectedCountLabel"),o=r("selectedCount"),n=r("deleteSelected"),i=r("deleteSelectedLabel"),l=new Set((e||[]).map(c=>String(c.id)));Array.from(d).forEach(c=>{l.has(c)||d.delete(c)});const a=Array.from(d).filter(c=>l.has(c)).length;t&&o&&(a>0?(t.hidden=!1,o.textContent=String(a)):(t.hidden=!0,o.textContent="0")),n&&(n.disabled=a===0,n.setAttribute("aria-disabled",a===0?"true":"false")),i&&(i.textContent=a>0?`Delete selected (${a})`:"Delete selected");const s=r("selectAllNotifs");if(s){const c=l.size;c===0?(s.checked=!1,s.indeterminate=!1,s.disabled=!0):(s.disabled=!1,s.checked=a>0&&a===c,s.indeterminate=a>0&&a<c)}}function u(){const e=r("notifList"),t=r("notifEmpty");if(!e||!window.DatasetPortal?.notifications)return;const o=m();if(k(o),!o.length){t&&(t.hidden=!1),e.innerHTML="";return}t&&(t.hidden=!0),e.innerHTML=o.map(n=>{const i=!n.read,l=String(n.href||"").trim(),a=String(n.id),s=f(n.title||"Notification"),c=f(n.message||""),L=f($(n.createdAt)),S=d.has(a),D=S?"checked":"",y=`notifCheck_${a.replace(/[^a-zA-Z0-9_-]/g,"_")}`;return`
      <article class="notif-card ${i?"is-unread":""} ${S?"is-selected":""}" data-id="${f(a)}">
        <div class="notif-row">
          <div class="notif-check">
            <div class="usa-checkbox">
              <input
                class="usa-checkbox__input"
                id="${f(y)}"
                type="checkbox"
                data-select="${f(a)}"
                ${D}
              />
              <label class="usa-checkbox__label" for="${f(y)}">
                <span class="usa-sr-only">Select notification</span>
              </label>
            </div>
          </div>

          <div class="notif-main">
            <div class="notif-meta">
              <div>
                <p class="notif-title">${s}</p>
                <p class="notif-msg">${c}</p>
              </div>
              <div class="notif-time">${L}</div>
            </div>

            <div class="notif-foot">
              ${l?`<a class="usa-link" href="${f(l)}">Open</a>`:"<span></span>"}
              ${i?`<button class="usa-button usa-button--unstyled" type="button" data-mark-read="${f(a)}">Mark read</button>`:""}

              <button class="notif-iconbtn" type="button" data-delete="${f(a)}" aria-label="Delete notification">
                <i class="fa-regular fa-trash-can" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </div>
      </article>
    `}).join(""),e.querySelectorAll("[data-select]").forEach(n=>{n.addEventListener("change",()=>{const i=n.getAttribute("data-select");if(!i)return;n.checked?d.add(i):d.delete(i);const l=n.closest(".notif-card");l&&l.classList.toggle("is-selected",n.checked),k(m())})}),e.querySelectorAll("[data-mark-read]").forEach(n=>{n.addEventListener("click",()=>{const i=n.getAttribute("data-mark-read");i&&(window.DatasetPortal.notifications.markRead(i),u(),h())})}),e.querySelectorAll("[data-delete]").forEach(n=>{n.addEventListener("click",()=>{const i=n.getAttribute("data-delete");i&&C([i])})})}function A(){I(),r("selectAllNotifs")?.addEventListener("change",e=>{const t=e.currentTarget,o=m();!t||!o.length||(t.checked?o.forEach(n=>d.add(String(n.id))):o.forEach(n=>d.delete(String(n.id))),u())}),r("markAllRead")?.addEventListener("click",()=>{window.DatasetPortal?.notifications?.markAllRead?.(),u(),h()}),r("deleteSelected")?.addEventListener("click",()=>{const e=m(),t=new Set(e.map(n=>String(n.id))),o=Array.from(d).filter(n=>t.has(n));o.length&&b({title:"Delete selected notifications",desc:`Delete ${o.length} notification${o.length===1?"":"s"}? This cannot be undone.`,okLabel:"Delete selected",action:{type:"deleteSelected",ids:o,count:o.length}})}),r("deleteAll")?.addEventListener("click",()=>{m().length&&b({title:"Delete all notifications",desc:"Delete all notifications? This cannot be undone.",okLabel:"Delete all",action:{type:"deleteAll"}})}),u(),h()}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",A):A();
