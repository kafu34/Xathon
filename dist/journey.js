/* Shared state, health records, goals, actions and reminder rules. */
(() => {
  const S=window.PaceServices;
  const defaults=()=>({profile:null,entries:[],deletedEntries:[],completed:[],schedule:[],actions:[],approved:[],weightEntries:[],feelings:[],preferences:{calendarOn:false,workoutTime:null},contextHistory:[],periods:[],chat:[],pendingTimetable:null,temporary:null,regularSchedule:null,preExamTemporary:null,recoveryPlan:null,recoveryFrom:null,aiConsent:false,aiConsentProvider:null,aiAnalysis:null,demo:false,sessionId:crypto.randomUUID()});
  const sorted=rows=>[...(rows||[])].sort((a,b)=>a.date.localeCompare(b.date));
  const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')&&S.key(new Date(value+'T12:00:00'))===value;
  S.dataService={
    defaults,sorted,validDate,
    restore(raw){const base=defaults();if(!raw||typeof raw!=='object')return base;for(const key of Object.keys(base)){if(Array.isArray(base[key]))base[key]=Array.isArray(raw[key])?raw[key]:[];else if(raw[key]!==undefined)base[key]=raw[key];}base.preferences={calendarOn:false,workoutTime:null,...base.preferences};base.sessionId||=crypto.randomUUID();return base;},
    reset(state){for(const key of Object.keys(state))delete state[key];Object.assign(state,defaults());},
    baseline(rows,temporary,profile){return sorted(rows).filter(r=>(!profile?.contextStarted||r.date>=profile.contextStarted)&&(temporary?.active&&temporary.learning==='temporary-baseline'?r.temporary===temporary.label&&(!temporary.started||r.date>=temporary.started):!r.temporary));},
    score(entry){if(!entry||['sleep','energy','stress'].some(k=>entry[k]==null||!Number.isFinite(Number(entry[k]))))return null;return Math.round(Math.min(42,Math.max(0,entry.sleep/8*42))+Math.min(33,Math.max(0,entry.energy/5*33))+Math.min(25,Math.max(0,(6-entry.stress)/5*25)));},
    checkin(state,raw,date=S.key(new Date()),now=new Date()){
      if(!state.profile)return {error:'Set up your profile first.'};
      if(!validDate(date)||date>S.key(now))return {error:'Choose today or an earlier date.'};
      const previous=state.entries.find(e=>e.date===date),item={...previous,date,source:'manual'};
      const ranges={sleep:[0,12],energy:[1,5],stress:[1,5],activity:[0,600],hr:[35,120],steps:[0,100000],recovery:[0,100]};
      for(const [field,[min,max]] of Object.entries(ranges)){
        if(!(field in raw))continue;
        const value=raw[field]===''||raw[field]==null?null:Number(raw[field]);
        if(value!==null&&(!Number.isFinite(value)||value<min||value>max||field!=='sleep'&&!Number.isInteger(value)))return {error:`Check your ${field} value.`};
        item[field]=value;
      }
      if('workout' in raw){if(!['','None','Walk','Strength','Cardio','Sport','Mobility'].includes(raw.workout))return {error:'Choose a workout type.'};item.workout=raw.workout||null;}
      for(const field of ['feeling','note'])if(field in raw)item[field]=String(raw[field]||'').trim().slice(0,160);
      if(!Object.keys(ranges).some(k=>item[k]!=null)&&!item.feeling&&!item.note&&!item.workout)return {error:'Add one measurement or tell us how you feel.'};
      if(!previous)item.temporary=state.temporary?.active&&date>=state.temporary.started?state.temporary.label:null;
      state.entries=sorted([...state.entries.filter(e=>e.date!==date),item]);state.aiAnalysis=null;
      return {item};
    }
  };
  const aliases=[['Improve sleep',/\b(sleep|sleeping)\b/i],['Increase energy',/\benergy\b/i],['Improve cardiovascular fitness',/cardiovascular|cardio fitness/i],['Improve fitness',/\bfitness\b/i],['Exercise more consistently',/exercise|work.?out/i],['Reduce sedentary behaviour',/sedentary|sitting/i],['Manage stress',/\bstress\b/i],['Improve nutrition',/nutrition|eat(?:ing)? better|balanced meals/i],['Manage weight',/\bweight\b/i],['Improve recovery',/\brecovery\b/i],['Build a healthier routine',/routine|consistency/i]];
  S.goalService={
    isRequest:text=>/\b(goal|priority|prioriti[sz]e)\b/i.test(text)&&/\b(change|set|make|add|remove|prioriti[sz]e|switch|update)\b/i.test(text),
    change(profile,text){
      if(!profile)return {text:'Set up your profile first so I can save your goals.'};
      const exact=S.goals.filter(g=>text.toLowerCase().includes(g.name.toLowerCase()));
      const matches=exact.length?exact.map(g=>g.name):aliases.filter(([,pattern])=>pattern.test(text)).map(([name])=>name);
      if(matches.length!==1)return {text:'Please name one goal, for example “Make improve sleep my main goal”. You can rank several goals in Settings.'};
      const goal=matches[0],current=profile.goals||[profile.goal].filter(Boolean);
      const goals=/\bremove\b/i.test(text)?current.filter(g=>g!==goal):/\badd\b/i.test(text)?[...new Set([...current,goal])]:[goal,...current.filter(g=>g!==goal)];
      if(!goals.length)return {text:'Keep at least one goal, or choose a replacement in Settings.'};
      return {goals,text:`Saved your goals. Your main goal is ${goals[0].toLowerCase()}; the plan will use this priority.`};
    },
    evidence(profile){return S.goals.find(g=>g.name===(profile.goals?.[0]||profile.goal))?.source||'movement';}
  };
  S.actionService={
    record(state,item,date,status,now=new Date()){
      if(!state.profile)return 'Set up your profile before tracking your plan.';
      if(date>S.key(now))return 'Log this activity on the day it happens.';
      if(!['completed','skipped'].includes(status))return 'Choose a valid activity status.';
      state.actions=state.actions.filter(a=>a.id!==item.id);
      state.actions.push({id:item.id,date,status,minutes:item.minutes,time:item.time,category:item.id.split('-')[0],temporary:state.temporary?.active?state.temporary.label:null,source:'user'});
      state.completed=state.actions.filter(a=>a.status==='completed'&&a.id.startsWith('movement-')).map(a=>a.date);state.aiAnalysis=null;return null;
    },
    learningRows(state){return S.dataService.baseline(state.actions,state.temporary,state.profile).filter(a=>a.id?.startsWith('movement-'));},
    undo(state,id){state.actions=state.actions.filter(a=>a.id!==id);state.completed=state.actions.filter(a=>a.status==='completed'&&a.id.startsWith('movement-')).map(a=>a.date);state.aiAnalysis=null;}
  };
  S.learningAgent.preferredTime=actions=>{
    const values=actions.filter(a=>a.status==='completed'&&a.time).slice(-10).map(a=>S.mins(a.time)).sort((a,b)=>a-b);
    return values.length>=3?S.time(values[Math.floor(values.length/2)]):null;
  };
  S.calendarService.items=(plan,approved,actions=[])=>plan.flatMap(day=>day.items.filter(i=>i.kind==='suggestion'&&approved.includes(i.id)&&!actions.some(a=>a.id===i.id)).map(item=>({...item,date:day.date})));
  S.calendarService.queue=(plan,state)=>state.preferences.calendarOn?S.calendarService.items(plan,state.approved,state.actions):[];
  S.recoveryDate=(message,now=new Date())=>{
    const iso=message.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];if(iso&&validDate(iso))return iso;
    if(/\btomorrow\b/i.test(message))return S.key(S.addDays(now,1));
    const named=message.match(/\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/i)?.[1];
    return named?S.key(S.addDays(now,(S.days.findIndex(day=>day.toLowerCase()===named.slice(0,3).toLowerCase())-now.getDay()+7)%7)):S.key(now);
  };
})();
