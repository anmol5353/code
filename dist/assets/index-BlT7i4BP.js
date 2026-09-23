(function(){const n=document.createElement("link").relList;if(n&&n.supports&&n.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))a(o);new MutationObserver(o=>{for(const i of o)if(i.type==="childList")for(const b of i.addedNodes)b.tagName==="LINK"&&b.rel==="modulepreload"&&a(b)}).observe(document,{childList:!0,subtree:!0});function t(o){const i={};return o.integrity&&(i.integrity=o.integrity),o.referrerPolicy&&(i.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?i.credentials="include":o.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function a(o){if(o.ep)return;o.ep=!0;const i=t(o);fetch(o.href,i)}})();const D="https://www.googleapis.com/auth/drive.file",T=localStorage.getItem("dropdeck-client-id")??"";let d="",u=T,r=[],p=!1;const C=document.querySelector("#app");C.innerHTML=`
  <main class="shell">
    <header class="topbar">
      <a class="brand" href="/" aria-label="Dropdeck home"><span class="brand-mark">D</span><span>dropdeck</span></a>
      <div class="status" id="auth-status"><span class="status-dot"></span><span>Not connected</span></div>
    </header>

    <section class="intro">
      <p class="eyebrow">GOOGLE DRIVE / BULK TRANSFER</p>
      <h1>Move a whole folder.<br><em>One calm batch at a time.</em></h1>
      <p class="lede">Dropdeck keeps large folder migrations moving with resumable uploads, small batches, and a clear retry queue.</p>
    </section>

    <section class="workspace">
      <div class="main-column">
        <div class="dropzone" id="dropzone">
          <input id="folder-input" type="file" webkitdirectory directory multiple hidden />
          <div class="drop-icon">↥</div>
          <h2>Choose a folder to begin</h2>
          <p>We’ll preserve the folder structure inside your Drive destination.</p>
          <button class="button button-dark" id="choose-button">Select folder</button>
          <span class="hint">Nothing leaves your browser until you start the upload.</span>
        </div>
        <div class="queue-header"><div><span class="eyebrow">TRANSFER QUEUE</span><h2 id="queue-title">No files selected</h2></div><button class="text-button" id="clear-button" hidden>Clear all</button></div>
        <div class="queue" id="queue"><div class="empty-queue">Your selected files will appear here.</div></div>
      </div>
      <aside class="side-column">
        <div class="panel connect-panel">
          <div class="panel-heading"><span class="panel-number">01</span><h3>Connect Drive</h3></div>
          <label>Google OAuth client ID<input id="client-id" type="text" placeholder="1234567890-abc.apps.googleusercontent.com" value="${w(u)}" /></label>
          <button class="button button-outline" id="connect-button">Connect Google Drive</button>
          <p class="microcopy">Create a Web application OAuth client in Google Cloud. Add <strong>http://localhost:5173</strong> as an allowed origin.</p>
        </div>
        <div class="panel settings-panel">
          <div class="panel-heading"><span class="panel-number">02</span><h3>Batch settings</h3></div>
          <label>Files per batch<div class="stepper"><button id="decrease" aria-label="Decrease batch size">−</button><input id="batch-size" type="number" min="1" max="100" value="10" /><button id="increase" aria-label="Increase batch size">+</button></div></label>
          <label>Drive folder ID <span class="optional">optional</span><input id="folder-id" type="text" placeholder="Upload to My Drive if blank" /></label>
          <div class="setting-note"><span>↻</span><span>Failed files can be retried individually after a batch finishes.</span></div>
        </div>
        <button class="button button-accent upload-button" id="upload-button" disabled><span>Start upload</span><span>→</span></button>
        <p class="privacy"><span>▣</span> Files go directly from your browser to Google Drive.</p>
      </aside>
    </section>
  </main>
  <div class="toast" id="toast" role="status"></div>
`;const s=e=>document.querySelector(e),g=s("#folder-input"),f=s("#dropzone"),m=s("#queue"),E=s("#upload-button"),L=s("#connect-button"),h=s("#batch-size"),y=s("#toast");function w(e){return e.replace(/[&<>"']/g,n=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[n])}function q(e){if(e<1024)return`${e} B`;const n=["KB","MB","GB","TB"];let t=e/1024,a=0;for(;t>=1024&&a<n.length-1;)t/=1024,a++;return`${t.toFixed(t>=10?0:1)} ${n[a]}`}function c(e,n="normal"){y.textContent=e,y.className=`toast visible ${n}`,window.setTimeout(()=>y.className="toast",3500)}function S(e,n){const t=[];for(let a=0;a<e.length;a+=n)t.push(e.slice(a,a+n));return t}function l(){const e=r.length,n=r.filter(t=>t.state==="done").length;if(s("#queue-title").textContent=e?`${n} of ${e} files ready`:"No files selected",s("#clear-button").toggleAttribute("hidden",e===0||p),E.disabled=e===0||p||!d,!e){m.innerHTML='<div class="empty-queue">Your selected files will appear here.</div>';return}m.innerHTML=r.map((t,a)=>{var o;return`
    <div class="file-row ${t.state}" data-index="${a}">
      <div class="file-icon">${((o=t.file.name.split(".").pop())==null?void 0:o.slice(0,3).toUpperCase())??"FILE"}</div>
      <div class="file-info"><strong>${w(t.file.name)}</strong><span>${q(t.file.size)}${t.error?` · ${w(t.error)}`:""}</span></div>
      <div class="file-state">${t.state==="done"?"Done":t.state==="uploading"?`${t.progress}%`:t.state==="error"?"Retry":"Queued"}</div>
      <div class="progress-track"><div style="width:${t.progress}%"></div></div>
    </div>`}).join(""),m.querySelectorAll(".file-row.error").forEach(t=>t.addEventListener("click",()=>U(Number(t.dataset.index))))}function $(e){const n=Array.from(e).filter(t=>t.size>0);r=n.map(t=>({file:t,state:"queued",progress:0})),l(),n.length&&c(`${n.length} files added to the queue.`)}g.addEventListener("change",()=>{g.files&&$(g.files)});s("#choose-button").addEventListener("click",()=>g.click());s("#clear-button").addEventListener("click",()=>{r=[],l()});["dragenter","dragover"].forEach(e=>f.addEventListener(e,n=>{n.preventDefault(),f.classList.add("dragging")}));["dragleave","drop"].forEach(e=>f.addEventListener(e,n=>{n.preventDefault(),f.classList.remove("dragging")}));f.addEventListener("drop",e=>{var t;const n=(t=e.dataTransfer)==null?void 0:t.files;n!=null&&n.length&&$(n)});s("#decrease").addEventListener("click",()=>{h.value=String(Math.max(1,Number(h.value)-1))});s("#increase").addEventListener("click",()=>{h.value=String(Math.min(100,Number(h.value)+1))});function A(e){s("#auth-status").innerHTML='<span class="status-dot connected"></span><span>Drive connected</span>',L.textContent="Connected to Google Drive",l()}L.addEventListener("click",()=>{if(u=s("#client-id").value.trim(),!u){c("Add your Google OAuth client ID first.","error");return}localStorage.setItem("dropdeck-client-id",u);const e=t=>{t.access_token?(d=t.access_token,A(),c("Google Drive is connected.")):c(t.error??"Could not connect to Google Drive.","error")},n=window.google;n?n.accounts.oauth2.initTokenClient({client_id:u,scope:D,callback:e}).requestAccessToken():c("Google sign-in is still loading. Try again in a moment.","error")});async function N(e,n){e.state="uploading",e.progress=0,l();const t={name:e.file.name,...n?{parents:[n]}:{}},a=await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name",{method:"POST",headers:{Authorization:`Bearer ${d}`,"Content-Type":"application/json; charset=UTF-8","X-Upload-Content-Type":e.file.type||"application/octet-stream","X-Upload-Content-Length":String(e.file.size)},body:JSON.stringify(t)});if(!a.ok)throw new Error(`Drive rejected ${a.status}`);const o=a.headers.get("Location");if(!o)throw new Error("Drive did not return an upload URL");const i=await fetch(o,{method:"PUT",headers:{Authorization:`Bearer ${d}`,"Content-Type":e.file.type||"application/octet-stream"},body:e.file});if(!i.ok)throw new Error(`Upload failed (${i.status})`);e.progress=100,e.state="done",l()}async function k(e,n){for(let t=0;t<3;t++)try{await N(e,n);return}catch(a){t===2?(e.state="error",e.error=a instanceof Error?a.message:"Upload failed",e.progress=0,l()):await new Promise(o=>window.setTimeout(o,750*(t+1)))}}async function O(){if(!d||!r.length)return;p=!0,l();const e=s("#folder-id").value.trim(),n=Math.max(1,Math.min(100,Number(h.value)||10)),t=r.filter(o=>o.state!=="done");for(const o of S(t,n))c(`Uploading batch ${Math.ceil((t.indexOf(o[0])+1)/n)} of ${Math.ceil(t.length/n)}...`),await Promise.all(o.map(i=>k(i,e)));p=!1,l();const a=r.filter(o=>o.state==="error").length;c(a?`${a} files need attention. Click a failed row to retry.`:"All files are safely in Google Drive.")}function U(e){!d||p||(r[e].state="queued",r[e].error=void 0,l(),k(r[e],s("#folder-id").value.trim()))}E.addEventListener("click",()=>void O());const v=document.createElement("script");v.src="https://accounts.google.com/gsi/client";v.async=!0;v.defer=!0;document.head.appendChild(v);l();
