/* Shared timetable rules for the editor, OCR review, coach and planner. */
(() => {
  const S=window.PaceServices, T=S.timetableService;
  const clockPattern='(?:\\d{1,2}(?:[:.]\\d{2})?\\s*(?:am|pm)?)';
  const dayPattern=/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\b/i;
  const dayOf=text=>text.slice(0,3).toLowerCase().replace(/^./,c=>c.toUpperCase());
  const copy=rows=>(rows||[]).map(e=>({...e}));
  T.clock = value => {
    const match=String(value||'').trim().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/i);
    if(!match)return null;
    let hour=Number(match[1]);const minute=Number(match[2]||0),period=match[3]?.toLowerCase();
    if(minute>59||hour>23||(period&&(hour<1||hour>12)))return null;
    if(period)hour=hour%12+(period==='pm'?12:0);
    return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  };
  T.rootId = (event,schedule) => {
    let id=event.replacesId||event.id;const seen=new Set([event.id]);
    while(!seen.has(id)) {seen.add(id);const parent=schedule.find(e=>e.id===id);if(!parent?.replacesId)break;id=parent.replacesId;}
    return id;
  };
  T.eventsOn = (schedule,date) => {
    const rows=schedule||[],specific=new Map();
    for(const e of rows.filter(e=>e.date===S.key(date)))specific.set(T.rootId(e,rows),e);
    return [...rows.filter(e=>!e.date&&e.day===S.days[date.getDay()]&&!specific.has(e.id)),...specific.values()].sort((a,b)=>S.mins(a.start)-S.mins(b.start));
  };
  T.validate = schedule => {
    for(const e of schedule) {
      if(!String(e.title||'').trim()||!S.days.includes(e.day))return 'Each event needs a name and day.';
      if(T.clock(e.start)!==e.start||T.clock(e.end)!==e.end||S.mins(e.end)<=S.mins(e.start))return `Check the start and end time for ${e.title}. Events must finish on the same day.`;
      if(e.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||S.key(new Date(e.date+'T12:00:00'))!==e.date||S.days[new Date(e.date+'T12:00:00').getDay()]!==e.day))return `Check the date and day for ${e.title}.`;
    }
    const groups=S.days.map(day=>schedule.filter(e=>!e.date&&e.day===day));
    for(const date of new Set(schedule.filter(e=>e.date).map(e=>e.date)))groups.push(T.eventsOn(schedule,new Date(date+'T12:00:00')));
    for(const group of groups)for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++) {
      const a=group[i],b=group[j];if(S.mins(a.start)<S.mins(b.end)&&S.mins(a.end)>S.mins(b.start))return `${a.title} overlaps ${b.title} on ${a.date||b.date||a.day}. Please correct the times before saving.`;
    }
    return null;
  };
  T.parse = text => {
    const result=[];let day=null;
    const range=new RegExp(`(${clockPattern})\\s*(?:-|–|—|to)\\s*(${clockPattern})(?=\\s|$)`,'i');
    for(const line of String(text).split(/\r?\n/).map(x=>x.trim()).filter(Boolean)) {
      const found=line.match(dayPattern);if(found)day=dayOf(found[1]);
      const match=line.match(range);if(!day||!match)continue;
      let left=match[1],right=match[2];
      if(!/am|pm/i.test(left)&&/am|pm/i.test(right)&&Number(left.split(/[:.]/)[0])<=12)left+=right.match(/am|pm/i)[0];
      const start=T.clock(left),end=T.clock(right);if(!start||!end||S.mins(end)<=S.mins(start))continue;
      const tail=line.slice(match.index+match[0].length).replace(/^\s*[-|:]\s*/,'').trim();
      const detail=tail||line.slice(0,match.index).replace(dayPattern,'').trim()||'Class';
      const [title,...location]=detail.split(/\s+(?:@|\|)\s+|\s+[—–-]\s+(?=(?:room|block|campus|hall|level)\b)/i);
      result.push({id:crypto.randomUUID(),day,start,end,title:title.slice(0,80),location:location.join(' ').slice(0,80),fixed:true});
    }
    return result;
  };
  T.replace = (state,events,exam,date=new Date()) => {
    const error=T.validate(events);if(error)return error;
    if(exam) {
      if(!Array.isArray(state.regularSchedule)) {
        state.regularSchedule=copy(state.schedule);
        state.preExamTemporary=state.temporary?.active&&state.temporary.label!=='Exam period'?{...state.temporary}:null;
      }
      if(state.temporary?.label!=='Exam period')state.temporary={active:true,label:'Exam period',learning:'pause',started:S.key(date)};
    } else if(Array.isArray(state.regularSchedule)||state.temporary?.label==='Exam period') {
      if(state.temporary?.label==='Exam period')(state.periods||=[]).push({...state.temporary,ended:S.key(date)});
      state.temporary=state.preExamTemporary||null;state.regularSchedule=null;state.preExamTemporary=null;
    }
    state.schedule=copy(events).map(e=>({...e,title:e.title.trim(),location:String(e.location||'').trim(),fixed:true}));
    return null;
  };
  T.endTemporary = (state,date=new Date()) => {
    if(state.temporary)(state.periods||=[]).push({...state.temporary,ended:S.key(date)});
    if(Array.isArray(state.regularSchedule))state.schedule=copy(state.regularSchedule);
    state.temporary=state.preExamTemporary||null;state.regularSchedule=null;state.preExamTemporary=null;
  };
  T.isAddRequest = text => /\b(add|create|schedule|book|put|insert)\b/i.test(text)&&window.PaceIntent.isScheduleRequest(text);
  T.isChangeRequest = text => window.PaceIntent.isScheduleRequest(text);
  T.isAddFollowup = text => /^(?:(?:it|the (?:lab|class|session))\s+(?:ends|finishes)\s+)?(?:(?:until|to|at|for)\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm|hours?|hrs?|minutes?|mins?)?[.!]?$/i.test(text.trim())||/^(?:cancel|never mind|nevermind)$/i.test(text.trim());
  T.addFromChat = (schedule,message,now=new Date(),pending=null) => {
    if(/^(?:cancel|never mind|nevermind)$/i.test(message.trim()))return {pending:null,text:'Cancelled the event draft. Nothing was added.'};
    const explicit=value=>/am|pm|[:.]/i.test(value)||Number(value)>12;
    let event=pending?{...pending}:null,tail=message;
    if(!event){
      if(/\b(?:should|could)\s+I\b/i.test(message))return {text:'I can check a proposed event. To add it, tell me its name, day, start and end time.'};
      const named=message.match(dayPattern),iso=message.match(/\b\d{4}-\d{2}-\d{2}\b/),weekly=/\b(every|each|weekly)\b/i.test(message);
      let date=iso?new Date(iso[0]+'T12:00:00'):/\btomorrow\b/i.test(message)?S.addDays(now,1):/\btoday\b/i.test(message)?new Date(now):named?S.addDays(now,(S.days.indexOf(dayOf(named[1]))-now.getDay()+7)%7):null;
      if(named&&/\bnext\b/i.test(message)&&date&&S.key(date)===S.key(now))date=S.addDays(date,7);
      if(!date||!Number.isFinite(date.getTime())||(iso&&S.key(date)!==iso[0])||(!weekly&&S.key(date)<S.key(now)))return {text:'Nothing added yet. Include a valid day or date, for example “Add a lab on Wednesday from 3 PM to 4 PM”.'};
      const startMatch=message.match(new RegExp(`\\b(?:at|from)\\s+(${clockPattern})(?=\\s|[.!?]|$)`,'i'));
      if(!startMatch||!explicit(startMatch[1])||!T.clock(startMatch[1]))return {text:'Nothing added yet. Include a start time with AM/PM or 24-hour time, such as 3 PM or 15:00.'};
      let title=message.slice(message.search(/\b(add|create|schedule|book|put|insert)\b/i)).replace(/^(add|create|schedule|book|put|insert)\s+(?:(?:a|an|the|my)\s+)?/i,'').split(/\b(?:at|from|on|every|each|tomorrow|today)\b/i)[0].replace(dayPattern,'').replace(/\bweekly\b/ig,'').replace(/["“”]/g,'').trim();
      if(!title||title.length>80)return {text:'Nothing added yet. Include the event name, such as “Add a lab on Wednesday from 3 PM to 4 PM”.'};
      event={id:crypto.randomUUID(),day:S.days[date.getDay()],date:weekly?undefined:S.key(date),start:T.clock(startMatch[1]),end:'',title:title[0].toUpperCase()+title.slice(1),location:'',fixed:true};
      tail=message.slice(startMatch.index+startMatch[0].length);
    }
    const duration=tail.match(/\b(?:for\s+)?(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\b/i);
    const endMatch=tail.match(new RegExp(`(?:until|to|ends?\\s+at|finishes?\\s+at)\\s+(${clockPattern})(?=\\s|[.!?]|$)`,'i'));
    const bare=pending?tail.trim().replace(/[.!]$/,''):null;
    const rawEnd=endMatch?.[1]||(bare&&T.clock(bare)?bare:null);
    let end=rawEnd&&explicit(rawEnd)?T.clock(rawEnd):null;
    if(duration){const minutes=Number(duration[1])*(/hour|hr/i.test(duration[2])?60:1),finish=S.mins(event.start)+minutes;if(minutes>0&&Number.isInteger(minutes)&&finish<1440)end=S.time(finish);else return {pending:event,text:'Nothing added yet. Use a positive duration that finishes on the same day.'};}
    if(!end)return {pending:event,text:`What time does ${event.title} end ${event.date?'on '+event.date:'every '+event.day}? It starts at ${event.start}. Reply “until 4 PM” or “for 1 hour”. Nothing has been added yet.`};
    event.end=end;const error=T.validate([...schedule,event]);
    if(error)return {pending:event,text:`Nothing added. ${error} Edit the start/end times below or cancel this draft.`};
    return {pending:null,schedule:[...copy(schedule),event],event,text:`Saved ${event.title} ${event.date?'on '+event.date:'every '+event.day}, ${event.start}–${event.end}. It now appears in your timetable and plan.`};
  };
  T.changeFromChat = (schedule,message,now=new Date()) => {
    const help='Tell me the event, day and new time, for example “Move my lecture tomorrow from 9 AM to 11 AM”. You can also use Edit saved timetable.';
    if(/\bcancel\w*\b/i.test(message))return {text:'Use Edit saved timetable to remove a cancelled event and confirm the updated schedule.'};
    const named=message.match(dayPattern),iso=message.match(/\b\d{4}-\d{2}-\d{2}\b/),weekly=/\b(every|each|weekly)\b/i.test(message);
    let date;
    if(iso)date=new Date(iso[0]+'T12:00:00');
    else if(/\btomorrow\b/i.test(message))date=S.addDays(now,1);
    else if(/\btoday\b/i.test(message))date=new Date(now);
    else if(named)date=S.addDays(now,(S.days.indexOf(dayOf(named[1]))-now.getDay()+7)%7);
    if(!date||!Number.isFinite(date.getTime())||(iso&&S.key(date)!==iso[0])||(weekly&&!named))return {text:help};
    const pair=message.match(new RegExp(`(?:from|at)\\s+(${clockPattern})\\s+(?:to|until)\\s+(${clockPattern})(?=\\s|[.!?]|$)`,'i'));
    const single=pair?null:message.match(new RegExp(`(?:to|at)\\s+(${clockPattern})(?=\\s|[.!?]|$)`,'i'));
    const rawTime=pair?.[2]||single?.[1];if(!rawTime)return {text:help};
    const explicit=t=>/am|pm|[:.]/i.test(t)||Number(t)>12;
    if(!explicit(rawTime)||(pair&&!explicit(pair[1])))return {text:'Please include AM/PM or use 24-hour times, such as 09:00 and 14:00, so I update the right class.'};
    const start=T.clock(rawTime),old=pair?T.clock(pair[1]):null;
    if(!start||(pair&&!old))return {text:'That time is invalid. Use a time such as 09:00 or 2 PM.'};
    let matches=weekly?schedule.filter(e=>!e.date&&e.day===S.days[date.getDay()]):T.eventsOn(schedule,date);
    if(old)matches=matches.filter(e=>e.start===old);
    const namedMatches=matches.filter(e=>message.toLowerCase().includes(e.title.toLowerCase()));
    if(namedMatches.length)matches=namedMatches;
    else {const kind=message.match(/\b(lecture|lab|tutorial|exam|meeting|shift)\b/i)?.[1];if(kind)matches=matches.filter(e=>e.title.toLowerCase().includes(kind.toLowerCase()));}
    if(matches.length!==1)return {text:matches.length?`I found more than one matching event. Include its exact name and original start time. ${help}`:`I could not find that event on ${S.key(date)}${old?' at '+old:''}. ${help}`};
    const existing=matches[0],endMinutes=S.mins(start)+S.mins(existing.end)-S.mins(existing.start);
    if(endMinutes>=24*60)return {text:'That change would run past midnight. Edit the event with its correct start and end times in Timetable.'};
    const root=T.rootId(existing,schedule),updated={...existing,start,end:S.time(endMinutes)};
    let next;
    if(weekly)next=schedule.map(e=>e.id===existing.id?updated:{...e});
    else {updated.id=existing.date?existing.id:crypto.randomUUID();updated.date=S.key(date);updated.day=S.days[date.getDay()];updated.replacesId=root;next=schedule.filter(e=>!(e.date===updated.date&&T.rootId(e,schedule)===root)).map(e=>({...e}));next.push(updated);}
    const error=T.validate(next);if(error)return {text:`I haven't changed it. ${error}`};
    return {schedule:next,text:`Updated ${existing.title} ${weekly?'every '+updated.day:'on '+updated.date} to ${updated.start}–${updated.end}. ${weekly?'Your weekly timetable':'Only this occurrence'} is updated, and your plan and reminder export now use the new time.`};
  };
})();
