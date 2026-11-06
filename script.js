(() => {
  'use strict';
  const DEADLINES_KEY = 'deadlinedash.deadlines.v1';
  const STREAK_KEY = 'deadlinedash.streak.v1';
  const THEME_KEY = 'deadlinedash.theme.v1';
  const DAY = 86400000;
  const CIRCUMFERENCE = 2 * Math.PI * 68;
  const $ = (selector, root = document) => root.querySelector(selector);
  const els = {
    form: $('#deadline-form'), title: $('#title'), subject: $('#subject'), date: $('#due-date'), time: $('#due-time'), color: $('#color'),
    dateText: $('#current-date'), headerStreak: $('#header-streak'), list: $('#deadline-list'), empty: $('#empty-state'), emptyTitle: $('#empty-title'), emptyCopy: $('#empty-copy'),
    search: $('#search-input'), subjectFilter: $('#subject-filter'), statusFilter: $('#status-filter'), count: $('#list-count'), toast: $('#toast-region'),
    ring: $('#ring-progress'), ringDays: $('#ring-days'), ringTime: $('#ring-time'), ringDesc: $('#ring-desc'), focusTitle: $('#focus-title'), focusSubtitle: $('#focus-subtitle'),
    focusMeta: $('#focus-meta'), focusSubject: $('#focus-subject'), focusDue: $('#focus-due'), confirm: $('#confirm-dialog')
  };
  let deadlines = loadDeadlines();
  let streak = loadStreak();
  let pendingDeleteId = null;
  const timeouts = new Set();

  function safeParse(raw, fallback) { try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
  function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function localDay(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
  function parseLocalDate(date, time) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return NaN;
    const [y,m,d] = date.split('-').map(Number), [h,min] = time.split(':').map(Number);
    const result = new Date(y,m-1,d,h,min,0,0);
    return result.getFullYear()===y && result.getMonth()===m-1 && result.getDate()===d && result.getHours()===h && result.getMinutes()===min ? result.getTime() : NaN;
  }
  function validDeadline(item) {
    return item && typeof item.id==='string' && typeof item.title==='string' && item.title.trim() && item.title.length<=120 && typeof item.subject==='string' && item.subject.trim() && item.subject.length<=60 && typeof item.date==='string' && typeof item.time==='string' && Number.isFinite(parseLocalDate(item.date,item.time)) && Number.isFinite(item.createdAt) && typeof item.color==='string' && ['violet','blue','green','coral','amber'].includes(item.color) && typeof item.completed==='boolean';
  }
  function loadDeadlines() {
    const value = safeParse(safeGet(DEADLINES_KEY), []);
    if (!Array.isArray(value)) return [];
    return value.filter(validDeadline).map(x => ({...x, title:x.title.trim(), subject:x.subject.trim()}));
  }
  function loadStreak() {
    const value = safeParse(safeGet(STREAK_KEY), {});
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {current:0,best:0,lastStudyDay:null};
    const entries = Array.isArray(value.entries) ? [...new Set(value.entries.filter(x => typeof x==='string' && /^\d{4}-\d{2}-\d{2}$/.test(x)))].sort() : [];
    let current=0;
    if (entries.length) {
      let cursor = new Date(`${entries.at(-1)}T12:00:00`);
      if (entries.at(-1)===localDay() || entries.at(-1)===localDay(new Date(Date.now()-DAY))) {
        current=1;
        for(let i=entries.length-2;i>=0;i--) { const prior = new Date(`${entries[i]}T12:00:00`); const gap=Math.round((cursor-prior)/DAY); if(gap!==1) break; current++; cursor=prior; }
      }
    }
    const best = Math.max(Number.isInteger(value.best)?value.best:0, current, entries.length ? value.current||0 : 0);
    return {current,best,lastStudyDay:entries.at(-1)||null,entries};
  }
  function saveAll() {
    try { localStorage.setItem(DEADLINES_KEY, JSON.stringify(deadlines)); localStorage.setItem(STREAK_KEY, JSON.stringify(streak)); }
    catch { toast('Could not save in this browser. Check available storage.', 'error'); }
  }
  function toast(message, kind='success') {
    const node=document.createElement('div'); node.className=`toast ${kind}`; node.setAttribute('role','status'); node.textContent=message; els.toast.append(node);
    const id=setTimeout(()=>{node.remove();timeouts.delete(id);},3400); timeouts.add(id);
  }
  function formatDate(timestamp, options={weekday:'short',month:'short',day:'numeric',year:'numeric'}) { return new Intl.DateTimeFormat(undefined,options).format(new Date(timestamp)); }
  function formatDue(item, options={weekday:'short',month:'short',day:'numeric',year:'numeric'}) { return formatDate(parseLocalDate(item.date,item.time),options); }
  function localTime(item) { return new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(new Date(parseLocalDate(item.date,item.time))); }
  function statusOf(item, now=Date.now()) { if(item.completed) return 'completed'; return parseLocalDate(item.date,item.time)<now ? 'overdue' : 'upcoming'; }
  function urgencyOf(item, now=Date.now()) { if(item.completed) return 'completed'; const remaining=parseLocalDate(item.date,item.time)-now; if(remaining<0) return 'overdue'; if(remaining<DAY) return 'urgent'; if(remaining<7*DAY) return 'warning'; return 'calm'; }
  function countdown(ms) {
    if(ms<=0) return 'Deadline passed';
    const total=Math.floor(ms/1000), d=Math.floor(total/86400), h=Math.floor(total%86400/3600), m=Math.floor(total%3600/60), s=total%60;
    return `${d}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
  }
  function progressFor(item, now=Date.now()) {
    const end=parseLocalDate(item.date,item.time), duration=end-item.createdAt;
    if(item.completed) return 100;
    if(duration<=0) return end<=now ? 100 : 0;
    return Math.max(0,Math.min(100,(now-item.createdAt)/duration*100));
  }
  function updateDate() { els.dateText.textContent=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'}).format(new Date()); }
  function updateStats() {
    const counts={upcoming:0,overdue:0,completed:0}; deadlines.forEach(x=>counts[statusOf(x)]++);
    $('#stat-total').textContent=deadlines.length; $('#stat-upcoming').textContent=counts.upcoming; $('#stat-completed').textContent=counts.completed; $('#stat-overdue').textContent=counts.overdue;
  }
  function updateStreakUI() {
    const studied=streak.lastStudyDay===localDay(); $('#header-streak').textContent=streak.current; $('#streak-current').textContent=streak.current; $('#streak-best').textContent=streak.best;
    $('#study-button').disabled=studied; $('#study-button').innerHTML=studied ? 'Done for today <span aria-hidden="true">✓</span>' : 'I studied today <span aria-hidden="true">→</span>';
    $('#streak-message').textContent=studied?'Nice work! Come back tomorrow.':streak.current?`You’re on a ${streak.current}-day run. Keep it going!`:'Small steps count. Mark today when you study.';
  }
  function make(tag, className, text) { const el=document.createElement(tag); if(className)el.className=className; if(text!==undefined)el.textContent=text; return el; }
  function makeCard(item, now) {
    const status=statusOf(item,now), urgency=urgencyOf(item,now), remaining=parseLocalDate(item.date,item.time)-now;
    const card=make('article',`deadline-card${item.completed?' is-completed':''}`); card.dataset.id=item.id; card.dataset.color=item.color;
    const top=make('div','card-top'), titleWrap=make('div','card-title-wrap'); titleWrap.append(make('h3','card-title',item.title),make('div','card-subject',item.subject));
    const actions=make('div','card-actions'); const badge=make('span',`urgency ${urgency==='calm'?'':urgency}`, status==='completed'?'Completed':status==='overdue'?'Overdue':urgency==='urgent'?'Due soon':urgency==='warning'?'Coming up':'On track');
    const done=make('button','card-icon-button complete-button',item.completed?'↶':'✓'); done.type='button'; done.dataset.action='toggle'; done.setAttribute('aria-label',item.completed?'Mark as not completed':'Mark as completed'); done.title=done.getAttribute('aria-label');
    const del=make('button','card-icon-button','×'); del.type='button'; del.dataset.action='delete'; del.setAttribute('aria-label',`Delete ${item.title}`); del.title='Delete deadline'; actions.append(badge,done,del); top.append(titleWrap,actions);
    const bottom=make('div','card-bottom'), due=make('span','due-text',`${formatDue(item)} · ${localTime(item)}`), timer=make('span','countdown',status==='completed'?'Completed':countdown(remaining)); timer.dataset.timer='true'; timer.setAttribute('aria-live','off'); bottom.append(due,timer);
    const progress=make('div','progress-area'), track=make('div','progress-track'), fill=make('div','progress-fill'); const p=progressFor(item,now); fill.style.width=`${p}%`; fill.classList.add(urgency==='calm'?'':urgency==='warning'?'warning':urgency==='urgent'?'urgent':urgency==='overdue'?'expired':''); fill.setAttribute('aria-hidden','true'); track.setAttribute('role','progressbar'); track.setAttribute('aria-label',`Time elapsed for ${item.title}`); track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',String(Math.round(p))); track.append(fill); progress.append(track,make('span','progress-label',`${Math.round(p)}%`)); card.append(top,bottom,progress); return card;
  }
  function updateFocus(now) {
    const next=deadlines.filter(x=>!x.completed&&parseLocalDate(x.date,x.time)>=now).sort((a,b)=>parseLocalDate(a.date,a.time)-parseLocalDate(b.date,b.time))[0];
    const circumference=CIRCUMFERENCE; els.ring.style.strokeDasharray=String(circumference);
    if(!next){els.focusTitle.textContent=deadlines.some(x=>!x.completed)?'A moment to reset.':'You’re all caught up.';els.focusSubtitle.textContent=deadlines.some(x=>!x.completed)?'Your remaining deadlines have passed. Add a new one when you’re ready.':'Add a deadline and we’ll keep an eye on the clock.';els.focusMeta.hidden=true;els.ringDays.textContent='—';els.ringTime.textContent='No rush';els.ringDesc.textContent='No upcoming deadlines';els.ring.style.strokeDashoffset=String(circumference);return;}
    const due=parseLocalDate(next.date,next.time), remaining=due-now, pct=progressFor(next,now); els.focusTitle.textContent=next.title;els.focusSubtitle.textContent='Your next deadline is getting closer.';els.focusMeta.hidden=false;els.focusSubject.textContent=next.subject;els.focusDue.textContent=`Due ${formatDue(next,{month:'short',day:'numeric'})} · ${localTime(next)}`;
    const days=Math.floor(remaining/DAY), hours=Math.floor(remaining%DAY/3600000), minutes=Math.floor(remaining%3600000/60000);els.ringDays.textContent=String(days);els.ringTime.textContent=`${String(hours).padStart(2,'0')}h ${String(minutes).padStart(2,'0')}m left`;els.ringDesc.textContent=`${days} days, ${hours} hours and ${minutes} minutes until ${next.title}`;
    // The ring tracks elapsed time since creation and drains toward the due date.
    const remainingRatio=Math.max(0,Math.min(1,1-pct/100));els.ring.style.strokeDashoffset=String(circumference*(1-remainingRatio));const urgency=urgencyOf(next,now);els.ring.style.stroke=urgency==='urgent'||urgency==='overdue'?'var(--coral)':urgency==='warning'?'var(--amber)':'var(--primary)';
  }
  function updateSubjectOptions() {
    const selected=els.subjectFilter.value;const subjects=[...new Set(deadlines.map(x=>x.subject))].sort((a,b)=>a.localeCompare(b));els.subjectFilter.replaceChildren(new Option('All subjects',''));
    subjects.forEach(s=>els.subjectFilter.add(new Option(s,s))); if(subjects.includes(selected))els.subjectFilter.value=selected;
  }
  function render() {
    const now=Date.now(); updateStats(); updateStreakUI(); updateSubjectOptions(); updateFocus(now);
    const query=els.search.value.trim().toLocaleLowerCase(), subject=els.subjectFilter.value, selectedStatus=els.statusFilter.value;
    const sorted=[...deadlines].sort((a,b)=>{const sa=statusOf(a,now),sb=statusOf(b,now);const rank={upcoming:0,overdue:1,completed:2};return rank[sa]-rank[sb]||parseLocalDate(a.date,a.time)-parseLocalDate(b.date,b.time)||a.title.localeCompare(b.title);});
    const visible=sorted.filter(x=>(!query||x.title.toLocaleLowerCase().includes(query))&&(!subject||x.subject===subject)&&(selectedStatus==='all'||statusOf(x,now)===selectedStatus));
    els.list.replaceChildren(...visible.map(x=>makeCard(x,now)));els.count.textContent=visible.length;
    els.empty.classList.toggle('visible',visible.length===0); if(!deadlines.length){els.emptyTitle.textContent='A fresh page.';els.emptyCopy.textContent='Add your first deadline and make a little plan for future you.';}else if(visible.length===0){els.emptyTitle.textContent='Nothing matches just yet.';els.emptyCopy.textContent='Try a different search or clear your filters.';}
  }
  function validateForm() {
    let ok=true; [['title','title-error','Add a title for this deadline.'],['subject','subject-error','Add a subject name.']].forEach(([key,error,msg])=>{const input=els[key], err=$(`#${error}`), value=input.value.trim();input.classList.toggle('has-error',!value);err.textContent=value?'':msg;if(!value)ok=false;});
    const dateVal=els.date.value,timeVal=els.time.value, timestamp=parseLocalDate(dateVal,timeVal), dateError=$('#date-error'), timeError=$('#time-error');els.date.classList.toggle('has-error',!dateVal||!Number.isFinite(timestamp));dateError.textContent=!dateVal?'Choose a due date.':!Number.isFinite(timestamp)?'Choose a valid date and time.':'';els.time.classList.toggle('has-error',!timeVal);timeError.textContent=timeVal?'':'Choose a due time.';if(!dateVal||!timeVal||!Number.isFinite(timestamp))ok=false;
    if(Number.isFinite(timestamp)&&timestamp<=Date.now()){els.date.classList.add('has-error');dateError.textContent='Choose a date and time in the future.';ok=false;}return ok;
  }
  function exportData() { const payload={app:'DeadlineDash',version:1,exportedAt:new Date().toISOString(),deadlines,streak};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`deadlinedash-backup-${localDay()}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Your DeadlineDash backup is ready.'); }
  async function importData(file) {
    try {if(!file) return; if(file.size>5*1024*1024) throw new Error('That file is too large to import.');const data=safeParse(await file.text(),null);if(!data||!Array.isArray(data.deadlines))throw new Error('This file does not look like a DeadlineDash backup.');
      const imported=data.deadlines;if(imported.some(x=>!validDeadline(x)))throw new Error('Some deadline entries are malformed. Nothing was imported.');
      const dedup=new Map(deadlines.map(x=>[x.id,x]));imported.forEach(x=>dedup.set(x.id,x));deadlines=[...dedup.values()];
      if(data.streak&&typeof data.streak==='object'){const entries=[...new Set([...(streak.entries||[]),...(Array.isArray(data.streak.entries)?data.streak.entries.filter(x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)):[])])].sort();const best=Math.max(streak.best,Number.isInteger(data.streak.best)?data.streak.best:0);streak=loadStreakFromEntries(entries,best);}
      saveAll();render();toast(`Imported ${imported.length} deadline${imported.length===1?'':'s'}.`);
    }catch(error){toast(error.message||'Could not read that backup file.','error');}
  }
  function loadStreakFromEntries(entries,best){const old=safeGet(STREAK_KEY);try{localStorage.setItem(STREAK_KEY,JSON.stringify({entries,best}));const s=loadStreak();localStorage.setItem(STREAK_KEY,old||JSON.stringify(s));return s;}catch{return {current:0,best,lastStudyDay:null,entries};}}
  function applyTheme(theme) {document.documentElement.dataset.theme=theme;$('#theme-toggle').setAttribute('aria-label',theme==='dark'?'Switch to light theme':'Switch to dark theme');try{localStorage.setItem(THEME_KEY,theme);}catch{}}
  function initTheme(){let saved;try{saved=localStorage.getItem(THEME_KEY);}catch{};const theme=saved==='dark'||saved==='light'?saved:(window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light');applyTheme(theme);}
  els.form.addEventListener('submit',event=>{event.preventDefault();if(!validateForm()){const bad=els.form.querySelector('.has-error');bad?.focus();return;}deadlines.push({id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,title:els.title.value.trim(),subject:els.subject.value.trim(),date:els.date.value,time:els.time.value,color:els.color.value,createdAt:Date.now(),completed:false});saveAll();els.form.reset();els.time.value='23:59';els.color.value='violet';els.form.querySelectorAll('.has-error').forEach(x=>x.classList.remove('has-error'));els.form.querySelectorAll('.field-error').forEach(x=>x.textContent='');render();toast('Deadline added. Future you says thanks!');});
  els.form.querySelectorAll('input').forEach(input=>input.addEventListener('input',()=>{
    input.classList.remove('has-error');
    const errorId = input.id === 'due-date' ? 'date-error' : input.id === 'due-time' ? 'time-error' : `${input.id}-error`;
    const err = $(`#${errorId}`);
    if (err) err.textContent = '';
  }));
  els.list.addEventListener('click',event=>{const button=event.target.closest('button[data-action]');if(!button)return;const card=button.closest('.deadline-card'),item=deadlines.find(x=>x.id===card?.dataset.id);if(!item)return;if(button.dataset.action==='toggle'){item.completed=!item.completed;saveAll();render();toast(item.completed?'Deadline marked complete.':'Deadline moved back to your list.');}else{pendingDeleteId=item.id;if(typeof els.confirm.showModal==='function')els.confirm.showModal();else if(window.confirm('Delete this deadline?')) deletePending();}});
  function deletePending(){if(!pendingDeleteId)return;deadlines=deadlines.filter(x=>x.id!==pendingDeleteId);pendingDeleteId=null;saveAll();render();toast('Deadline deleted.');}
  els.confirm.addEventListener('close',()=>{if(els.confirm.returnValue==='confirm')deletePending();else pendingDeleteId=null;});
  els.search.addEventListener('input',render);els.subjectFilter.addEventListener('change',render);els.statusFilter.addEventListener('change',render);$('#clear-filters').addEventListener('click',()=>{els.search.value='';els.subjectFilter.value='';els.statusFilter.value='all';render();});
  $('#study-button').addEventListener('click',()=>{const today=localDay();if(streak.lastStudyDay===today)return;const yesterday=localDay(new Date(Date.now()-DAY));streak.current=streak.lastStudyDay===yesterday?streak.current+1:1;streak.best=Math.max(streak.best,streak.current);streak.lastStudyDay=today;streak.entries=[...new Set([...(streak.entries||[]),today])].sort();saveAll();render();toast('Study session logged. Nice work!');});
  $('#theme-toggle').addEventListener('click',()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));$('#export-button').addEventListener('click',exportData);$('#import-button').addEventListener('click',()=>$('#import-file').click());$('#import-file').addEventListener('change',event=>{importData(event.target.files[0]);event.target.value='';});
  updateDate();initTheme();render();const timer=setInterval(()=>{updateDate();render();},1000);window.addEventListener('pagehide',()=>{clearInterval(timer);timeouts.forEach(clearTimeout);});
})();


