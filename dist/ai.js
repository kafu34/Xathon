/* Live AI is opt-in. Only a small, selected context is sent to the server. */
(() => {
  state.aiConsent = state.aiConsent === true && state.aiConsentProvider === 'groq';
  state.aiAnalysis ||= null;
  const insightNode=document.createElement('div');insightNode.id='ai-insights';$('#student-trends').before(insightNode);
  const coachStatus=$('#view-coach .chat-header small');
  $('#view-coach .chat-header strong').textContent='Pace AI Coach';
  $('#view-coach .page-heading .heading-sub').textContent='Live model explanations grounded in your timetable, signals and evidence.';
  $('.privacy-note strong').textContent='Your data, with your choice';
  $('.privacy-note p').textContent='Entries are stored in this browser. When you opt in to live AI, selected context is sent to our server and GroqCloud for that request. No account or wearable connection is active.';
  let availability=null,working=false;
  const currentContext=()=>({
    profile:{age:state.profile?.age??null,goals:state.profile?.goals||[state.profile?.goal].filter(Boolean),bedtime:state.profile?.bedtime||'',lifestyle:state.profile?.lifestyle||'',conditions:state.profile?.conditions||'',injuries:state.profile?.injuries||''},
    entries:(state.profile?state.entries:sampleEntries).slice(-21).map(({date,sleep,steps,activity,stress,hr,energy,temporary})=>({date,sleep,steps,activity,stress,hr,energy,temporary})),
    plan:studentPlan(),temporary:state.temporary,actions:state.actions.slice(-20),demo:!!state.demo||!state.profile
  });
  const fingerprint=()=>JSON.stringify({provider:'groq',context:currentContext()});
  async function status() {
    try {const response=await fetch('/api/ai/status',{cache:'no-store'});const data=await response.json();availability=response.ok&&!!data.available;}
    catch {availability=false;}
    coachStatus.textContent=availability?'Live AI available · general guidance only':'Live AI awaiting API setup';
    render();
  }
  function consent() {
    if(state.aiConsent)return Promise.resolve(true);
    return new Promise(resolve=>{
      let settled=false;
      const finish=value=>{if(settled)return;settled=true;observer.disconnect();if(value){state.aiConsent=true;state.aiConsentProvider='groq';persist();}closeModal();render();resolve(value);};
      lastFocus=document.activeElement;
      $('#modal-content').innerHTML='<p class="modal-kicker">LIVE AI · YOUR CHOICE</p><h2 id="modal-title">Share selected data with GroqCloud?</h2><p class="modal-intro">To answer, Pace sends your recent sleep, activity, stress and heart-rate entries, goals, optional lifestyle or health context, fixed timetable, plan follow-through, and recent chat messages to our server and GroqCloud. Your profile name, school and weight are excluded. Nothing is sent until you continue.</p><div class="notice">GroqCloud may temporarily log requests for reliability or abuse review. <a href="https://console.groq.com/docs/your-data" target="_blank" rel="noopener noreferrer">Read Groq’s data controls</a>. The model can make mistakes; advice is general, not a diagnosis. You can turn off sharing in Settings.</div><div class="modal-actions"><button class="link-button" id="ai-consent-cancel">Not now</button><button class="primary-button" id="ai-consent-allow">Continue with AI</button></div>';
      $('#modal-backdrop').hidden=false;document.body.style.overflow='hidden';$('#ai-consent-allow').focus();
      const observer=new MutationObserver(()=>{if($('#modal-backdrop').hidden)finish(false);});observer.observe($('#modal-backdrop'),{attributes:true,attributeFilter:['hidden']});
      $('#ai-consent-allow').addEventListener('click',()=>finish(true));$('#ai-consent-cancel').addEventListener('click',()=>finish(false));
    });
  }
  async function request(kind,extra={}) {
    const response=await fetch(`/api/ai/${kind}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...currentContext(),...extra})});
    let data={};try{data=await response.json();}catch{}
    if(!response.ok)throw new Error(data.error||`http_${response.status}`);
    return data;
  }
  function errorMessage(error) {
    if(error.message==='ai_not_configured')return 'Live AI needs an API key configured by the Site owner.';
    if(error.message==='rate_limited')return 'Live AI has reached its demo request limit. Please try again later.';
    return 'The AI service is unavailable right now. Your timetable and local check-ins are still here.';
  }
  function render() {
    const saved=state.aiAnalysis, fresh=saved?.fingerprint===fingerprint(),data=fresh?saved.data:null;
    const action='<button class="primary-button" data-run-ai type="button" '+(working?'disabled':'')+'>'+(working?'Analyzing…':data?'Refresh AI analysis':'Analyze with AI')+'</button>';
    $('#ai-home').innerHTML=`<article class="surface ai-home-card"><div><span class="ai-kicker">LIVE AI · OPT-IN</span><h2>${data?'Your AI briefing':'Let AI connect the dots'}</h2><p>${data?clean(data.summary):'Ask the model to review your recent signals and choose a realistic step from your timetable-aware plan.'}</p>${data?.recommendedItem?`<small>Suggested: ${clean(data.recommendedItem.title)} · ${clean(data.recommendedItem.time)} on ${clean(data.recommendedItem.date)}</small>`:''}<small class="ai-status">${availability===true?'Model ready':availability===false?'Model setup pending':'Checking model…'} · ${state.demo?'Alex sample data':'Your selected data'}</small></div>${action}</article>`;
    insightNode.innerHTML=`<article class="surface ai-insight-card"><div class="section-heading inner"><div><span class="ai-kicker">MODEL ANALYSIS</span><h2>Short-term trend outlook</h2><p>Exploratory estimates from your own check-ins; no disease prediction.</p></div>${action}</div>${data?`<p class="ai-summary">${clean(data.summary)}</p>${data.recommendedItem?`<p><strong>Plan choice:</strong> ${clean(data.recommendedItem.title)} at ${clean(data.recommendedItem.time)} · ${clean(data.reason)}</p>`:''}<div class="ai-forecast-grid">${data.forecast.length?data.forecast.map(f=>`<div><strong>${clean(f.metric==='hr'?'Resting HR':f.metric[0].toUpperCase()+f.metric.slice(1))}</strong><span>${clean(f.direction)} · ${f.low}–${f.high} ${clean(f.unit)}</span><small>Next 3 days · ${f.sampleSize} entries</small></div>`).join(''):'<p>Add at least four check-ins over several days to show a trend estimate.</p>'}</div>${data.evidenceKey?`<button class="text-button" data-evidence="${clean(data.evidenceKey)}">View evidence</button>`:''}<small>Model interpretation is checked against your fixed plan. Forecast ranges are not clinically validated.</small>`:'<p class="empty-copy">Run analysis after adding check-ins and confirming your timetable. The model will explain only the information you choose to share.</p>'}</article>`;
    $$('[data-run-ai]').forEach(button=>button.addEventListener('click',analyze));
  }
  async function analyze() {
    if(!state.profile){openModal('student-setup');return;}
    if(working||!await consent())return;
    working=true;render();
    try {const before=fingerprint(),data=await request('analysis');state.aiAnalysis={data,fingerprint:before,at:new Date().toISOString()};persist();toast('AI analysis updated.');}
    catch(error){toast(errorMessage(error));}
    finally{working=false;render();}
  }
  async function coach(raw) {
    const message=String(raw||'').trim();if(!message)return;
    if(!state.profile){openModal('student-setup');return;}
    if(!await consent())return;
    state.chat.push({role:'user',text:message});persist();renderCoachChat();
    const send=$('#chat-form button[type="submit"]');send.disabled=true;send.textContent='Thinking…';
    try {
      const data=await request('coach',{message,history:state.chat.slice(-7)});
      state.chat.push({role:'coach',text:data.reply,evidence:data.evidenceKey,model:true});
      $('#coach-action').innerHTML=data.action==='recovery'?'<button class="primary-button" data-open="recovery">Create Recovery Plan <svg><use href="#i-arrow"/></svg></button>':'';
      if(data.action==='recovery'){
        const named=message.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i)?.[1];
        if(named){const target=S.days.findIndex(day=>day.toLowerCase()===named.slice(0,3).toLowerCase());state.recoveryFrom=S.key(S.addDays(new Date(),(target-new Date().getDay()+7)%7));}
        else state.recoveryFrom=null;
      }
    } catch(error){state.chat.push({role:'coach',text:errorMessage(error),model:false});}
    finally{send.disabled=false;send.textContent='Send';persist();renderCoachChat();}
  }
  window.PaceAI={coach,analyze,render};
  const oldRender=window.renderStudentPanels;window.renderStudentPanels=()=>{oldRender();render();};
  const settings=$('#student-settings');
  const oldSettings=window.renderStudentPanels;
  // Settings is recreated on each dashboard render, so attach a small control afterward.
  window.renderStudentPanels=()=>{oldSettings();if(!$('#ai-privacy-settings'))settings.insertAdjacentHTML('beforeend',`<article class="surface ai-settings" id="ai-privacy-settings"><h2>GroqCloud data sharing</h2><p>${state.aiConsent?'You allowed selected context to be sent to GroqCloud when you use AI.':'AI will ask before sending your selected context to GroqCloud.'} Name, school and weight are excluded.</p><button class="outline-button" id="ai-consent-toggle">${state.aiConsent?'Turn off live AI sharing':'Review AI sharing'}</button></article>`);$('#ai-consent-toggle').addEventListener('click',()=>{if(state.aiConsent){state.aiConsent=false;state.aiConsentProvider=null;persist();renderDashboard();toast('Live AI sharing turned off.');}else consent();});};
  status();render();
})();
