/* Pace's six conceptual agents as small, inspectable demo modules. No medical model is claimed. */
(() => {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const evidence = {
    sleep: { title: 'Sleeping well as an adult', organisation: 'HealthHub Singapore', year: '2026', why: 'Adults should strive for at least seven hours of sleep; a regular wind-down routine can help.', url: 'https://www.healthhub.sg/programmes/mindsg/caring-for-ourselves/sleeping-well-adults' },
    movement: { title: 'Singapore Physical Activity Guidelines', organisation: 'Health Promotion Board & SportSG', year: '2022', why: 'Any activity is better than none. Adults are encouraged to build towards 150–300 minutes of moderate activity each week.', url: 'https://www.healthhub.sg/sites/assets/Assets/Programs/pa-lit/pdfs/Singapore_Physical_Activity_Guidelines.pdf' },
    stress: { title: 'Relaxation techniques', organisation: 'HealthHub Singapore', year: '2024', why: 'Breathing and relaxation practices can be a practical way to manage stress.', url: 'https://www.healthhub.sg/sites/assets/Assets/WOD/English/handouts/10stress-management-03.pdf' },
    nutrition: { title: 'Plan your meals with My Healthy Plate', organisation: 'Health Promotion Board', year: '2024', why: 'A balanced meal can include wholegrains, protein, fruit and vegetables without calorie counting.', url: 'https://www.healthhub.sg/well-being-and-lifestyle/food-diet-and-nutrition/plan-your-meals-with-my-healthy-plate' }
  };
  const goals = [
    ['Improve sleep','sleep','Sleep supports alertness and recovery.'],
    ['Increase energy','sleep','Sleep and a manageable routine can support daytime energy.'],
    ['Improve fitness','movement','Regular movement supports physical and mental wellbeing.'],
    ['Improve cardiovascular fitness','movement','Aerobic activity supports heart and lung fitness.'],
    ['Exercise more consistently','movement','A repeatable amount of activity can be easier to sustain.'],
    ['Reduce sedentary behaviour','movement','Breaking up long sitting periods adds useful movement.'],
    ['Manage stress','stress','Short relaxation practices can support stress management.'],
    ['Improve nutrition','nutrition','Balanced meals provide a practical structure for eating well.'],
    ['Manage weight','nutrition','Steady habits are more useful than extreme changes.'],
    ['Improve recovery','sleep','Rest and a suitable activity level help make a routine sustainable.'],
    ['Build a healthier routine','sleep','Small habits can fit alongside a fixed timetable.']
  ].map(([name,source,why]) => ({name,source,why}));
  const pad = n => String(n).padStart(2,'0');
  const key = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const addDays = (date, amount) => { const next = new Date(date); next.setDate(next.getDate()+amount); return next; };
  const mins = time => { const [h,m] = String(time||'00:00').split(':').map(Number); return h*60+(m||0); };
  const time = minute => `${pad(Math.floor(minute/60)%24)}:${pad(minute%60)}`;
  const safeNumber = value => value === undefined || value === null || value === '' ? null : Number(value);
  const trackerAdapter = {
    normalize(raw, provider='manual') {
      return {
        timestamp: raw.timestamp || new Date().toISOString(), source: provider,
        sleep_duration: safeNumber(raw.sleep_duration ?? raw.sleep), sleep_start: raw.sleep_start || null,
        sleep_end: raw.sleep_end || null, resting_heart_rate: safeNumber(raw.resting_heart_rate ?? raw.hr),
        average_heart_rate: safeNumber(raw.average_heart_rate), steps: safeNumber(raw.steps),
        active_minutes: safeNumber(raw.active_minutes ?? raw.activity), workouts: Array.isArray(raw.workouts) ? raw.workouts : raw.workout && raw.workout !== 'None' ? [{type:raw.workout,duration_minutes:raw.activity ?? null}] : [],
        calories_burned: safeNumber(raw.calories_burned), recovery_score: safeNumber(raw.recovery_score),
        hrv_if_available: safeNumber(raw.hrv_if_available)
      };
    },
    fromCheckins(checkins) { return checkins.map(row => this.normalize({...row,timestamp:`${row.date}T12:00:00`},row.source||'manual')); }
  };
  const timetableService = {}; // Implemented by timetable.js before the app starts.
  const profileAgent = { context(profile,temporary) { return {goals:profile.goals||[profile.goal].filter(Boolean),routine:profile.routine,conditions:profile.conditions||'',injuries:profile.injuries||'',temporary}; } };
  const healthAgent = {
    analyse(rows) {
      const recent=(rows||[]).slice(-7), measured=recent.filter(r=>r.sleep!=null), avg=(field)=>{const valid=recent.map(r=>r[field]).filter(v=>v!==null&&v!==undefined&&v!=='').map(Number).filter(Number.isFinite);return valid.length?valid.reduce((a,b)=>a+b,0)/valid.length:null;};
      return {days:recent.length,shortNights:measured.filter(r=>r.sleep<7).length,averageSleep:avg('sleep'),averageSteps:avg('steps'),averageStress:avg('stress'),latest:recent.at(-1)||null};
    }
  };
  const patternAgent = {
    find(rows,temporary) {
      const baseline=(rows||[]).filter(r=>temporary?.active&&temporary.learning==='temporary-baseline' ? r.temporary===temporary.label&&(!temporary.started||r.date>=temporary.started) : !r.temporary);
      if(baseline.length<3) return {title:'Your personal baseline is forming',detail:`${baseline.length} of 3 check-ins collected. Temporary periods are kept separate.`,count:baseline.length};
      const recent=baseline.slice(-14), enough=recent.filter(r=>r.sleep!=null);
      if(!enough.length)return {title:'Add sleep to a check-in',detail:'Your check-ins do not yet include sleep measurements.',count:baseline.length};
      const short=enough.filter(r=>r.sleep<7).length;
      return {title:short>=Math.ceil(enough.length/2)?'Sleep has been tight lately':'Your recent sleep is steadier',detail:`${short} of your last ${enough.length} logged nights were below seven hours. Personal observation — association, not proof of causation.`,count:baseline.length};
    }
  };
  const plannerAgent = {
    build(profile,schedule,rows,temporary,preferences,baseDate=new Date()) {
      const health=healthAgent.analyse(rows), clinicalContext=!!(profile.injuries||profile.conditions),cautious=!!(clinicalContext||temporary?.active||health.latest?.sleep<6||health.latest?.stress>=4);
      return Array.from({length:4},(_,offset)=>{
        const date=addDays(baseDate,offset), fixed=timetableService.eventsOn(schedule,date), busy=fixed.map(e=>({id:e.id,time:e.start,end:e.end,title:e.title,kind:'fixed',location:e.location}));
        const last=fixed.reduce((max,e)=>Math.max(max,mins(e.end)),0);
        const duration=cautious?10:preferences?.preferredDuration?Math.min(30,Math.max(10,preferences.preferredDuration)):offset===0?20:25;
        const fits=start=>start>=8*60&&start+duration<=22*60&&!fixed.some(e=>start<mins(e.end)&&start+duration>mins(e.start));
        const preferred=preferences?.workoutTime?mins(preferences.workoutTime):last?last+20:17*60+30;
        const candidates=[preferred,...Array.from({length:169},(_,i)=>8*60+i*5).sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred))];
        const start=candidates.find(fits);
        const label=clinicalContext?'Rest break or movement if cleared':cautious?'Gentle movement or rest break':offset===0?'Walk in a free window':'Short movement session';
        const reason=clinicalContext?'Follow your clinician’s activity guidance; fixed commitments stay in place.':fixed.length?`Fits a free window around your ${fixed.length} fixed commitment${fixed.length===1?'':'s'}.`:'Fits a free window in your day.';
        const suggested=start===undefined?null:{id:`movement-${key(date)}`,time:time(start),end:time(start+duration),title:label,kind:'suggestion',minutes:duration,evidence:'movement',reason};
        const bedtime=mins(profile.bedtime||'23:30'), wind=bedtime-45;
        const items=[...busy,...(suggested?[suggested]:[])];
        if(wind>=0 && wind+15<=24*60 && !fixed.some(e=>wind<mins(e.end)&&wind+15>mins(e.start)) && (!suggested || wind>=start+duration || wind+15<=start)) items.push({id:`wind-${key(date)}`,time:time(wind),end:time(wind+15),title:'Start winding down',kind:'suggestion',minutes:15,evidence:'sleep',reason:'A short routine before your preferred bedtime.'});
        items.sort((a,b)=>mins(a.time)-mins(b.time));
        return {date:key(date),day:days[date.getDay()],items,summary:start===undefined?'No open movement window from 08:00 to 22:00. Keep your fixed commitments.':fixed.length?`${fixed.length} fixed commitment${fixed.length>1?'s':''}; suggestions fit around them.`:'A more flexible day for a short reset.'};
      });
    },
    recovery(profile,schedule,baseDate=new Date()) {
      const next=addDays(baseDate,1),fixed=timetableService.eventsOn(schedule,next);
      const occupied=fixed.map(e=>[mins(e.start),mins(e.end)]),items=[];
      const add=(preferred,duration,title,evidence,earliest=8*60,latest=24*60)=>{
        const candidates=Array.from({length:193},(_,i)=>8*60+i*5).filter(t=>t>=earliest&&t+duration<=latest).sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred)||a-b);
        const start=candidates.find(t=>!occupied.some(([a,b])=>t<b&&t+duration>a));
        if(start===undefined)return;
        occupied.push([start,start+duration]);items.push({time:time(start),end:time(start+duration),minutes:duration,title,evidence});
      };
      add(8*60,15,'Drink water and eat when you can','nutrition',8*60,12*60);
      add(13*60,20,'Take a rest opportunity in a free window','sleep',12*60,20*60);
      add(19*60,10,'Keep activity light; skip intense training if exhausted','movement',16*60,22*60);
      add(Math.max(8*60,mins(profile.bedtime||'23:30')-30),15,'Ease back toward your usual sleep routine','sleep',18*60);
      items.sort((a,b)=>mins(a.time)-mins(b.time));
      return {date:key(next),items,note:items.length?'These optional recovery windows avoid your fixed commitments. An all-nighter is not healthy; this plan does not replace medical advice.':'No free recovery window was found. Review your timetable; fixed commitments have not been moved.'};
    }
  };
  const coachAgent = {
    reply(input,context) {
      const q=String(input).toLowerCase(), {plan,profile,health,pattern}=context, first=plan?.[0], movement=first?.items.find(e=>e.kind==='suggestion');
      if(/all.?night|stay up all night|pull an all/.test(q)) return {text:'Understood. I’ll keep your exam or study commitment fixed. An all-nighter can affect sleep and recovery. Would you like a gentler plan for the following day?',action:'recovery',evidence:'sleep'};
      if(/why|reason|explain/.test(q)) return {text:`I suggested ${movement?.title.toLowerCase()||'a short break'} at ${movement?.time||'a free time'} because ${movement?.reason||'it fits your schedule'} Your recent sleep average is ${health.averageSleep?.toFixed(1)||'not yet known'} hours. You can move the suggestion if that time does not work.`,evidence:'movement'};
      if(/stress|overwhelmed|anxious/.test(q)) return {text:'That sounds like a demanding day. Your fixed classes stay put. A short pause or breathing break between commitments may feel more manageable than adding a workout.',evidence:'stress'};
      if(/trend|pattern|sleep/.test(q)) return {text:`${pattern.detail} I’m treating this as your own observation, not a diagnosis or proof that one thing caused another.`,evidence:'sleep'};
      if(/injur|surg|fracture|acl|rehab|condition|medicat/.test(q)) return {text:'I can keep the plan general and light. Follow your doctor or physiotherapist’s guidance for treatment and rehabilitation; I cannot prescribe exercises or change medication.',evidence:'movement'};
      if(/alcohol/.test(q)) return {text:'Alcohol can negatively affect health. I can help plan a gentler routine, but I cannot advise on optimizing alcohol consumption.',evidence:'nutrition'};
      return {text:`I’ll keep your fixed timetable in place. Your top goal is ${profile.goals?.[0]||profile.goal||'a healthier routine'}, so I’m suggesting small steps you can realistically fit in. Ask why a time was chosen, describe a schedule change, or tell me if an exam is coming.`,evidence:'movement'};
    }
  };
  const learningAgent = {
    detect(plan,records) { const matches=[];for(const day of plan||[])for(const item of day.items||[]){if(item.kind!=='suggestion'||!item.id.startsWith('movement-'))continue;for(const record of records||[])for(const workout of record.workouts||[]){const started=workout.started_at||record.timestamp;if(!started?.startsWith(day.date))continue;const clock=started.slice(11,16);if(Math.abs(mins(clock)-mins(item.time))<=30&&Number(workout.duration_minutes)>=item.minutes*.75)matches.push({id:item.id,date:day.date,minutes:Number(workout.duration_minutes),source:record.source||'tracker'});}}return matches; },
    preferredDuration(actions) { const done=(actions||[]).filter(a=>a.status==='completed'&&a.minutes),skipped=(actions||[]).filter(a=>a.status==='skipped').length;if(done.length<2)return skipped>=2?15:null;const average=Math.round(done.reduce((sum,a)=>sum+a.minutes,0)/done.length);return skipped>done.length?Math.min(average,15):average; }
  };
  const calendarService = {
    ics(plan,approvedIds) {
      const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Pace Hackathon Demo//EN'];
      for(const day of plan) for(const item of day.items) if(item.kind==='suggestion'&&approvedIds.includes(item.id)) {
        const compact=day.date.replaceAll('-','');
        lines.push('BEGIN:VEVENT',`UID:${item.id}@pace-demo`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`DTSTART:${compact}T${item.time.replace(':','')}00`,`DTEND:${compact}T${item.end.replace(':','')}00`,`SUMMARY:${item.title.replace(/[,;]/g,' ')}`,'DESCRIPTION:Pace demo reminder. Review this suggestion against your own schedule.','END:VEVENT');
      }
      lines.push('END:VCALENDAR');return lines.join('\r\n');
    }
  };
  window.PaceServices={days,evidence,goals,key,addDays,mins,time,trackerAdapter,timetableService,profileAgent,healthAgent,patternAgent,plannerAgent,coachAgent,learningAgent,calendarService};
})();
