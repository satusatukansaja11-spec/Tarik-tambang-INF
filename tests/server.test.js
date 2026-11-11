import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {io} from 'socket.io-client';
import {createApp} from '../server/index.js';
const config={title:'Multiplayer Word',mode:'solo',questionCount:10,duration:10,difficulty:'semua',teams:[{name:'Kiri',identity:'A',color:'#dc614e',icon:'bolt',count:1,players:[{name:'A',npc:0}]},{name:'Kanan',identity:'B',color:'#4389bb',icon:'shield',count:1,players:[{name:'B',npc:1}]}]};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const emit=(s,event,payload)=>new Promise((res,rej)=>s.timeout(3000).emit(event,payload,(e,r)=>e?rej(e):res(r)));
async function connect(url,cookie){const s=io(url,{transports:['websocket'],...(cookie?{extraHeaders:{Cookie:cookie}}:{})});await new Promise((r,j)=>{s.on('connect',r);s.on('connect_error',j);});return s;}
test('real HTTP, sockets, scoring, timer, authorization, persistence and reconnect',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'tug-test-'));let clock=Date.now(),app;const sockets=[];
 try{
 app=await createApp({dataDir:dir,production:true,now:()=>clock});await new Promise(r=>app.http.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.http.address().port}`;
 const request=async(path,method='GET',body,cookie)=>{const r=await fetch(url+'/api'+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 assert.equal((await request('/health')).status,200);assert.equal((await request('/questions')).status,401);assert.equal((await request('/rooms','POST',config)).status,401);
 const setup=await request('/setup','POST',{password:'classroom-test-2026'});assert.equal(setup.status,200);const cookie=setup.cookie;
 assert.equal((await request('/setup','POST',{password:'another-password'})).status,400);assert.equal((await request('/login','POST',{password:'incorrect-password'})).status,401);
 const bank=(await request('/questions','GET',null,cookie)).data;assert.ok(bank.length>=100);
 const custom={text:'Apa fungsi fitur uji ini?',options:['Benar','Salah A','Salah B','Salah C'],answer:0,chapter:1,category:'Uji',difficulty:'mudah'};
 const q=await request('/questions','POST',custom,cookie);assert.equal(q.status,201);assert.equal((await request('/questions/'+q.data.id,'PUT',{...custom,text:'Apa fungsi fitur yang diperbarui?'},cookie)).status,200);assert.equal((await request('/questions/'+q.data.id,'DELETE',null,cookie)).status,200);
 const created=await request('/rooms','POST',config,cookie);assert.equal(created.status,201);const code=created.data.code;
 const teacher=await connect(url,cookie),a=await connect(url),b=await connect(url),outsider=await connect(url);sockets.push(teacher,a,b,outsider);
 assert.ok((await emit(outsider,'watch',{code})).error);
 await emit(teacher,'watch',{code});let states=[null,null],teacherState=null;teacher.on('state',s=>teacherState=s);a.on('state',s=>states[0]=s);b.on('state',s=>states[1]=s);
 const joined=await emit(a,'join',{code,team:0,slot:0,name:'Arka',npc:3});assert.ok(joined.resumeToken);assert.equal(joined.state.questions[0].answer,undefined);assert.equal(joined.state.questions[1],null);assert.ok(!JSON.stringify(joined.state).includes(joined.resumeToken));
 assert.ok((await emit(b,'join',{code,team:0,slot:0,name:'Bima',npc:4})).error);
 await emit(b,'join',{code,team:1,slot:0,name:'Bima',npc:4});assert.ok((await emit(a,'control',{action:'start'})).error);
 await emit(teacher,'control',{action:'start'});clock+=3400;await wait(160);assert.equal(teacherState.status,'playing');
 const send=async(s,team,choice)=>{const r=app.rooms.get(code);return emit(s,'answer',{team:1-team,choice,round:r.round,questionId:r.deck[team][r.round].id});};
 let r=app.rooms.get(code);await send(a,0,r.deck[0][0].answer);assert.ok((await send(a,0,1)).error);assert.equal(r.position,0);await send(b,1,r.deck[1][0].answer);assert.equal(r.position,0);assert.equal(r.phase,'feedback');assert.equal(r.stats[0].raw,10);
 await emit(teacher,'control',{action:'pause'});const round=r.round;clock+=50000;await wait(160);assert.equal(r.round,round);assert.equal(r.status,'paused');assert.ok((await send(a,0,0)).error);await emit(teacher,'control',{action:'resume'});clock+=2600;await wait(160);assert.equal(r.round,1);
 for(let i=0;i<3;i++){r=app.rooms.get(code);await send(a,0,r.deck[0][r.round].answer);await send(b,1,(r.deck[1][r.round].answer+1)%4);if(i<2){clock+=2600;await wait(160);}}
 assert.equal(r.status,'finished');assert.equal(r.winner,0);assert.equal(r.reason,'boundary');assert.equal(states[0].position,states[1].position);assert.equal((await request('/history','GET',null,cookie)).data.length,1);
 await emit(teacher,'control',{action:'reset'});await emit(teacher,'control',{action:'start'});clock+=3400;await wait(160);clock+=11000;await wait(160);assert.equal(r.stats[0].wrong,1);assert.equal(r.stats[1].wrong,1);assert.equal(r.position,0);
 const a2=await connect(url);sockets.push(a2);const resume=await emit(a2,'join',{code,resumeToken:joined.resumeToken});assert.equal(resume.team,0);assert.equal(resume.slot,0);assert.ok((await send(a,0,0)).error);
 // Finish all remaining rounds equally wrong: a real timed draw, then extend with fresh questions.
 while(r.status!=='finished'){clock+=r.phase==='feedback'?2600:11000;await wait(130);}
 assert.equal(r.winner,null);const previousIds=r.deck.flat().map(q=>q.id);const total=r.deck[0].length;await emit(teacher,'control',{action:'extend'});assert.equal(r.status,'playing');assert.equal(r.deck[0].length,total+5);assert.ok(r.deck[0].slice(total).every(q=>!previousIds.includes(q.id)));
 await emit(teacher,'control',{action:'pause'});
 const snapshot=JSON.stringify(r.stats);for(const s of sockets)s.disconnect();await app.close();app=null;
 app=await createApp({dataDir:dir,production:true,now:()=>clock});assert.equal(app.db.history().length,2);assert.equal(app.rooms.get(code).status,'paused');assert.equal(JSON.stringify(app.rooms.get(code).stats),snapshot);assert.equal(app.db.questions().length,bank.length);
 }finally{for(const s of sockets)s.disconnect();if(app)await app.close();rmSync(dir,{recursive:true,force:true});}
});
