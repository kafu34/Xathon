const STORAGE_KEY = 'pace.prototype.v1';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const today = new Date();
const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dateOffset = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return dayKey(d); };
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const prettyDate = (key) => new Date(`${key}T12:00:00`).toLocaleDateString('en-US', { month:'short', day:'numeric' });
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
const sampleEntries = [
  {date:dateOffset(-6),sleep:7.1,energy:3,stress:3,activity:27,hr:61},
  {date:dateOffset(-5),sleep:7.7,energy:4,stress:2,activity:34,hr:59},
  {date:dateOffset(-4),sleep:6.4,energy:2,stress:4,activity:18,hr:62},
  {date:dateOffset(-3),sleep:8.1,energy:4,stress:2,activity:45,hr:58},
  {date:dateOffset(-2),sleep:7.5,energy:4,stress:2,activity:38,hr:59},
  {date:dateOffset(-1),sleep:7.3,energy:3,stress:3,activity:42,hr:60},
  {date:dateOffset(0),sleep:7.7,energy:4,stress:2,activity:0,hr:58}
];
const sampleProfile = {name:'',goal:'Build consistency',about:'',routine:'Work',start:'09:00',end:'17:00',days:['Mon','Tue','Wed','Thu','Fri'],bedtime:'23:00',wake:'07:00',baselineHr:58};
let saved;
try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { saved = null; }
const state = window.PaceServices.dataService.restore(saved);
let setupStep = 1;
let draftProfile = null;
let lastFocus = null;
let modalReturn = null;
let toastTimer;

function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function entries() { return state.profile ? [...state.entries].sort((a,b)=>a.date.localeCompare(b.date)) : sampleEntries; }
function profile() { return state.profile || sampleProfile; }
function latestEntry() { const list=entries(); return list[list.length-1] || null; }
function scoreOf(entry) { return window.PaceServices.dataService.score(entry); }
function todayScore() { const entry=latestEntry();return entry?.date===dayKey()?scoreOf(entry):null; }

function recommendation(score) {
  const goal = profile().goal || 'Feel better';
  if (score === null) return {label:'START SMALL',title:'Begin with a check-in',description:'Log your sleep, energy and stress so Pace can suggest a sensible next step.',duration:'10 minutes',intensity:'Easy',coachTitle:'Start with what you know.',coach:'A quick check-in gives today’s plan a real starting point.'};
  if (score < 50) return {label:'RECOVERY',title:'Make room for recovery',description:'Energy looks limited today. Try easy movement or rest and keep your schedule gentle.',duration:'15–20 minutes',intensity:'Easy',coachTitle:'Rest is part of progress.',coach:'Lower energy is useful information. A lighter day can help you keep momentum tomorrow.'};
  if (score < 72) return {label:'STEADY DAY',title:'Keep it comfortable',description:'A moderate session fits your current signals. Focus on consistency and stop before you feel drained.',duration:'20–30 minutes',intensity:'Moderate',coachTitle:'Choose a pace you can repeat.',coach:'A steady session gives you movement without spending all your energy at once.'};
  const title = goal === 'Improve fitness' ? 'A good day to train' : goal === 'Sleep better' ? 'Move now, wind down later' : 'A good day to get moving';
  return {label:'MOVEMENT',title,description:'Your signals support a focused session. Keep it manageable and leave energy for the rest of your day.',duration:'30–40 minutes',intensity:'Moderate',coachTitle:'Consistency beats intensity.',coach:'You have room to push a little today. Aim for a session you could happily repeat next week.'};
}
function timing() {
  const p=profile();
  if (!p.start || !p.end) return 'Flexible timing';
  const weekday=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][today.getDay()];
  if (!p.days?.includes(weekday)) return 'Flexible day';
  const endHour=Number(p.end.split(':')[0]);
  const endMinute=Number(p.end.split(':')[1]);
  const after=endHour + (endMinute > 30 ? 2 : 1);
  if (after >= 20) return 'Before your routine';
  return `${String(after).padStart(2,'0')}:00, after ${p.routine.toLowerCase()}`;
}
function setText(id, value) { const node=document.getElementById(id); if (node) node.textContent=value; }
function formatSleep(value) { if(value==null)return '—';const minutes=Math.round(value*60);return `${Math.floor(minutes/60)}h ${String(minutes%60).padStart(2,'0')}m`; }
function renderChart(id, data) {
  const node=document.getElementById(id);
  const keys=Array.from({length:7},(_,i)=>dateOffset(i-6));
  node.innerHTML=keys.map((key,i)=>{
    const entry=data.find(item=>item.date===key);
    const score=scoreOf(entry);
    const label=new Date(`${key}T12:00:00`).toLocaleDateString('en-US',{weekday:'short'}).slice(0,2);
    return `<div class="bar-col" title="${escapeHTML(prettyDate(key))}: ${score === null ? 'No check-in' : `${score} readiness`}"><div class="bar-wrap"><span class="bar ${i===6?'today':''}" style="height:${score ?? 3}%"></span></div><small>${label}</small></div>`;
  }).join('');
}
function renderDashboard() {
  const p=profile(), list=entries(), entry=latestEntry(), score=todayScore(), rec=recommendation(score);
  const current=new Date(),hour=current.getHours();
  const greeting=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
  setText('today-date',current.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}).toUpperCase());
  setText('greeting',`${greeting}${p.name ? `, ${p.name.split(' ')[0]}` : ''}. Let's find your pace.`);
  setText('heading-sub',state.profile ? `A plan shaped by your ${(p.goal||'healthier routine').toLowerCase()} goal and today’s signals.` : 'A plan that moves with your energy, not against it.');
  $('#setup-banner').hidden=!!state.profile;
  $('#demo-pill').hidden=!!state.profile && !state.demo;
  setText('side-name',p.name || 'Your space'); setText('side-subtitle',state.profile ? p.goal : 'Set up your profile');
  for (const id of ['avatar','top-avatar','profile-avatar']) setText(id,(p.name || 'P').trim().charAt(0).toUpperCase());
  $('#score-ring').style.setProperty('--score',score ?? 0); setText('score-number',score === null ? '—' : score);
  const band=score===null?'No data yet':score<50?'Take it easy':score<72?'Find your balance':'Ready to move';
  setText('readiness-label',band);
  setText('readiness-explain',score===null ? 'Log today’s sleep, energy and stress for an estimate. Missing or old measurements are not treated as today’s data.' : score<50 ? 'Sleep, energy or stress suggest a lighter day may fit better.' : score<72 ? 'Your signals point to steady effort over an intense session.' : 'Your sleep, energy and stress support a focused session today.');
  setText('score-basis',score===null?'Needs today’s sleep, energy and stress':'Based on today’s check-in · demo estimate');
  setText('plan-tag',rec.label); setText('plan-title',rec.title); setText('plan-description',rec.description);
  setText('plan-time',`${rec.duration} · ${timing()}`);
  setText('metric-sleep',entry ? formatSleep(entry.sleep) : '—');
  setText('metric-sleep-note',entry ? (entry.date===dayKey()?'Last night':`Logged ${prettyDate(entry.date)}`) : 'Add a check-in');
  setText('metric-hr',entry?.hr || p.baselineHr ? `${entry?.hr || p.baselineHr} bpm` : '—'); setText('metric-hr-note',entry?.hr ? 'Latest check-in' : 'Your baseline');
  setText('metric-energy',entry ? (['','Very low','Low','Okay','Good','High'][entry.energy] || '—') : '—');
  setText('metric-energy-note',entry ? (entry.date===dayKey()?'Self reported today':`Logged ${prettyDate(entry.date)}`) : 'Add a check-in');
  setText('metric-activity',entry?.activity != null ? `${entry.activity} min` : '—'); setText('metric-activity-note',entry?.workout && entry.workout!=='None' ? entry.workout : entry?.activity != null ? (entry.date===dayKey()?'Today':'Latest entry') : 'Add a check-in');
  setText('chart-note',state.profile ? `${list.filter(e=>e.date>=dateOffset(-6)).length} logged days` : 'Sample week');
  setText('coach-title',rec.coachTitle); setText('coach-message',rec.coach);
  renderChart('weekly-chart',list); renderChart('insights-chart',list);
  renderInsights(list); renderPlan(rec,score); renderProfile(p);
  if(typeof window.renderStudentPanels==='function') window.renderStudentPanels();
}
function renderInsights(list) {
  const count=state.profile ? list.length : 0;
  setText('insight-count',state.profile?'Your last 7 days':'Sample week');
  setText('checkin-count',`${Math.min(count,3)} / 3`);
  $('#progress-fill').style.width=`${Math.min(count/3,1)*100}%`;
  let title='Your baseline is taking shape';
  let copy='Check in on a few more days and Pace can start showing how sleep, stress and energy move together for you.';
  if (count>=3) {
    const recent=list.slice(-14), avgSleep=recent.reduce((sum,e)=>sum+Number(e.sleep),0)/recent.length;
    const high=recent.filter(e=>e.sleep>=7.5), low=recent.filter(e=>e.sleep<7.5);
    title='A pattern worth watching';
    if (high.length && low.length) {
      const highEnergy=high.reduce((sum,e)=>sum+Number(e.energy),0)/high.length;
      const lowEnergy=low.reduce((sum,e)=>sum+Number(e.energy),0)/low.length;
      copy=`Across ${recent.length} check-ins, you reported ${Math.abs(highEnergy-lowEnergy).toFixed(1)} points ${highEnergy>=lowEnergy?'more':'less'} energy after nights with at least 7.5 hours of sleep. This is an observation, not a cause-and-effect finding.`;
    } else copy=`Your recent average sleep is ${avgSleep.toFixed(1)} hours. Keep checking in to compare sleep with your energy and stress.`;
  }
  setText('pattern-title',title); setText('pattern-copy',copy);
  $('#entry-list').innerHTML=state.profile&&list.length?[...list].reverse().slice(0,10).map(e=>`<div class="entry-row"><strong>${escapeHTML(prettyDate(e.date))}${e.date===dayKey()?' · Today':''}<small>${escapeHTML(e.temporary||'Regular period')} · ${e.source==='demo'?'Sample':'Manual'}</small></strong><span>${formatSleep(e.sleep)} sleep</span><span>${e.energy==null?'—':['','Very low','Low','Okay','Good','High'][e.energy]} energy</span><span>${e.stress??'—'}/5 stress</span><span>${scoreOf(e)??'—'} readiness</span><button class="link-button" data-edit-checkin="${escapeHTML(e.date)}">Edit</button><button class="link-button" data-delete-checkin="${escapeHTML(e.date)}">Delete</button></div>`).join(''):'<div class="entry-empty">No check-ins yet. Log today to start building your own history.</div>';
  if(state.deletedEntries?.length)$('#entry-list').insertAdjacentHTML('beforeend','<button class="outline-button" id="restore-checkin">Undo last check-in deletion</button>');
}
function renderPlan(rec,score) {
  setText('plan-readiness',score===null?'No readiness yet':`${score} readiness`);
  setText('plan-page-title',rec.title); setText('plan-page-copy',rec.description);
  setText('plan-duration',rec.duration); setText('plan-window',timing()); setText('plan-intensity',rec.intensity);
  const completed=state.completed.includes(dayKey());
  setText('complete-label',completed?'Completed today':'Mark as done');
  $('#complete-plan').disabled=completed;
  const p=profile();
  $('#schedule-details').innerHTML=[
    ['Main routine',p.routine || 'Not set'],['Hours',p.start && p.end ? `${p.start} – ${p.end}` : 'Flexible'],
    ['Days',p.days?.length ? p.days.join(', ') : 'Not set'],['Sleep window',p.bedtime && p.wake ? `${p.bedtime} – ${p.wake}` : 'Not set'],
    ['Primary goal',p.goal || 'Not set']
  ].map(([label,value])=>`<div class="schedule-line"><span>${label}</span><strong>${escapeHTML(value)}</strong></div>`).join('');
  const agents=[['Profile','Learns your goals, habits and routine'],['Health','Reads the check-ins you choose to share'],['Pattern','Looks for trends in your own entries'],['Planner','Fits a suggestion around your day'],['Coach','Explains the plan in plain language'],['Learning','Uses what you log next to adjust']];
  $('#agent-grid').innerHTML=agents.map(([name,description],i)=>`<div class="agent-card"><span class="agent-number">${String(i+1).padStart(2,'0')}</span><div><strong>${name} agent</strong><p>${description}</p></div></div>`).join('');
}
function renderProfile(p) {
  setText('profile-name',p.name || 'Your profile'); setText('profile-goal',state.profile ? p.goal : 'Add a goal to get started');
  $('#profile-details').innerHTML=[['Goal',p.goal||'Not set'],['Lifestyle',p.lifestyle||p.about||'Not set'],['Routine',p.routine||'Not set'],['Sleep schedule',p.bedtime&&p.wake?`${p.bedtime} – ${p.wake}`:'Not set'],['Resting HR baseline',p.baselineHr?`${p.baselineHr} bpm`:'Not set']].map(([label,value])=>`<div class="profile-line"><span>${label}</span><strong>${escapeHTML(value)}</strong></div>`).join('');
}
function showView(view) {
  $$('.view').forEach(node=>node.classList.toggle('active',node.id===`view-${view}`));
  $$('[data-view]').forEach(node=>node.classList.toggle('active',node.dataset.view===view));
  window.scrollTo({top:0,behavior:'smooth'});
  try { history.replaceState(null,'',`#${view}`); } catch {}
}
function toast(message) { const node=$('#toast'); node.textContent=message; node.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>node.classList.remove('show'),3300); }
function openModal(type) {
  lastFocus=document.activeElement;
  if (type==='setup') { studentDraft=null; renderStudentSetup(); }
  if (type==='checkin') { if(!state.profile){studentDraft=null;renderStudentSetup();}else renderCheckin(); }
  if (type==='device') renderDevice();
  if (type==='student-setup') { studentDraft=null; renderStudentSetup(); }
  if (type==='welcome') renderWelcome();
  if (type==='student-device') renderStudentDevice();
  if (type==='evidence') renderEvidence();
  if (type==='temporary') renderTemporaryMode();
  if (type==='recovery') renderRecoveryPlan();
  $('#modal-backdrop').hidden=false;
  document.body.style.overflow='hidden';
  $('#modal-close').focus();
}
function closeModal() { if(modalReturn){const restore=modalReturn;modalReturn=null;restore();return;} $('#modal-backdrop').hidden=true; document.body.style.overflow=''; if (lastFocus?.focus) lastFocus.focus(); }
function renderSetup() {
  const p=draftProfile;
  $('#modal-content').innerHTML=setupStep===1 ? `<p class="modal-kicker">STEP 1 OF 2 · YOUR LIFE</p><h2 id="modal-title">Tell Pace about your day.</h2><p class="modal-intro">Your goals and routine help the planner suggest something realistic.</p><div class="step-track"><span class="active"></span><span></span></div><form id="profile-step"><div class="form-grid"><div class="field"><label for="profile-input-name">Your name</label><input id="profile-input-name" name="name" maxlength="40" required placeholder="e.g. Alex" value="${escapeHTML(p.name)}" /></div><div class="field"><label for="profile-input-goal">Your main goal</label><select id="profile-input-goal" name="goal">${['Build consistency','Improve fitness','Sleep better','Manage stress','Feel better'].map(goal=>`<option ${p.goal===goal?'selected':''}>${goal}</option>`).join('')}</select></div><div class="field full"><label for="profile-input-about">What should your coach know?</label><textarea id="profile-input-about" name="about" maxlength="300" placeholder="Your lifestyle, constraints, habits, or what motivates you">${escapeHTML(p.about)}</textarea></div><div class="field"><label for="profile-input-routine">Main weekday routine</label><select id="profile-input-routine" name="routine">${['Work','Study','Shift work','Flexible schedule'].map(v=>`<option ${p.routine===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label for="profile-input-start">Starts at</label><input id="profile-input-start" type="time" name="start" value="${escapeHTML(p.start)}" /></div><div class="field"><label for="profile-input-end">Ends at</label><input id="profile-input-end" type="time" name="end" value="${escapeHTML(p.end)}" /></div><div class="field full"><span class="field-label">Busy days</span><div class="chip-row" id="day-chips">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=>`<button type="button" class="chip ${p.days.includes(day)?'selected':''}" data-day="${day}" aria-pressed="${p.days.includes(day)}">${day}</button>`).join('')}</div></div></div><div class="modal-actions"><button type="button" class="link-button" id="setup-cancel">Cancel</button><button class="primary-button" type="submit">Continue <svg><use href="#i-arrow"/></svg></button></div></form>` : `<p class="modal-kicker">STEP 2 OF 2 · HEALTH BASELINE</p><h2 id="modal-title">Add the signals you know.</h2><p class="modal-intro">Only share what you have. You can update your health check-in any day.</p><div class="step-track"><span class="active"></span><span class="active"></span></div><form id="health-step"><div class="form-grid"><div class="field"><label for="profile-bedtime">Usual bedtime</label><input id="profile-bedtime" type="time" name="bedtime" value="${escapeHTML(p.bedtime)}" /></div><div class="field"><label for="profile-wake">Usual wake time</label><input id="profile-wake" type="time" name="wake" value="${escapeHTML(p.wake)}" /></div><div class="field"><label for="profile-hr">Resting heart rate, if known</label><input id="profile-hr" type="number" name="baselineHr" min="35" max="120" placeholder="e.g. 60" value="${p.baselineHr||''}" /><small>Optional · beats per minute</small></div></div><div class="notice">Want to use a fitness device? You can view supported-device plans after setup. This prototype does not sync with wearables yet.</div><div class="modal-actions"><button type="button" class="link-button" id="setup-back">Back</button><button class="primary-button" type="submit">Finish setup <svg><use href="#i-check"/></svg></button></div></form>`;
  if (setupStep===1) {
    $$('#day-chips .chip').forEach(button=>button.addEventListener('click',()=>{ button.classList.toggle('selected'); button.setAttribute('aria-pressed',button.classList.contains('selected')); }));
    $('#setup-cancel').addEventListener('click',closeModal);
    $('#profile-step').addEventListener('submit',event=>{event.preventDefault(); const form=new FormData(event.currentTarget); draftProfile={...draftProfile,name:String(form.get('name')).trim(),goal:form.get('goal'),about:String(form.get('about')).trim(),routine:form.get('routine'),start:form.get('start'),end:form.get('end'),days:$$('#day-chips .selected').map(node=>node.dataset.day)}; setupStep=2; renderSetup();});
  } else {
    $('#setup-back').addEventListener('click',()=>{setupStep=1;renderSetup();});
    $('#health-step').addEventListener('submit',event=>{event.preventDefault();const form=new FormData(event.currentTarget);draftProfile.bedtime=form.get('bedtime');draftProfile.wake=form.get('wake');draftProfile.baselineHr=form.get('baselineHr')?clamp(form.get('baselineHr'),35,120):null;state.profile=draftProfile;persist();closeModal();renderDashboard();toast('Profile saved. Log today to build your first plan.');});
  }
}
function renderCheckin(editDate=dayKey()) {
  const existing=state.entries.find(entry=>entry.date===editDate)||{};
  const number=(name,label,min,max,step=1)=>`<div class="field"><label for="checkin-${name}">${label}</label><input id="checkin-${name}" type="number" name="${name}" min="${min}" max="${max}" step="${step}" value="${existing[name]??''}" placeholder="Optional" /></div>`;
  const rating=(name,label,choices)=>`<div class="field"><label for="checkin-${name}">${label}</label><select id="checkin-${name}" name="${name}"><option value="">Not logged</option>${choices.map((v,i)=>`<option value="${i+1}" ${Number(existing[name])===i+1?'selected':''}>${v}</option>`).join('')}</select></div>`;
  $('#modal-content').innerHTML=`<p class="modal-kicker">HEALTH CHECK-IN</p><h2 id="modal-title">Log what you know.</h2><p class="modal-intro">Every field is optional. Missing values stay unknown. Readiness needs sleep, energy and stress from today.</p><form id="checkin-form"><div class="form-grid"><div class="field full"><label for="checkin-date">Check-in date</label><input id="checkin-date" type="date" name="date" value="${editDate}" max="${dayKey()}" required ${existing.date?'readonly':''} /></div>${number('sleep','Sleep (hours)',0,12,.1)}${number('hr','Resting heart rate (bpm)',35,120)}${rating('energy','Energy',['Very low','Low','Okay','Good','High'])}${rating('stress','Stress',['Very low','Low','Moderate','High','Very high'])}${number('activity','Active minutes',0,600)}${number('steps','Steps',0,100000)}${number('recovery','Tracker recovery score, if available',0,100)}<div class="field"><label for="checkin-workout">Workout</label><select id="checkin-workout" name="workout"><option value="">Not logged</option>${['None','Walk','Strength','Cardio','Sport','Mobility'].map(label=>`<option ${existing.workout===label?'selected':''}>${label}</option>`).join('')}</select></div><div class="field full"><label for="checkin-feeling">How are you feeling?</label><input id="checkin-feeling" name="feeling" maxlength="80" value="${escapeHTML(existing.feeling||'')}" placeholder="Optional · Tired, good, stressed, or your own words" /></div><div class="field full"><label for="checkin-note">Anything else?</label><input id="checkin-note" name="note" maxlength="160" value="${escapeHTML(existing.note||'')}" placeholder="Optional" /></div></div><div class="notice" id="checkin-error" hidden></div><div class="modal-actions"><button type="button" class="link-button" id="checkin-cancel">Cancel</button><button class="primary-button" type="submit">Save check-in</button></div></form>`;
  $('#checkin-cancel').addEventListener('click',closeModal);
  $('#checkin-form').addEventListener('submit',event=>{
    event.preventDefault();const raw=Object.fromEntries(new FormData(event.currentTarget)),result=window.PaceServices.dataService.checkin(state,raw,raw.date);
    if(result.error){$('#checkin-error').hidden=false;setText('checkin-error',result.error);return;}
    persist();closeModal();renderDashboard();toast('Check-in saved. Your plan has been updated.');
  });
}
function renderDevice() {
  $('#modal-content').innerHTML=`<p class="modal-kicker">DEVICE CONNECTIONS</p><h2 id="modal-title">Your data, your choice.</h2><p class="modal-intro">Automatic imports would need your permission. Live device integrations are planned, but aren’t connected in this prototype.</p>${['Apple Health','Google Health Connect','Fitbit','Garmin','WHOOP'].map(name=>`<div class="device-option"><span><svg><use href="#i-watch"/></svg></span><div><strong>${name}</strong><small>Sleep, heart rate and activity</small></div><em>COMING SOON</em></div>`).join('')}<div class="notice">For now, use daily check-ins to enter data yourself. No device permissions have been requested or stored.</div><div class="modal-actions"><button class="primary-button" id="device-done">Got it</button></div>`;
  $('#device-done').addEventListener('click',closeModal);
}
document.addEventListener('click',event=>{const open=event.target.closest('[data-open]');if(open)openModal(open.dataset.open);const view=event.target.closest('[data-view]');if(view)showView(view.dataset.view);});
$('#modal-close').addEventListener('click',closeModal);
$('#modal-backdrop').addEventListener('click',event=>{if(event.target===event.currentTarget)closeModal();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('#modal-backdrop').hidden)closeModal();});
$('#complete-plan').addEventListener('click',()=>{
  const item=window.focusItem?.(window.studentPlan?.()[0]);if(!item)return;
  if(!state.profile){openModal('student-setup');return;}
  const error=window.PaceServices.actionService.record(state,item,dayKey(),'completed');if(error){toast(error);return;}persist();renderDashboard();toast('Activity marked done.');
});
function clearLocalData(){window.PaceAI?.cancel();window.PaceServices.dataService.reset(state);modalReturn=null;cancelTimetableDraft();studentDraft=null;persist();renderDashboard();showView('dashboard');}
function showConfirmation(title,message,action,label='Confirm') {
  lastFocus=document.activeElement;modalReturn=null;
  $('#modal-content').innerHTML=`<h2 id="modal-title">${escapeHTML(title)}</h2><p class="modal-intro">${escapeHTML(message)}</p><div class="modal-actions"><button class="outline-button" id="confirmation-cancel">Cancel</button><button class="primary-button" id="confirmation-accept">${escapeHTML(label)}</button></div>`;
  $('#modal-backdrop').hidden=false;document.body.style.overflow='hidden';$('#confirmation-cancel').focus();
  $('#confirmation-cancel').addEventListener('click',closeModal);$('#confirmation-accept').addEventListener('click',()=>{closeModal();action();});
}
$('#reset-data').addEventListener('click',()=>showConfirmation('Clear all local Pace data?','This removes the profile, health history, timetable, plans, chats and AI sharing permission from this browser.',()=>{clearLocalData();toast('All local Pace data cleared.');},'Clear all data'));

renderDashboard();
const initialView=location.hash.replace('#','');
if(['dashboard','insights','plan','timetable','coach','profile'].includes(initialView))showView(initialView);

// Expose the same daily journey as structured browser tools where WebMCP is supported.
if (document.modelContext?.registerTool) {
  const register = (tool) => { try { Promise.resolve(document.modelContext.registerTool(tool)).catch(()=>{}); } catch {} };
  register({name:'read_today_plan',title:'Read today’s Pace plan',description:'Read the same timetable-aware suggestion shown in Pace.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(){const score=todayScore();const day=window.studentPlan?.()[0];const item=day?.items.find(entry=>entry.id.startsWith('movement-'));return {date:dayKey(),sampleData:!state.profile||!!state.demo,readiness:score,title:item?.title||'No open movement window',duration:item?.minutes??null,intensity:item?.minutes<=10?'Gentle or rest':'Easy to moderate',window:item?.time??null,fixedCommitments:day?.items.filter(entry=>entry.kind==='fixed').map(entry=>({title:entry.title,start:entry.time,end:entry.end}))||[]};}});
  register({name:'start_profile_setup',title:'Start Pace profile setup',description:'Open the student profile and goal form.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute(){openModal('student-setup');return {status:'form_open'};}});
  register({name:'save_today_checkin',title:'Save today’s check-in',description:'Save sleep, energy, stress, heart rate and activity for today, then update the visible plan. Requires a saved profile.',inputSchema:{type:'object',properties:{sleep:{type:'number',minimum:0,maximum:12},energy:{type:'integer',minimum:1,maximum:5},stress:{type:'integer',minimum:1,maximum:5},activity:{type:'integer',minimum:0,maximum:600},hr:{type:['integer','null'],minimum:35,maximum:120},workout:{type:'string',enum:['None','Walk','Strength','Cardio','Sport','Mobility']}},required:['sleep','energy','stress','activity'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!state.profile)throw new Error('Complete profile setup before saving a check-in.');if(!input||!Number.isFinite(input.sleep)||input.sleep<0||input.sleep>12||!Number.isInteger(input.energy)||input.energy<1||input.energy>5||!Number.isInteger(input.stress)||input.stress<1||input.stress>5||!Number.isInteger(input.activity)||input.activity<0||input.activity>600||(input.hr!=null&&(!Number.isInteger(input.hr)||input.hr<35||input.hr>120)))throw new Error('Invalid check-in values.');const workout=input.workout||'None';if(!['None','Walk','Strength','Cardio','Sport','Mobility'].includes(workout))throw new Error('Invalid workout.');const result=window.PaceServices.dataService.checkin(state,{...input,workout},dayKey());if(result.error)throw new Error(result.error);const item=result.item;persist();renderDashboard();return {status:'saved',date:item.date,readiness:scoreOf(item)};}});
}
