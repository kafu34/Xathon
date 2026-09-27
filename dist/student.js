const S = window.PaceServices;
state.schedule ||= [];
state.actions ||= [];
state.approved ||= [];
state.weightEntries ||= [];
state.feelings ||= [];
state.preferences ||= {calendarOn:false,workoutTime:null};
state.contextHistory ||= [];
state.periods ||= [];
state.chat ||= [];
let studentStep=1, studentDraft=null, draftEvents=[], selectedTrend='sleep', uploadedObjectUrl=null;
let draftReady=false, ocrPending=false, ocrGeneration=0;
const clean = escapeHTML;
const numberOrNull = value => value===''||value==null ? null : Number(value);
const demoEvents = [
  {day:'Mon',start:'09:00',end:'11:00',title:'Lecture',location:'Campus',fixed:true},
  {day:'Mon',start:'13:00',end:'15:00',title:'Lab',location:'Science block',fixed:true},
  {day:'Mon',start:'16:00',end:'18:00',title:'Project meeting',location:'Library',fixed:true},
  {day:'Tue',start:'10:00',end:'12:00',title:'Tutorial',location:'Campus',fixed:true},
  {day:'Tue',start:'14:00',end:'17:00',title:'Lab',location:'Science block',fixed:true},
  {day:'Wed',start:'09:00',end:'12:00',title:'Class',location:'Campus',fixed:true},
  {day:'Thu',start:'08:00',end:'10:00',title:'Exam',location:'Exam hall',fixed:true}
].map((e,i)=>({...e,id:`demo-event-${i}`}));
function loadAlexDemo() {
  state.profile={name:'Alex Tan',age:20,school:'National University of Singapore',height:173,weight:72,goals:['Increase energy','Improve fitness'],goal:'Increase energy',conditions:'',injuries:'',lifestyle:'Late-night studying and occasional caffeine',routine:'Study',start:'09:00',end:'18:00',days:['Mon','Tue','Wed','Thu','Fri'],bedtime:'23:30',wake:'07:30',baselineHr:72};
  const sleeps=[6.1,5.7,6.3,5.4,5.8,6.0,6.2],steps=[4200,5200,4700,3900,5100,4800,5700];
  state.entries=sleeps.map((sleep,i)=>({date:dateOffset(i-6),sleep,energy:i===6?2:3,stress:i>=4?4:3,activity:i===3?25:10,steps:steps[i],hr:72+(i===3?2:0),workout:i===3?'Walk':'None',feeling:i===6?'Tired':'Okay',source:'demo',temporary:null}));
  state.schedule=demoEvents.map(e=>({...e}));state.weightEntries=[{date:dateOffset(-6),weight:72}];state.actions=[];state.approved=[];state.preferences={calendarOn:false,workoutTime:null};state.temporary=null;state.regularSchedule=null;state.preExamTemporary=null;state.recoveryPlan=null;state.aiAnalysis=null;state.completed=[];state.chat=[];state.demo=true;cancelTimetableDraft();
  persist();closeModal();renderDashboard();showView('dashboard');toast('Alex demo loaded. All measurements are sample data.');
}
function renderWelcome() {
  $('#modal-content').innerHTML=`<p class="modal-kicker">PACE · SINGAPORE STUDENT DEMO</p><h2 id="modal-title">Health advice that fits your actual student life.</h2><p class="modal-intro">Your tracker can tell you what happened. Pace also looks at classes, exams and routines to suggest what fits next.</p><div class="welcome-choices"><button class="welcome-choice" id="welcome-own"><strong>Set up my own profile</strong><small>Enter your goals and timetable in a local demo session.</small><svg><use href="#i-arrow"/></svg></button><button class="welcome-choice" id="welcome-demo"><strong>Try Alex's sample day</strong><small>Explore a university student scenario with clearly labeled sample data.</small><svg><use href="#i-arrow"/></svg></button></div><div class="notice">No account is created. Data stays in this browser until you choose to use live AI; that action asks before selected context is sent to the model.</div><div class="modal-actions"><button class="link-button" id="welcome-explore">Explore sample dashboard</button></div>`;
  const seen=()=>sessionStorage.setItem('paceWelcomeSeen','1');
  $('#welcome-own').addEventListener('click',()=>{seen();closeModal();openModal('student-setup');});
  $('#welcome-demo').addEventListener('click',()=>{seen();loadAlexDemo();});
  $('#welcome-explore').addEventListener('click',()=>{seen();closeModal();});
}
function studentProfile() { return state.profile || sampleProfile; }
function studentPlan() { return S.plannerAgent.build(studentProfile(),state.schedule,entries(),state.temporary,{...state.preferences,preferredDuration:S.learningAgent.preferredDuration(state.actions)}); }
function renderStudentPanels() {
  syncTodayPlan();renderContext();renderFourDayPlan();renderStudentTrends();renderConfirmedSchedule();renderStudentSettings();renderHealthFact();renderCoachChat();
  const pattern=S.patternAgent.find(state.profile?state.entries:[],state.temporary);
  setText('pattern-title',pattern.title);setText('pattern-copy',pattern.detail);
  const baseline=(state.profile?state.entries:[]).filter(row=>!row.temporary);
  setText('checkin-count',`${Math.min(baseline.length,3)} / 3`);
  $('#progress-fill').style.width=`${Math.min(baseline.length/3,1)*100}%`;
}
window.renderStudentPanels=renderStudentPanels;
function syncTodayPlan() {
  const item=studentPlan()[0]?.items.find(i=>i.id.startsWith('movement-'));if(!item){for(const id of ['plan-title','plan-page-title'])setText(id,'Keep your fixed commitments');for(const id of ['plan-description','plan-page-copy'])setText(id,'No open movement window was found today. Check your timetable or choose a lighter day.');for(const id of ['plan-time','plan-duration','plan-window','plan-intensity'])setText(id,'No movement scheduled');$('#complete-plan').disabled=true;return;}
  const cautious=item.minutes<=10;
  setText('plan-tag',cautious?'RECOVERY-FRIENDLY':'MOVEMENT');
  setText('plan-title',item.title);setText('plan-page-title',item.title);
  setText('plan-description',item.reason);setText('plan-page-copy',item.reason);
  setText('plan-time',`${item.minutes} min · ${item.time}`);setText('plan-duration',`${item.minutes} minutes`);setText('plan-window',item.time);setText('plan-intensity',cautious?'Gentle or rest':'Easy to moderate');
}
function renderContext() {
  const profile=studentProfile(), plan=studentPlan(), next=plan.flatMap(d=>d.items.filter(i=>i.kind==='fixed').map(i=>({...i,date:d.date}))).find(i=>i.date>dayKey()||(i.date===dayKey()&&S.mins(i.end)>new Date().getHours()*60+new Date().getMinutes()));
  const goal=profile.goals?.[0]||profile.goal||'Build a healthier routine';
  const feeling=state.entries.at(-1)?.feeling||state.feelings.at(-1)?.feeling||'Not logged';
  $('#student-context').innerHTML=`<div><span>NEXT COMMITMENT</span><strong>${next?`${clean(next.title)} · ${clean(next.day||new Date(next.date+'T12:00:00').toLocaleDateString('en-SG',{weekday:'short'}))} ${next.time}`:'No fixed event ahead'}</strong></div><div><span>TOP GOAL</span><strong>${clean(goal)}</strong></div><div><span>HOW YOU FEEL</span><strong>${clean(feeling)}</strong></div><button data-view="timetable">Edit timetable <svg><use href="#i-arrow"/></svg></button>`;
}
function renderFourDayPlan() {
  const plan=studentPlan();
  $('#four-day-plan').innerHTML=`<div class="section-heading"><div><h2>Today + the next 3 days</h2><p>Fixed commitments first; suggestions fit in the gaps</p></div><button class="subtle-button" data-view="timetable">Update timetable <svg><use href="#i-arrow"/></svg></button></div>${state.recoveryPlan?`<article class="surface saved-recovery"><strong>Recovery plan · ${clean(state.recoveryPlan.date)}</strong><p>${clean(state.recoveryPlan.note)}</p><div>${state.recoveryPlan.items.map(i=>`<span>${i.time} ${clean(i.title)}</span>`).join('')}</div></article>`:''}<div class="four-day-grid">${plan.map((day,index)=>`<article class="surface day-card"><div class="day-head"><div><small>${index===0?'TODAY':day.day.toUpperCase()}</small><h3>${new Date(day.date+'T12:00:00').toLocaleDateString('en-SG',{weekday:'long',day:'numeric',month:'short'})}</h3></div><span>${day.items.filter(i=>i.kind==='fixed').length} fixed</span></div><p class="day-summary">${clean(day.summary)}</p><div class="day-items">${day.items.map(item=>`<div class="day-item ${item.kind}"><time>${item.time}</time><div><strong>${clean(item.title)}</strong>${item.kind==='suggestion'?`<small>${clean(item.reason)}</small><div class="item-actions"><button data-approve="${clean(item.id)}">${state.approved.includes(item.id)?'Approved':'Approve reminder'}</button><button data-evidence="${item.evidence}">Evidence</button><button data-complete="${clean(item.id)}" data-minutes="${item.minutes}">${state.actions.some(a=>a.id===item.id&&a.status==='completed')?'Done':'Mark done'}</button></div>`:`<small>${clean(item.location||'Fixed commitment')}</small>`}</div></div>`).join('')}</div></article>`).join('')}</div>`;
  if(state.demo)$('#four-day-plan .section-heading').insertAdjacentHTML('afterend','<div class="simulation-note">Demo: a future tracker adapter could detect a matching activity and mark it complete automatically. <button data-simulate-sync>Simulate tracker detection</button></div>');
  $$('#four-day-plan [data-complete]').forEach(button=>button.insertAdjacentHTML('afterend',`<button data-skip="${clean(button.dataset.complete)}">Not today</button>`));
}
const trendConfig={sleep:{label:'Sleep',unit:'h',field:'sleep',goal:'Your goal: at least 7 hours, if feasible',guide:'HealthHub: adults should strive for at least 7 hours'},steps:{label:'Steps',unit:'',field:'steps',goal:'Compare with your own recent baseline',guide:'No universal step target is assumed'},activity:{label:'Active minutes',unit:'min',field:'activity',goal:'Your goal: build a repeatable routine',guide:'Singapore guideline: 150–300 moderate minutes per week'},hr:{label:'Resting HR',unit:'bpm',field:'hr',goal:'Compare with your own baseline only',guide:'A trend here is not a diagnosis'},stress:{label:'Stress',unit:'/5',field:'stress',goal:'Your goal: notice changes during busy periods',guide:'Self-reported; not a clinical measure'},weight:{label:'Weight',unit:'kg',field:'weight',goal:'Weekly check-ins, without pressure',guide:'No weight-loss score or medical claim'},adherence:{label:'Plan follow-through',unit:'%',field:'adherence',goal:'A realistic plan is one you can actually do',guide:'Completion is not a measure of health worth'}};
function renderStudentTrends() {
  const rows=state.profile?state.entries:sampleEntries, weights=state.weightEntries||[], cfg=trendConfig[selectedTrend];
  const values=selectedTrend==='weight'?weights.slice(-7).map(x=>({date:x.date,value:x.weight})):selectedTrend==='adherence'?Array.from({length:7},(_,i)=>{const date=dateOffset(i-6),all=state.approved.filter(id=>id.endsWith(date)),done=state.actions.filter(a=>a.date===date&&a.status==='completed'&&all.includes(a.id));return {date,value:all.length?Math.round(done.length/all.length*100):null};}):rows.slice(-7).map(x=>({date:x.date,value:x[cfg.field]}));
  const valid=values.map(v=>v.value).filter(v=>v!==null&&v!==undefined).map(Number).filter(Number.isFinite),max=Math.max(...valid,selectedTrend==='stress'?5:selectedTrend==='sleep'?9:1);
  $('#student-trends').innerHTML=`<article class="surface trends-card"><div class="section-heading inner"><div><h2>Health trends</h2><p>Personal observations alongside sensible reference points</p></div></div><div class="trend-tabs">${Object.keys(trendConfig).map(key=>`<button class="trend-tab ${key===selectedTrend?'active':''}" data-trend="${key}">${trendConfig[key].label}</button>`).join('')}</div><div class="trend-bars">${values.length?values.map(v=>`<div class="trend-column" title="${clean(v.date)}: ${v.value??'No data'}"><span>${v.value==null?'—':`${v.value}${cfg.unit}`}</span><div class="trend-bar" style="height:${v.value==null?2:Math.max(5,Math.round(Number(v.value)/max*100))}%"></div><small>${new Date(v.date+'T12:00:00').toLocaleDateString('en-SG',{weekday:'short'}).slice(0,2)}</small></div>`).join(''):'<p class="empty-copy">No entries yet.</p>'}</div><div class="trend-notes"><span>${clean(cfg.goal)}</span><small>${clean(cfg.guide)}</small></div></article>`;
}
function renderHealthFact() {
  const fact=S.evidence.sleep;
  $('#health-fact').innerHTML=`<div class="coach-label"><svg><use href="#i-spark"/></svg> HEALTH FACT</div><h3>Sleep is part of the plan.</h3><p>Adults are encouraged to aim for at least seven hours when their schedule allows. A regular wind-down can help.</p><button class="subtle-button" data-evidence="sleep">View evidence <svg><use href="#i-arrow"/></svg></button>`;
}
function renderConfirmedSchedule() {
  const node=$('#confirmed-schedule');if(!node)return;
  const row=e=>`<p><time>${clean(e.start)}–${clean(e.end)}</time><span>${clean(e.title)}${e.location?` · ${clean(e.location)}`:''}</span></p>`;
  const weekly=S.days.slice(1).concat('Sun').map(day=>{const events=state.schedule.filter(e=>!e.date&&e.day===day).sort((a,b)=>S.mins(a.start)-S.mins(b.start));return events.length?`<div class="schedule-day"><strong>${day}</strong><div>${events.map(row).join('')}</div></div>`:'';}).join('');
  const dates=[...new Set(state.schedule.filter(e=>e.date).map(e=>e.date))].sort();
  const changes=dates.map(date=>{const events=S.timetableService.eventsOn(state.schedule,new Date(date+'T12:00:00')).filter(e=>e.date);return `<div class="schedule-day dated-change"><strong>${clean(date)}</strong><div>${events.map(e=>`${row(e)}<small>${e.replacesId?'Replaces the weekly event on this date only.':'One-off event.'}</small>`).join('')}</div>`;}).join('');
  node.innerHTML=state.schedule.length?`<h3>${Array.isArray(state.regularSchedule)?'Temporary exam timetable':'Weekly timetable'}</h3>${weekly||'<p>No repeating events.</p>'}${changes?'<h3>Changes for specific dates</h3>'+changes:''}`:'<div class="empty-copy">No confirmed timetable yet. Upload a screenshot or add events manually.</div>';
}
function renderStudentSettings() {
  const p=studentProfile(),weight=state.weightEntries.at(-1),temp=state.temporary;
  $('#student-settings').innerHTML=`<div class="settings-grid"><article class="surface settings-card"><h2>Student health context</h2><div class="profile-line"><span>School</span><strong>${clean(p.school||'Not set')}</strong></div><div class="profile-line"><span>Age</span><strong>${p.age?`${p.age} years`:'Not set'}</strong></div><div class="profile-line"><span>Height</span><strong>${p.height?`${p.height} cm`:'Not set'}</strong></div><div class="profile-line"><span>Conditions / injury</span><strong>${clean([p.conditions,p.injuries].filter(Boolean).join(' · ')||'None reported')}</strong></div><div class="profile-line"><span>Goals, in priority order</span><strong>${clean((p.goals||[]).join(' → ')||p.goal||'Not set')}</strong></div><button class="outline-button" data-open="student-setup">Edit profile and goals</button></article><article class="surface settings-card"><h2>Weekly weight check-in</h2><p>${weight?`Last logged ${weight.weight} kg on ${prettyDate(weight.date)}.`:'Optional. A weekly entry can show change over time.'}</p><form id="weight-form" class="inline-form"><input type="number" name="weight" min="20" max="400" step="0.1" placeholder="Weight in kg" aria-label="Weight in kilograms" required /><button class="outline-button" type="submit">Save</button></form><small>No score is assigned to weight change.</small></article><article class="surface settings-card"><h2>Temporary lifestyle change</h2><p>${temp?.active?`${clean(temp.label)} active · ${temp.learning==='pause'?'normal baseline paused':'separate temporary baseline'}`:'Exam weeks, injury, illness or travel can be kept separate from your usual baseline.'}</p><button class="outline-button" data-open="temporary">${temp?.active?'Manage period':'Start temporary mode'}</button><small>Past periods stay labelled in your history.</small></article><article class="surface settings-card"><h2>Calendar reminders</h2><label class="toggle-row"><input id="calendar-toggle" type="checkbox" ${state.preferences.calendarOn?'checked':''}/><span>Automatically add approved plan reminders to Google Calendar <em>Demo setting</em></span></label><p>Live Google OAuth is not connected. You can export approved reminders as an .ics file and import it into Google Calendar.</p><button class="outline-button" id="export-calendar">Export approved reminders</button><small>${state.approved.length} plan item${state.approved.length===1?'':'s'} approved</small></article></div>${state.contextHistory.length?`<div class="history-note"><strong>Context history</strong><p>${state.contextHistory.map(h=>`${clean(h.date)}: ${clean(h.label)}`).join(' · ')}</p></div>`:''}`;
  $('#weight-form').addEventListener('submit',event=>{event.preventDefault();if(!state.profile){openModal('student-setup');return;}const value=Number(new FormData(event.currentTarget).get('weight'));if(!Number.isFinite(value)||value<20||value>400)return;state.weightEntries=state.weightEntries.filter(w=>w.date!==dayKey());state.weightEntries.push({date:dayKey(),weight:value});state.profile.weight=value;persist();renderDashboard();toast('Weight check-in saved.');});
  $('#calendar-toggle').addEventListener('change',event=>{state.preferences.calendarOn=event.target.checked;persist();toast('Demo calendar preference saved. Export is available below.');});
  $('#export-calendar').addEventListener('click',exportCalendar);
}
function exportCalendar() {
  const plan=studentPlan(), content=S.calendarService.ics(plan,state.approved);
  if(!state.approved.length){toast('Approve a plan item first.');showView('plan');return;}
  const blob=new Blob([content],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='pace-reminders.ics';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('Calendar file downloaded. Import it into Google Calendar.');
}
function renderCoachChat() {
  const list=state.chat.length?state.chat:[{role:'coach',text:'Hi! I’ll work around your fixed classes, exams and shifts. Ask why I chose a time, tell me what changed, or request an exam recovery plan.'}];
  $('#chat-messages').innerHTML=list.slice(-25).map(m=>`<div class="chat-bubble ${m.role}"><span>${m.role==='coach'?(m.model?'Pace AI Coach':'Pace Coach'):'You'}</span><p>${clean(m.text)}</p>${m.evidence?`<button data-evidence="${m.evidence}">View evidence</button>`:''}</div>`).join('');
  $('#chat-messages').scrollTop=$('#chat-messages').scrollHeight;
}
function renderStudentSetup() {
  if(!studentDraft){studentDraft={...studentProfile(),goals:[...(studentProfile().goals||[studentProfile().goal].filter(Boolean))]};studentStep=1;}
  const p=studentDraft;
  if(studentStep===1) {
    $('#modal-content').innerHTML=`<p class="modal-kicker">STUDENT SETUP · 1 OF 3</p><h2 id="modal-title">Your life beyond the tracker.</h2><p class="modal-intro">Only you can see this browser's data. Share optional health context only if it helps tailor the demo.</p><div class="step-track"><span class="active"></span><span></span><span></span></div><form id="student-step-one"><div class="form-grid"><div class="field"><label for="student-name">Name</label><input id="student-name" name="name" required maxlength="40" value="${clean(p.name||'')}" placeholder="e.g. Alex" /></div><div class="field"><label for="student-age">Age</label><input id="student-age" name="age" type="number" min="17" max="80" value="${p.age||''}" placeholder="e.g. 20" required /></div><div class="field full"><label for="student-school">Polytechnic or university</label><input id="student-school" name="school" required maxlength="80" value="${clean(p.school||'')}" placeholder="e.g. NUS or Singapore Polytechnic" /></div><div class="field"><label for="student-height">Height (cm)</label><input id="student-height" name="height" type="number" min="100" max="250" value="${p.height||''}" placeholder="Optional" /></div><div class="field"><label for="student-weight">Weight (kg)</label><input id="student-weight" name="weight" type="number" min="20" max="400" step="0.1" value="${p.weight||''}" placeholder="Optional · update weekly" /></div><div class="field"><label for="student-conditions">Existing conditions</label><input id="student-conditions" name="conditions" maxlength="120" value="${clean(p.conditions||'')}" placeholder="Optional" /></div><div class="field"><label for="student-injuries">Injury or recovery context</label><input id="student-injuries" name="injuries" maxlength="120" value="${clean(p.injuries||'')}" placeholder="Optional" /></div><div class="field full"><label for="student-lifestyle">Do you regularly do anything else that may affect your health?</label><textarea id="student-lifestyle" name="lifestyle" maxlength="350" placeholder="Caffeine, late-night studying, irregular meals, supplements, smoking or other habits (optional)">${clean(p.lifestyle||'')}</textarea></div></div><div class="modal-actions"><button type="button" class="link-button" id="student-cancel">Cancel</button><button class="primary-button" type="submit">Choose goals <svg><use href="#i-arrow"/></svg></button></div></form>`;
    $('#student-cancel').addEventListener('click',()=>{studentDraft=null;closeModal();});
    $('#student-step-one').addEventListener('submit',event=>{event.preventDefault();const f=new FormData(event.currentTarget);Object.assign(studentDraft,{name:String(f.get('name')).trim(),age:Number(f.get('age')),school:String(f.get('school')).trim(),height:numberOrNull(f.get('height')),weight:numberOrNull(f.get('weight')),conditions:String(f.get('conditions')).trim(),injuries:String(f.get('injuries')).trim(),lifestyle:String(f.get('lifestyle')).trim()});studentStep=2;renderStudentSetup();});
  } else if(studentStep===2) {
    $('#modal-content').innerHTML=`<p class="modal-kicker">STUDENT SETUP · 2 OF 3</p><h2 id="modal-title">What matters to you?</h2><p class="modal-intro">Pick more than one goal. The order below is your priority; you can rearrange it.</p><div class="step-track"><span class="active"></span><span class="active"></span><span></span></div><div class="goal-list">${S.goals.map(g=>`<div class="goal-choice"><button type="button" class="goal-select ${p.goals.includes(g.name)?'selected':''}" data-goal="${clean(g.name)}" aria-pressed="${p.goals.includes(g.name)}">${p.goals.includes(g.name)?'✓ ':''}${clean(g.name)}</button><details><summary>Why this matters</summary><p>${clean(g.why)} <button data-evidence="${g.source}">Source</button></p></details></div>`).join('')}</div><div class="priority-box"><strong>Priority order</strong><div id="priority-items">${p.goals.length?p.goals.map((name,i)=>`<div><span>${i+1}. ${clean(name)}</span><button data-rank="${i}" data-dir="up" aria-label="Move ${clean(name)} up">↑</button><button data-rank="${i}" data-dir="down" aria-label="Move ${clean(name)} down">↓</button></div>`).join(''):'<small>Choose at least one goal.</small>'}</div><button class="link-button" id="suggest-priority">Suggest an order</button></div><div class="modal-actions"><button class="link-button" id="student-back">Back</button><button class="primary-button" id="student-goals-next">Continue <svg><use href="#i-arrow"/></svg></button></div>`;
    $('#student-back').addEventListener('click',()=>{studentStep=1;renderStudentSetup();});
    $$('.goal-select').forEach(button=>button.addEventListener('click',()=>{const name=button.dataset.goal;studentDraft.goals=studentDraft.goals.includes(name)?studentDraft.goals.filter(g=>g!==name):[...studentDraft.goals,name];renderStudentSetup();}));
    $$('[data-rank]').forEach(button=>button.addEventListener('click',()=>{const index=Number(button.dataset.rank),target=index+(button.dataset.dir==='up'?-1:1);if(target<0||target>=studentDraft.goals.length)return;[studentDraft.goals[index],studentDraft.goals[target]]=[studentDraft.goals[target],studentDraft.goals[index]];renderStudentSetup();}));
    $('#suggest-priority').addEventListener('click',()=>{const order=['Improve sleep','Increase energy','Manage stress','Build a healthier routine','Exercise more consistently','Improve fitness'];studentDraft.goals.sort((a,b)=>(order.indexOf(a)<0?99:order.indexOf(a))-(order.indexOf(b)<0?99:order.indexOf(b)));renderStudentSetup();toast('Suggested order added. You can still change it.');});
    $('#student-goals-next').addEventListener('click',()=>{if(!studentDraft.goals.length){toast('Choose at least one goal.');return;}studentStep=3;renderStudentSetup();});
  } else {
    $('#modal-content').innerHTML=`<p class="modal-kicker">STUDENT SETUP · 3 OF 3</p><h2 id="modal-title">A few anchors for your week.</h2><p class="modal-intro">Your uploaded timetable will be the main schedule constraint. Add usual hours here as a starting point.</p><div class="step-track"><span class="active"></span><span class="active"></span><span class="active"></span></div><form id="student-step-three"><div class="form-grid"><div class="field"><label for="student-routine">Main routine</label><select id="student-routine" name="routine">${['Study','Study and part-time work','Shift work','Flexible schedule'].map(v=>`<option ${p.routine===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label for="student-hr">Resting HR baseline, if known</label><input id="student-hr" name="baselineHr" type="number" min="35" max="120" value="${p.baselineHr||''}" placeholder="Optional" /></div><div class="field"><label for="student-start">Typical start</label><input id="student-start" name="start" type="time" value="${p.start||'09:00'}" /></div><div class="field"><label for="student-end">Typical finish</label><input id="student-end" name="end" type="time" value="${p.end||'17:00'}" /></div><div class="field"><label for="student-bedtime">Usual bedtime</label><input id="student-bedtime" name="bedtime" type="time" value="${p.bedtime||'23:30'}" /></div><div class="field"><label for="student-wake">Usual wake time</label><input id="student-wake" name="wake" type="time" value="${p.wake||'07:30'}" /></div><div class="field full"><label for="student-feeling">How are you feeling today? <small>(optional)</small></label><select id="student-feeling" name="feeling"><option value="">Skip for now</option>${['Great','Good','Tired','Stressed','Unwell'].map(v=>`<option>${v}</option>`).join('')}</select></div></div><div class="notice">Pace is a hackathon demo, not a clinician. It will not diagnose conditions or replace your care team.</div><div class="modal-actions"><button type="button" class="link-button" id="student-back">Back</button><button class="primary-button" type="submit">Save and add timetable <svg><use href="#i-check"/></svg></button></div></form>`;
    $('#student-back').addEventListener('click',()=>{studentStep=2;renderStudentSetup();});
    $('#student-step-three').addEventListener('submit',event=>{event.preventDefault();const f=new FormData(event.currentTarget),previous=state.profile?.conditions;Object.assign(studentDraft,{routine:f.get('routine'),baselineHr:numberOrNull(f.get('baselineHr')),start:f.get('start'),end:f.get('end'),bedtime:f.get('bedtime'),wake:f.get('wake'),goal:studentDraft.goals[0],days:['Mon','Tue','Wed','Thu','Fri']});state.profile=studentDraft;if(studentDraft.weight) {state.weightEntries=state.weightEntries.filter(w=>w.date!==dayKey());state.weightEntries.push({date:dayKey(),weight:studentDraft.weight});}if(previous!==undefined&&previous!==studentDraft.conditions)state.contextHistory.push({date:dayKey(),label:`Health context changed from ${previous||'none reported'} to ${studentDraft.conditions||'none reported'}`});const feeling=f.get('feeling');if(feeling)state.feelings.push({date:dayKey(),feeling});persist();studentDraft=null;closeModal();renderDashboard();showView('timetable');toast('Profile saved. Add or review your timetable next.');});
  }
}
function renderStudentDevice() {
  $('#modal-content').innerHTML=`<p class="modal-kicker">TRACKER ADAPTERS</p><h2 id="modal-title">Bring in health signals.</h2><p class="modal-intro">Every provider would map into the same sleep, heart rate, steps, activity and workout format. No live provider is connected in this demo.</p><div class="provider-grid">${['Apple Health','Fitbit','Garmin','Samsung Health','Oura','WHOOP','Health Connect','Other tracker'].map(name=>`<div class="provider-card"><svg><use href="#i-watch"/></svg><strong>${name}</strong><small>Adapter planned</small></div>`).join('')}</div><div class="notice">Sample data is clearly labeled and stays in this browser. No wearable permission is requested.</div><div class="modal-actions"><button class="link-button" id="manual-device">Enter manually</button><button class="primary-button" id="sample-device">Use Alex sample data</button></div>`;
  $('#manual-device').addEventListener('click',()=>{closeModal();if(!state.profile)openModal('student-setup');else openModal('checkin');});
  $('#sample-device').addEventListener('click',loadAlexDemo);
}
function renderEvidence(selected) {
  const entries=selected?[[selected,S.evidence[selected]]]:Object.entries(S.evidence);
  $('#modal-content').innerHTML=`<p class="modal-kicker">WHY THIS ADVICE?</p><h2 id="modal-title">Evidence behind the suggestion.</h2><p class="modal-intro">Sources support general lifestyle guidance. Your personal patterns are observations, not scientific proof or a diagnosis.</p><div class="evidence-list">${entries.filter(([,v])=>v).map(([key,e])=>`<article><span>${clean(e.organisation)} · Accessed 2026</span><h3>${clean(e.title)}</h3><p>${clean(e.why)}</p><a href="${e.url}" target="_blank" rel="noopener noreferrer">Open original source ↗</a></article>`).join('')}</div><div class="modal-actions"><button class="primary-button" id="evidence-done">Done</button></div>`;
  $('#evidence-done').addEventListener('click',closeModal);
}
function renderTemporaryMode() {
  const active=state.temporary?.active;
  $('#modal-content').innerHTML=`<p class="modal-kicker">TEMPORARY CONTEXT</p><h2 id="modal-title">A different week should not redefine you.</h2><p class="modal-intro">Mark an exam, illness, injury or unusual schedule. Pace keeps this period separate from your regular baseline.</p>${active?`<div class="notice"><strong>${clean(state.temporary.label)}</strong> is active. Learning mode: ${state.temporary.learning==='pause'?'paused':'separate temporary baseline'}.</div><div class="modal-actions"><button class="link-button" id="temporary-close">Keep active</button><button class="primary-button" id="temporary-end">End period</button></div>`:`<form id="temporary-form"><div class="form-grid"><div class="field full"><label for="temporary-label">What changed?</label><select id="temporary-label" name="label"><option>Exam period</option><option>Injury</option><option>Illness</option><option>Surgery recovery</option><option>Travel</option><option>Unusual work schedule</option><option>Other temporary change</option></select></div><div class="field full"><span class="field-label">How should learning work?</span><label class="radio-line"><input type="radio" name="learning" value="pause" checked /> Pause learning from this period</label><label class="radio-line"><input type="radio" name="learning" value="temporary-baseline" /> Create a separate temporary baseline</label></div></div><div class="modal-actions"><button class="link-button" type="button" id="temporary-close">Cancel</button><button class="primary-button" type="submit">Start temporary mode</button></div></form>`}`;
  $('#temporary-close').addEventListener('click',closeModal);
  if(active)$('#temporary-end').addEventListener('click',()=>{S.timetableService.endTemporary(state);cancelTimetableDraft();closeModal();scheduleChanged();toast('Temporary period ended. Your previous timetable and context are restored.');});
  else $('#temporary-form').addEventListener('submit',event=>{event.preventDefault();const f=new FormData(event.currentTarget);state.temporary={active:true,label:String(f.get('label')),learning:String(f.get('learning')),started:dayKey()};persist();closeModal();renderDashboard();toast('Temporary mode is active.');});
}
function renderRecoveryPlan() {
  const plan=S.plannerAgent.recovery(studentProfile(),state.schedule,state.recoveryFrom?new Date(`${state.recoveryFrom}T12:00:00`):new Date());
  $('#modal-content').innerHTML=`<p class="modal-kicker">AFTER AN ALL-NIGHTER</p><h2 id="modal-title">A gentler plan for ${clean(plan.date)}.</h2><p class="modal-intro">Your classes and exam remain fixed. This is general recovery guidance, not a way to make lost sleep harmless.</p><div class="recovery-list">${plan.items.map(i=>`<div><time>${i.time}</time><strong>${clean(i.title)}</strong><button data-evidence="${i.evidence}">Evidence</button></div>`).join('')}</div><div class="notice">${clean(plan.note)}</div><div class="modal-actions"><button class="link-button" id="recovery-cancel">Close</button><button class="primary-button" id="recovery-save">Add to my plan</button></div>`;
  $('#recovery-cancel').addEventListener('click',closeModal);
  $('#recovery-save').addEventListener('click',()=>{state.recoveryPlan=plan;persist();closeModal();renderDashboard();showView('plan');toast('Recovery plan added around fixed commitments.');});
}
function renderTimetableRows() {
  $('#timetable-rows').innerHTML=draftEvents.length?draftEvents.map((event,index)=>`<div class="timetable-edit-row" data-row="${index}"><select aria-label="Day for event ${index+1}" data-field="day" ${event.date?'disabled':''}>${S.days.slice(1).concat('Sun').map(day=>`<option ${event.day===day?'selected':''}>${day}</option>`).join('')}</select><input type="time" aria-label="Start time for event ${index+1}" data-field="start" value="${clean(event.start)}" /><input type="time" aria-label="End time for event ${index+1}" data-field="end" value="${clean(event.end)}" /><input aria-label="Activity name for event ${index+1}" data-field="title" maxlength="80" value="${clean(event.title)}" placeholder="Class / exam / shift" /><input aria-label="Location for event ${index+1}" data-field="location" maxlength="80" value="${clean(event.location||'')}" placeholder="Location" /><button aria-label="Remove event ${index+1}" data-remove-row="${index}">×</button>${event.date?`<label class="event-date">This date only <input type="date" aria-label="Date for event ${index+1}" data-field="date" value="${clean(event.date)}" /></label>`:''}</div>`).join(''):'<p class="empty-copy">Upload a timetable image, edit saved events, or add rows manually.</p>';
  $('#confirm-timetable').disabled=ocrPending||!draftReady;
  $('#cancel-timetable').hidden=!draftReady&&!ocrPending;
}
function readDraftRow(event) {const row=event.target.closest('[data-row]');if(!row)return;const item=draftEvents[Number(row.dataset.row)];item[event.target.dataset.field]=event.target.value;if(event.target.dataset.field==='date'&&event.target.value){item.day=S.days[new Date(event.target.value+'T12:00:00').getDay()];row.querySelector('select').value=item.day;}}
function beginTimetableDraft(rows,exam=false) {
  ocrGeneration++;ocrPending=false;draftReady=true;draftEvents=rows.map(e=>({...e}));
  $('#exam-timetable').checked=exam;$('#ocr-raw')?.remove();renderTimetableRows();
}
function scheduleChanged() {
  state.aiAnalysis=null;
  if(state.recoveryPlan?.date)state.recoveryPlan=S.plannerAgent.recovery(studentProfile(),state.schedule,S.addDays(new Date(state.recoveryPlan.date+'T12:00:00'),-1));
  persist();renderDashboard();
}
function cancelTimetableDraft() {
  ocrGeneration++;ocrPending=false;draftReady=false;draftEvents=[];
  $('#ocr-raw')?.remove();$('#timetable-preview-image').hidden=true;$('#timetable-file').value='';
  renderTimetableRows();
}
function sendCoachMessage(message) {
  if(S.timetableService.isChangeRequest(message)||/(?:move|change).*(?:workout|walk|session)/i.test(message))handleCoachMessage(message);
  else if(window.PaceAI)window.PaceAI.coach(message);
  else handleCoachMessage(message);
}
async function extractTimetable(file) {
  if(!file?.type.startsWith('image/')){toast('Choose an image file.');return;}
  const generation=++ocrGeneration;ocrPending=true;draftReady=false;draftEvents=[];$('#ocr-raw')?.remove();renderTimetableRows();
  if(uploadedObjectUrl)URL.revokeObjectURL(uploadedObjectUrl);
  uploadedObjectUrl=URL.createObjectURL(file);$('#timetable-preview-image').src=uploadedObjectUrl;$('#timetable-preview-image').hidden=false;
  setText('ocr-status','Reading text from image in your browser…');
  try {
    if(!window.Tesseract)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';script.onload=resolve;script.onerror=()=>reject(new Error('OCR library could not load'));document.head.append(script);});
    const worker=await window.Tesseract.createWorker('eng');
    let text='';try {const result=await worker.recognize(file);text=result.data.text||'';} finally {await worker.terminate();}
    if(generation!==ocrGeneration)return;
    draftEvents=S.timetableService.parse(text);draftReady=true;
    const detail=document.getElementById('ocr-raw');if(detail)detail.remove();
    $('#timetable-rows').insertAdjacentHTML('afterend',`<details id="ocr-raw"><summary>See OCR text</summary><pre>${clean(text||'No text detected')}</pre></details>`);
    setText('ocr-status',draftEvents.length?`${draftEvents.length} possible event${draftEvents.length===1?'':'s'} found. Please review each row.`:'No clear day/time rows found. Use Add event to enter them manually.');
  } catch(error) {if(generation!==ocrGeneration)return;setText('ocr-status','Automatic reading was unavailable. Your saved timetable is unchanged. Add events manually or try another image.');toast('OCR unavailable; saved events are unchanged.');}
  finally {if(generation===ocrGeneration){ocrPending=false;renderTimetableRows();}}
}
function handleCoachMessage(raw) {
  const message=String(raw||'').trim();if(!message)return;
  state.chat.push({role:'user',text:message});
  let response;
  if(S.timetableService.isChangeRequest(message)) {
    response=S.timetableService.changeFromChat(state.schedule,message);
    if(response.schedule){state.schedule=response.schedule;cancelTimetableDraft();setText('ocr-status','Saved timetable updated through Coach. Reopen the editor to make further changes.');scheduleChanged();}
  } else {
    const move=message.match(/(?:move|change).*(?:workout|walk|session).*(?:to|at)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if(move){
      const requested=S.timetableService.clock(`${move[1]}:${move[2]||'00'}${move[3]||''}`);
      const proposed=S.plannerAgent.build(studentProfile(),state.schedule,entries(),state.temporary,{...state.preferences,workoutTime:requested,preferredDuration:S.learningAgent.preferredDuration(state.actions)})[0]?.items.find(i=>i.id.startsWith('movement-'));
      if(!requested)response={text:'Please use a valid time such as 09:00 or 2 PM.'};
      else if(proposed?.time!==requested)response={text:`The full movement session does not fit at ${requested}. ${proposed?'A free window is '+proposed.time+'–'+proposed.end+'.':'No open movement window was found today.'} Your saved preference is unchanged.`};
      else{state.preferences.workoutTime=requested;state.aiAnalysis=null;response={text:`Movement now prefers ${proposed.time}–${proposed.end} today. On other days I’ll use that time when the full session fits your fixed commitments.`};}
    }
    else {response=S.coachAgent.reply(message,{plan:studentPlan(),profile:studentProfile(),health:S.healthAgent.analyse(entries()),pattern:S.patternAgent.find(state.profile?state.entries:[],state.temporary)});if(response.action==='recovery'){const dayName=message.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i)?.[1];if(dayName){const target=S.days.findIndex(d=>d.toLowerCase()===dayName.slice(0,3).toLowerCase()),offset=(target-new Date().getDay()+7)%7;state.recoveryFrom=S.key(S.addDays(new Date(),offset));}else state.recoveryFrom=null;}}
  }
  state.chat.push({role:'coach',text:response.text,evidence:response.evidence||null});persist();renderDashboard();
  $('#coach-action').innerHTML=response.action==='recovery'?'<button class="primary-button" data-open="recovery">Create Recovery Plan <svg><use href="#i-arrow"/></svg></button>':'';
}
document.addEventListener('click',event=>{
  const evidence=event.target.closest('[data-evidence]');if(evidence){openModal('evidence');renderEvidence(evidence.dataset.evidence);return;}
  const trend=event.target.closest('[data-trend]');if(trend){selectedTrend=trend.dataset.trend;renderStudentTrends();return;}
  const approve=event.target.closest('[data-approve]');if(approve){const id=approve.dataset.approve;state.approved=state.approved.includes(id)?state.approved.filter(x=>x!==id):[...state.approved,id];persist();renderStudentPanels();toast(state.approved.includes(id)?'Reminder approved. Export it in Settings.':'Reminder removed.');return;}
  const complete=event.target.closest('[data-complete]');if(complete){const id=complete.dataset.complete;if(!state.actions.some(a=>a.id===id&&a.status==='completed')){state.actions=state.actions.filter(a=>a.id!==id);state.actions.push({id,date:id.slice(-10),status:'completed',minutes:Number(complete.dataset.minutes),source:'user'});if(id.endsWith(dayKey())&&!state.completed.includes(dayKey()))state.completed.push(dayKey());persist();renderDashboard();toast('Logged. Future suggestions can reflect what fits.');}return;}
  const skip=event.target.closest('[data-skip]');if(skip){const id=skip.dataset.skip;state.actions=state.actions.filter(a=>a.id!==id);state.actions.push({id,date:id.slice(-10),status:'skipped',source:'user'});persist();renderStudentPanels();toast('No problem. Pace will keep the next suggestion manageable.');return;}
  if(event.target.closest('[data-simulate-sync]')){const item=studentPlan()[0]?.items.find(i=>i.id.startsWith('movement-'));if(item){const mockRecord=S.trackerAdapter.normalize({timestamp:`${dayKey()}T${item.time}:00`,workouts:[{started_at:`${dayKey()}T${item.time}:00`,duration_minutes:item.minutes,type:'walk'}]},'demo tracker');const match=S.learningAgent.detect(studentPlan(),[mockRecord])[0];if(match){state.actions=state.actions.filter(a=>a.id!==match.id);state.actions.push({...match,status:'completed'});if(!state.completed.includes(dayKey()))state.completed.push(dayKey());persist();renderDashboard();toast('Demo tracker activity matched the plan and marked it complete.');}}return;}
  const remove=event.target.closest('[data-remove-row]');if(remove){draftEvents.splice(Number(remove.dataset.removeRow),1);renderTimetableRows();return;}
  const question=event.target.closest('[data-question]');if(question){showView('coach');sendCoachMessage(question.dataset.question);return;}
});
$('#load-demo').addEventListener('click',loadAlexDemo);
$('#choose-timetable').addEventListener('click',()=>$('#timetable-file').click());
$('#timetable-file').addEventListener('change',event=>{const file=event.target.files[0];event.target.value='';extractTimetable(file);});
$('#load-demo-timetable').addEventListener('click',()=>{beginTimetableDraft(demoEvents.map(e=>({...e,id:crypto.randomUUID()})));setText('ocr-status','Demo events replace your saved timetable only when confirmed.');});
$('#edit-timetable').addEventListener('click',()=>{beginTimetableDraft(state.schedule,Array.isArray(state.regularSchedule));setText('ocr-status','Editing saved events. Confirm to save, or cancel to keep your existing timetable.');$('.timetable-review').scrollIntoView({behavior:'smooth',block:'center'});});
$('#cancel-timetable').addEventListener('click',()=>{cancelTimetableDraft();setText('ocr-status','Changes cancelled. Your saved timetable is unchanged.');});
$('#add-event').addEventListener('click',()=>{if(!draftReady)beginTimetableDraft(state.schedule,Array.isArray(state.regularSchedule));draftEvents.push({id:crypto.randomUUID(),day:'Mon',start:'09:00',end:'10:00',title:'New class or activity',location:'',fixed:true});renderTimetableRows();});
$('#timetable-rows').addEventListener('input',readDraftRow);
$('#timetable-rows').addEventListener('change',readDraftRow);
$('#confirm-timetable').addEventListener('click',()=>{
  if(ocrPending||!draftReady)return;
  if(!draftEvents.length&&!window.confirm('Remove all events from this timetable?'))return;
  const error=S.timetableService.replace(state,draftEvents,$('#exam-timetable').checked);
  if(error){setText('ocr-status',error);toast(error);return;}
  cancelTimetableDraft();scheduleChanged();setText('ocr-status','Timetable saved. Your four-day plan now uses these events.');toast('Timetable saved and plan updated.');showView('plan');
});
$('#chat-form').addEventListener('submit',event=>{event.preventDefault();const input=$('#chat-input'),message=input.value;input.value='';sendCoachMessage(message);});
renderTimetableRows();
renderDashboard();
if(!state.profile&&!sessionStorage.getItem('paceWelcomeSeen'))openModal('welcome');
