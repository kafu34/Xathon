import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const context=vm.createContext({window:{},crypto:webcrypto});
for(const file of ['services.js','timetable.js','journey.js'])vm.runInContext(readFileSync(new URL('../dist/'+file,import.meta.url),'utf8'),context);
const S=context.window.PaceServices,T=S.timetableService;
const sunday=new Date('2026-09-27T12:00:00'),monday=new Date('2026-09-28T12:00:00');
const event=(id,start,end,title='Lecture',day='Mon')=>({id,day,start,end,title,location:'Campus',fixed:true});
test('repeated chat moves replace one occurrence and preserve next week',()=>{
  let schedule=[event('lecture','09:00','11:00')];
  for(const [from,to] of [['9 AM','12 PM'],['12 PM','2 PM'],['2 PM','4 PM']]){
    const result=T.changeFromChat(schedule,`My lecture tomorrow changed from ${from} to ${to}`,sunday);
    assert.ok(result.schedule,result.text);schedule=result.schedule;
    assert.equal(T.eventsOn(schedule,monday).length,1);
  }
  assert.equal(schedule.length,2);assert.equal(T.eventsOn(schedule,monday)[0].start,'16:00');
  assert.equal(T.eventsOn(schedule,new Date('2026-10-05T12:00:00'))[0].start,'09:00');
  assert.equal(S.plannerAgent.build({},schedule,[],null,{},monday)[0].items.find(i=>i.kind==='fixed').time,'16:00');
});
test('legacy chained overrides resolve to the latest event',()=>{
  const schedule=[event('a','09:00','11:00'),{...event('b','12:00','14:00'),date:'2026-09-28',replacesId:'a'},{...event('c','15:00','17:00'),date:'2026-09-28',replacesId:'b'}];
  assert.equal(T.eventsOn(schedule,monday).length,1);assert.equal(T.eventsOn(schedule,monday)[0].id,'c');
});
test('clashes, invalid times, ambiguous events and overnight moves do not mutate schedule',()=>{
  const schedule=[event('a','09:00','11:00'),event('b','13:00','15:00','Lab')],before=JSON.stringify(schedule);
  for(const message of ['Move my lecture tomorrow from 9 AM to 2 PM','Move my lecture tomorrow from 9 AM to 11 PM','Move my lecture tomorrow from 9 AM to 25:00','Move my class tomorrow to 5 PM','Move my lecture tomorrow to 5'])assert.equal(T.changeFromChat(schedule,message,sunday).schedule,undefined,message);
  assert.equal(JSON.stringify(schedule),before);
});
test('weekly moves and exact dates are supported',()=>{
  const schedule=[event('a','09:00','11:00')];
  const weekly=T.changeFromChat(schedule,'Move my lecture every Monday from 9 AM to 3 PM',sunday);
  assert.equal(weekly.schedule.length,1);assert.equal(weekly.schedule[0].start,'15:00');
  const dated=T.changeFromChat(schedule,'Move my lecture on 2026-10-05 to 1 PM',sunday);
  assert.equal(T.eventsOn(dated.schedule,new Date('2026-10-05T12:00:00'))[0].start,'13:00');
});
test('OCR parses AM/PM, noon, midnight and 24-hour ranges and skips malformed times',()=>{
  const rows=T.parse('Monday\n9 AM - 11 AM Lecture @ Room 1\n12 PM to 1 PM Lunch\nTuesday 14:00–16:00 Lab\nWed 12 AM - 1 AM Shift\nThu 25:00 - 26:00 Invalid');
  assert.equal(rows.length,4);assert.equal(rows[0].start,'09:00');assert.equal(rows[0].location,'Room 1');assert.equal(rows[1].start,'12:00');assert.equal(rows[2].end,'16:00');assert.equal(rows[3].start,'00:00');
});
test('editor validates weekly and date-specific overlaps',()=>{
  const a=event('a','09:00','11:00');
  assert.match(T.validate([a,event('b','10:00','12:00')]),/overlaps/);
  assert.equal(T.validate([a,event('b','11:00','12:00')]),null);
  assert.match(T.validate([{...a,date:'2026-09-29'}]),/date/);
});
test('exam replacements preserve regular timetable even during an active temporary period',()=>{
  const state={schedule:[event('a','09:00','11:00')],temporary:{active:true,label:'Injury',learning:'pause'},periods:[]};
  const original=JSON.stringify(state.schedule);
  assert.equal(T.replace(state,[event('exam','08:00','10:00','Exam')],true),null);
  T.replace(state,[event('exam','10:00','12:00','Exam')],true);
  T.endTemporary(state);
  assert.equal(JSON.stringify(state.schedule),original);assert.equal(state.temporary.label,'Injury');assert.equal(state.regularSchedule,null);
});
test('an empty regular timetable is restored; replacing an exam with a regular timetable clears the backup',()=>{
  const state={schedule:[],temporary:{active:true,label:'Exam period',learning:'pause'}};
  T.replace(state,[event('exam','08:00','10:00','Exam')],true);T.endTemporary(state);assert.equal(state.schedule.length,0);
  T.replace(state,[event('exam','08:00','10:00','Exam')],true);T.replace(state,[event('new','11:00','12:00')],false);T.endTemporary(state);
  assert.equal(state.schedule[0].id,'new');assert.equal(state.regularSchedule,null);
});
test('recovery and movement windows do not overlap fixed events or each other',()=>{
  const schedule=[event('a','08:00','12:00'),event('b','13:00','20:00','Lab'),event('c','22:00','23:45','Shift')];
  const recovery=S.plannerAgent.recovery({bedtime:'23:30'},schedule,sunday);
  assert.ok(recovery.items.length);
  for(const item of recovery.items)for(const fixed of schedule)assert.ok(S.mins(item.time)>=S.mins(fixed.end)||S.mins(item.end)<=S.mins(fixed.start));
  for(let i=1;i<recovery.items.length;i++)assert.ok(S.mins(recovery.items[i].time)>=S.mins(recovery.items[i-1].end));
  const full=[event('all','00:00','23:59')];assert.equal(S.plannerAgent.recovery({},full,sunday).items.length,0);
});
test('temporary baseline excludes normal entries and older periods',()=>{
  const rows=[{date:'2026-09-20',sleep:8},{date:'2026-09-21',sleep:5,temporary:'Exam period'},{date:'2026-09-27',sleep:6,temporary:'Exam period'}];
  assert.equal(S.patternAgent.find(rows,{active:true,label:'Exam period',learning:'temporary-baseline',started:'2026-09-26'}).count,1);
  assert.equal(S.patternAgent.find(rows,{active:true,label:'Exam period',learning:'pause'}).count,1);
});
