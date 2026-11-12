import { randomInt, randomUUID } from 'node:crypto';
export const NPC_COUNT=24;
export const LIMIT=6;
export function shuffle(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
const fail=message=>{throw new Error(message);};
const text=(value,min,max,label)=>typeof value==='string'&&value.trim().length>=min&&value.trim().length<=max?value.trim():fail(`${label} harus ${min}–${max} karakter.`);
const integer=(value,min,max,label)=>Number.isInteger(value)&&value>=min&&value<=max?value:fail(`${label} harus ${min}–${max}.`);
export function validateQuestion(q,id=randomUUID()){
 if(!q||!Array.isArray(q.options)||q.options.length!==4)fail('Soal harus memiliki empat pilihan.');
 const options=q.options.map(o=>text(o,1,240,'Pilihan'));
 if(new Set(options.map(x=>x.toLowerCase())).size!==4)fail('Pilihan jawaban harus berbeda.');
 return {id,text:text(q.text,5,600,'Pertanyaan'),options,answer:integer(q.answer,0,3,'Kunci jawaban'),chapter:integer(q.chapter,1,11,'Bab'),category:text(q.category,1,80,'Kategori'),difficulty:['mudah','sedang','sulit'].includes(q.difficulty)?q.difficulty:fail('Tingkat kesulitan tidak valid.'),explanation:text(q.explanation||`Jawaban: ${options[q.answer]}`,1,800,'Penjelasan')};
}
export function validateConfig(c){
 if(!c||!['solo','team'].includes(c.mode))fail('Pilih mode permainan.');
 if(!Array.isArray(c.teams)||c.teams.length!==2)fail('Dua tim diperlukan.');
 const teams=c.teams.map(t=>{
  if(!/^[A-Z]$/.test(t.identity))fail('Identitas harus A–Z.');
  if(!/^#[0-9a-f]{6}$/i.test(t.color))fail('Warna tim tidak valid.');
  const count=integer(t.count,c.mode==='solo'?1:2,c.mode==='solo'?1:7,'Jumlah pemain');
  if(!Array.isArray(t.players)||t.players.length!==count)fail('Daftar pemain belum lengkap.');
  return {name:text(t.name,1,40,'Nama tim'),identity:t.identity,color:t.color,icon:['bolt','star','shield','flame'].includes(t.icon)?t.icon:'bolt',count,players:t.players.map(p=>({name:text(p.name,1,40,'Nama pemain'),npc:integer(p.npc,0,NPC_COUNT-1,'Karakter')}))};
 });
 if(teams[0].identity===teams[1].identity)fail('Identitas kedua tim harus berbeda.');
 if(teams[0].color.toLowerCase()===teams[1].color.toLowerCase())fail('Warna kedua tim harus berbeda.');
 return {title:text(c.title,3,80,'Nama permainan'),mode:c.mode,teams,questionCount:integer(c.questionCount,10,30,'Jumlah soal per tim'),duration:integer(c.duration,10,120,'Durasi soal'),difficulty:['semua','mudah','sedang','sulit'].includes(c.difficulty)?c.difficulty:fail('Kesulitan tidak valid.')};
}
function prepareQuestion(q){const order=shuffle([0,1,2,3]);return {...q,options:order.map(i=>q.options[i]),answer:order.indexOf(q.answer)};}
export function makeDeck(bank,count,difficulty,exclude=[]){
 const eligible=bank.filter(q=>!exclude.includes(q.id)&&(difficulty==='semua'||q.difficulty===difficulty));
 const buckets=['mudah','sedang','sulit'].map(d=>shuffle(eligible.filter(q=>q.difficulty===d)));
 const pairs=shuffle(buckets.flatMap(b=>{const p=[];for(let i=0;i+1<b.length;i+=2)p.push([b[i],b[i+1]]);return p;}));
 if(pairs.length<count)fail(`Bank soal belum cukup: perlu ${count*2} soal berbeda dengan pasangan kesulitan seimbang. Tambahkan soal atau pilih semua kesulitan.`);
 const selected=pairs.slice(0,count);return [selected.map(p=>prepareQuestion(p[0])),selected.map(p=>prepareQuestion(p[1]))];
}
export function newRoom(config,bank){
 const r={code:'',config,matchId:randomUUID(),status:'lobby',members:[],deck:makeDeck(bank,config.questionCount,config.difficulty),round:0,position:0,stats:[{correct:0,wrong:0,raw:0},{correct:0,wrong:0,raw:0}],answers:[null,null],log:[],createdAt:new Date().toISOString(),phase:'question',revision:0};return r;
}
export function currentSlot(r,team){return r.round%r.config.teams[team].count;}
export function recordAnswer(r,team,choice,actor){
 if(r.status!=='playing'||r.phase!=='question')fail('Jawaban belum dapat dikirim.');
 if(r.answers[team])fail('Tim sudah menjawab soal ini.');
 if(choice!==null)integer(choice,0,3,'Jawaban');
 const q=r.deck[team][r.round];
 const correct=choice===q.answer;
 const stat=r.stats[team];stat[correct?'correct':'wrong']++;stat.raw+=correct?10:-10;
 const entry={team,round:r.round,player:r.config.teams[team].players[currentSlot(r,team)].name,actor,question:q.text,options:q.options,selected:choice,answer:q.answer,correct,explanation:q.explanation};
 r.answers[team]=entry;r.log.push(entry);r.revision++;
 return entry;
}
export function resolveRound(r){
 if(!r.answers.every(Boolean))return false;
 r.position+=(r.answers[0].correct?1:-1)-(r.answers[1].correct?1:-1);
 r.position=Math.max(-LIMIT,Math.min(LIMIT,r.position));
 // Positive advantage means team A pulls left. Entire losing formation crosses center at LIMIT.
 r.phase='feedback';r.revision++;
 return Math.abs(r.position)>=LIMIT;
}
export function finish(r,reason='points'){
 r.status='finished';r.phase='result';r.reason=reason;
 const scores=r.stats.map(s=>Math.max(0,s.raw));
 r.winner=reason==='boundary'?(r.position>0?0:1):scores[0]===scores[1]?null:scores[0]>scores[1]?0:1;
 r.finishedAt=new Date().toISOString();r.deadline=null;r.revision++;
}
export function publicRoom(r,viewer={}){
 const teacher=viewer.role==='teacher';
 return {code:r.code,config:r.config,matchId:r.matchId,status:r.status,phase:r.phase,round:r.round,total:r.deck[0].length,position:r.position,revision:r.revision,stats:r.stats.map(s=>({...s,score:Math.max(0,s.raw)})),members:r.members.map(({token,...m})=>m),deadline:r.deadline||null,remaining:r.remaining||null,winner:r.winner,reason:r.reason,finishedAt:r.finishedAt,
 questions:r.deck.map((deck,team)=>{const q=deck[r.round];if(!q)return null;const visible=teacher||viewer.team===team;return visible?{id:q.id,text:q.text,options:q.options,category:q.category,difficulty:q.difficulty,chapter:q.chapter}:null;}),
 answered:r.answers.map(Boolean),feedback:r.answers.map(a=>a&&{correct:a.correct,selected:a.selected,answer:a.answer,explanation:a.explanation}),
 slots:[currentSlot(r,0),currentSlot(r,1)],log:r.status==='finished'?r.log:[],canExtend:r.status==='finished'&&r.winner===null};
}
export function resultRecord(r){return {id:r.matchId,code:r.code,title:r.config.title,config:r.config,stats:r.stats.map(s=>({...s,score:Math.max(0,s.raw)})),winner:r.winner,reason:r.reason,position:r.position,log:r.log,finishedAt:r.finishedAt};}
