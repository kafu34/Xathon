import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const context=vm.createContext({window:{},crypto:webcrypto});
for(const file of ['services.js','timetable.js','journey.js'])vm.runInContext(readFileSync(new URL('../dist/'+file,import.meta.url),'utf8'),context);
const S=context.window.PaceServices,now=new Date('2026-09-27T10:00:00');
const personal=()=>({...S.dataService.defaults(),profile:{goals:['Improve fitness'],goal:'Improve fitness',bedtime:'23:30',wake:'07:30'}});
test('blank health inputs remain unknown and do not create a readiness score',()=>{
  const state=personal(),result=S.dataService.checkin(state,{sleep:'',energy:'',stress:'',activity:'',steps:'',feeling:'Tired'},'2026-09-27',now);
  assert.ok(result.item);assert.equal(result.item.sleep,null);assert.equal(result.item.activity,null);assert.equal(S.dataService.score(result.item),null);
  assert.ok(S.dataService.checkin(state,{sleep:'',energy:'',stress:'',activity:'',feeling:''},'2026-09-26',now).error);
});
test('partial edits preserve optional fields and temporary labels; dates remain sorted',()=>{
  const state=personal();state.temporary={active:true,label:'Exam period',started:'2026-09-20'};
  S.dataService.checkin(state,{sleep:6,energy:3,stress:4,steps:2000,note:'Study day'},'2026-09-27',now);
  S.dataService.checkin(state,{sleep:8},'2026-09-26',now);state.temporary=null;
  const result=S.dataService.checkin(state,{sleep:7},'2026-09-27',now);
  assert.equal(result.item.steps,2000);assert.equal(result.item.note,'Study day');assert.equal(result.item.temporary,'Exam period');assert.equal(state.entries[0].date,'2026-09-26');
  assert.ok(S.dataService.checkin(state,{sleep:8},'2026-09-28',now).error);
});
test('reset removes all history, backups, approvals and old session identity',()=>{
  const state=personal(),session=state.sessionId;Object.assign(state,{regularSchedule:[{}],preExamTemporary:{active:true},deletedEntries:[{}],approved:['wind-2026-09-27'],feelings:[{}],recoveryPlan:{date:'2026-09-27'},privateExtra:'old'});
  S.dataService.reset(state);assert.equal(state.profile,null);assert.equal(state.regularSchedule,null);assert.equal(state.recoveryPlan,null);assert.equal(state.privateExtra,undefined);assert.equal(state.approved.length,0);assert.equal(state.deletedEntries.length,0);assert.notEqual(state.sessionId,session);
});
test('goal changes preserve priorities and affect the suggested focus',()=>{
  const state=personal(),change=S.goalService.change(state.profile,'Make manage stress my main goal');assert.equal(change.goals[0],'Manage stress');assert.ok(change.goals.includes('Improve fitness'));
  state.profile.goals=change.goals;state.profile.goal=change.goals[0];const plan=S.plannerAgent.build(state.profile,[],[],null,{},now);
  const focus=plan[0].items.find(i=>i.priority);assert.equal(focus.evidence,'stress');
  assert.ok(S.goalService.change(state.profile,'Change my goal to something new').text);assert.equal(S.goalService.change(state.profile,'Change my goal to something new').goals,undefined);
});
test('future activities cannot be completed; wind-down does not train movement duration',()=>{
  const state=personal(),item={id:'wind-2026-09-28',minutes:15,time:'22:45'};
  assert.ok(S.actionService.record(state,item,'2026-09-28','completed',now));assert.equal(state.actions.length,0);
  S.actionService.record(state,{...item,id:'wind-2026-09-27'},'2026-09-27','completed',now);assert.equal(S.actionService.learningRows(state).length,0);assert.equal(state.completed.length,0);
  const walk={id:'movement-2026-09-27',minutes:20,time:'18:00'};S.actionService.record(state,walk,'2026-09-27','completed',now);assert.equal(S.actionService.learningRows(state).length,1);S.actionService.undo(state,walk.id);assert.equal(state.completed.length,0);
});
test('temporary activities do not redefine the regular movement baseline',()=>{
  const state=personal();state.temporary={active:true,label:'Exam period',started:'2026-09-26',learning:'pause'};
  S.actionService.record(state,{id:'movement-2026-09-27',time:'18:00',minutes:10},'2026-09-27','completed',now);assert.equal(S.actionService.learningRows(state).length,0);
  state.temporary.learning='temporary-baseline';assert.equal(S.actionService.learningRows(state).length,1);state.temporary=null;assert.equal(S.actionService.learningRows(state).length,0);
});
test('reminder toggle controls the demo queue and exports include timezone and alarms',()=>{
  const state=personal(),plan=S.plannerAgent.build(state.profile,[],[],null,{},now),item=plan[0].items.find(i=>i.kind==='suggestion');state.approved=[item.id];
  assert.equal(S.calendarService.queue(plan,state).length,0);state.preferences.calendarOn=true;assert.equal(S.calendarService.queue(plan,state).length,1);
  const ics=S.calendarService.ics(plan,state.approved);assert.match(ics,/DTSTART;TZID=Asia\/Singapore:/);assert.match(ics,/BEGIN:VALARM/);assert.match(ics,/TRIGGER:-PT10M/);
});
test('recovery date interprets tomorrow and named days correctly',()=>{
  assert.equal(S.recoveryDate('All-nighter tomorrow',now),'2026-09-28');assert.equal(S.recoveryDate('All-nighter on Thursday',now),'2026-10-01');
});
test('planner respects usual routine without an uploaded timetable and avoids past suggestions',()=>{
  const profile={routine:'Study',days:['Sun'],start:'09:00',end:'17:00',wake:'07:00',bedtime:'23:30'};
  const day=S.plannerAgent.build(profile,[],[],null,{},now)[0];assert.ok(day.items.some(i=>i.kind==='fixed'&&i.time==='09:00'));
  for(const item of day.items.filter(i=>i.kind==='suggestion')){assert.ok(S.mins(item.time)>=600);assert.ok(S.mins(item.end)<=540||S.mins(item.time)>=1020);}
});
test('recovery respects profile routine when a timetable is not uploaded',()=>{
  const profile={routine:'Study',days:['Mon'],start:'09:00',end:'17:00',bedtime:'23:30'};
  const recovery=S.plannerAgent.recovery(profile,[],now);
  for(const item of recovery.items)assert.ok(S.mins(item.end)<=540||S.mins(item.time)>=1020);
});

test('completed and skipped activities stop generating reminder exports',()=>{
  const state=personal(),plan=S.plannerAgent.build(state.profile,[],[],null,{},now),item=plan[0].items.find(i=>i.kind==='suggestion');state.preferences.calendarOn=true;state.approved=[item.id];
  S.actionService.record(state,item,'2026-09-27','completed',now);assert.equal(S.calendarService.queue(plan,state).length,0);assert.ok(!S.calendarService.ics(plan,state.approved,state.actions).includes('BEGIN:VEVENT'));
});
