import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDB } from './db.js';
import { validateConfig,validateQuestion,newRoom,makeDeck,recordAnswer,resolveRound,finish,publicRoom,resultRecord,currentSlot } from './game.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const token=()=>randomBytes(24).toString('hex');
function passwordHash(p){const salt=token();return salt+':'+scryptSync(p,salt,64).toString('hex');}
function passwordValid(p,stored){if(typeof p!=='string'||p.length>200||!stored)return false;const [salt,hash]=stored.split(':');return timingSafeEqual(Buffer.from(hash,'hex'),scryptSync(p,salt,64));}
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(s=>s.trim().split('=')));
export async function createApp({dataDir=process.env.DATA_DIR||resolve(root,'data'),production=process.env.NODE_ENV==='production',now=()=>Date.now()}={}) {
 const db=openDB(dataDir),app=express(),http=createServer(app),io=new Server(http,{maxHttpBufferSize:16000});
 const sessions=new Map(),rooms=new Map(db.rooms().map(r=>[r.code,r])),rates=new Map();
 if(!db.getSetting('teacher')&&process.env.TEACHER_PASSWORD){if(process.env.TEACHER_PASSWORD.length<10)throw Error('TEACHER_PASSWORD minimal 10 karakter');db.setSetting('teacher',passwordHash(process.env.TEACHER_PASSWORD));}
 for(const r of rooms.values()){for(const m of r.members)m.online=false;if(['playing','countdown'].includes(r.status)){r.remaining=Math.max(1000,(r.deadline||now())-now());r.resumeStatus=r.status;r.status='paused';r.deadline=null;db.saveRoom(r);}}
 app.disable('x-powered-by');app.use(express.json({limit:'32kb'}));
 app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');if(req.path.startsWith('/api/'))res.setHeader('Cache-Control','no-store');next();});
 const teacher=req=>{const s=sessions.get(cookies(req).teacher);return s&&s.expires>now();};
 const auth=(req,res,next)=>teacher(req)?next():res.status(401).json({error:'Masuk sebagai guru terlebih dahulu.'});
 const limit=(key,max,window=60000)=>{const time=now();const r=rates.get(key);if(!r||time-r.time>window){rates.set(key,{time,count:1});return;}if(++r.count>max)throw Error('Terlalu banyak permintaan. Tunggu sebentar.');};
 const safe=handler=>(req,res,next)=>{try{handler(req,res,next);}catch(e){res.status(400).json({error:e.message});}};
 const save=r=>db.saveRoom(r);
 const broadcast=r=>{save(r);for(const s of io.sockets.sockets.values()){if(s.data.code===r.code)s.emit('state',publicRoom(r,s.data));}};
 const end=(r,reason)=>{finish(r,reason);db.saveHistory(resultRecord(r));broadcast(r);};
 const resolveAnswers=r=>{if(resolveRound(r)){end(r,'boundary');}else if(r.answers.every(Boolean)){r.deadline=now()+2500;broadcast(r);}else broadcast(r);};
 const startRound=r=>{r.phase='question';r.answers=[null,null];r.deadline=now()+r.config.duration*1000;r.revision++;};
 app.get('/api/health',(_q,res)=>res.json({ok:true,service:'Tarik Tambang',database:true}));
 app.get('/api/auth', (req,res)=>res.json({teacher:!!teacher(req),needsSetup:!db.getSetting('teacher')}));
 const login=(req,res,setup)=>{
  limit('login:'+req.ip,10);const p=req.body.password;
  if(typeof p!=='string'||p.length<10||p.length>200)throw Error('Kata sandi harus 10–200 karakter.');
  if(setup){if(db.getSetting('teacher'))throw Error('Akun guru sudah dibuat.');db.setSetting('teacher',passwordHash(p));}
  else if(!passwordValid(p,db.getSetting('teacher')))return res.status(401).json({error:'Kata sandi salah.'});
  const id=token();sessions.set(id,{expires:now()+12*3600000});res.cookie('teacher',id,{httpOnly:true,sameSite:'strict',secure:process.env.COOKIE_SECURE==='true',maxAge:12*3600000,path:'/'}).json({ok:true});
 };
 app.post('/api/setup',safe((req,res)=>login(req,res,true)));
 app.post('/api/login',safe((req,res)=>login(req,res,false)));
 app.post('/api/logout',auth,(req,res)=>{sessions.delete(cookies(req).teacher);for(const s of io.sockets.sockets.values())if(s.data.session===cookies(req).teacher)s.disconnect(true);res.clearCookie('teacher').json({ok:true});});
 app.get('/api/questions',auth,(_q,res)=>res.json(db.questions()));
 app.post('/api/questions',auth,safe((req,res)=>{const q=validateQuestion(req.body);db.putQuestion(q);res.status(201).json(q);}));
 app.put('/api/questions/:id',auth,safe((req,res)=>{if(!db.questions().some(q=>q.id===req.params.id))return res.status(404).json({error:'Soal tidak ditemukan.'});const q=validateQuestion(req.body,req.params.id);db.putQuestion(q);res.json(q);}));
 app.delete('/api/questions/:id',auth,(req,res)=>{db.deleteQuestion(req.params.id);res.json({ok:true});});
 app.get('/api/rooms',auth,(_q,res)=>res.json([...rooms.values()].filter(r=>r.status!=='finished').map(r=>publicRoom(r,{role:'teacher'}))));
 app.post('/api/rooms',auth,safe((req,res)=>{limit('create:'+req.ip,20);const r=newRoom(validateConfig(req.body),db.questions());do{r.code=randomBytes(4).toString('hex').slice(0,6).toUpperCase();}while(rooms.has(r.code));rooms.set(r.code,r);save(r);res.status(201).json(publicRoom(r,{role:'teacher'}));}));
 app.put('/api/rooms/:code',auth,safe((req,res)=>{const r=rooms.get(req.params.code);if(!r||r.status!=='lobby')throw Error('Pengaturan hanya dapat disimpan saat lobi.');const c=validateConfig(req.body);const deck=makeDeck(db.questions(),c.questionCount,c.difficulty);r.config=c;r.deck=deck;r.members=r.members.filter(m=>m.slot<c.teams[m.team].count);broadcast(r);res.json(publicRoom(r,{role:'teacher'}));}));
 app.get('/api/history',auth,(_q,res)=>res.json(db.history()));
 app.use('/api',(_q,res)=>res.status(404).json({error:'Endpoint tidak ditemukan.'}));
 io.use((socket,next)=>{
  const origin=socket.handshake.headers.origin;
  try{if(origin&&new URL(origin).host!==socket.handshake.headers.host)return next(Error('Origin tidak diizinkan.'));}catch{return next(Error('Origin tidak valid.'));}
  next();
 });
 io.on('connection',socket=>{
  const wrap=fn=>(payload={},ack=()=>{})=>{try{limit('socket:'+socket.id,100,10000);const result=fn(payload)||{ok:true};if(typeof ack==='function')ack(result);}catch(e){if(typeof ack==='function')ack({error:e.message});}};
  const getRoom=()=>{const r=rooms.get(socket.data.code);if(!r)throw Error('Room tidak ditemukan.');return r;};
  const requireTeacher=()=>{if(socket.data.role!=='teacher'||!teacher(socket.request))throw Error('Akses guru diperlukan.');};
  socket.on('watch',wrap(({code})=>{if(typeof code!=='string')throw Error('Kode room tidak valid.');if(!teacher(socket.request))throw Error('Sesi guru berakhir. Silakan masuk lagi.');const r=rooms.get(code.toUpperCase());if(!r)throw Error('Room tidak ditemukan.');socket.data={role:'teacher',code:r.code,session:cookies(socket.request).teacher};return {state:publicRoom(r,socket.data)};}));
  socket.on('join',wrap(({code,team,slot,name,npc,resumeToken})=>{
   limit('join:'+socket.handshake.address,40);const r=rooms.get(String(code).toUpperCase());if(!r)throw Error('Kode room tidak ditemukan.');
   const existing=resumeToken&&r.members.find(m=>m.token===resumeToken);
   let m=existing;
   if(!m){if(r.status!=='lobby')throw Error('Pertandingan sudah dimulai. Hanya pemain terdaftar yang dapat tersambung kembali.');if(![0,1].includes(team)||!Number.isInteger(slot)||slot<0||slot>=r.config.teams[team].count)throw Error('Slot pemain tidak valid.');if(r.members.some(m=>m.team===team&&m.slot===slot))throw Error('Slot ini sudah ditempati. Pilih slot lain.');if(typeof name!=='string'||!name.trim()||name.length>40||!Number.isInteger(npc)||npc<0||npc>=24)throw Error('Nama atau karakter tidak valid.');m={id:token().slice(0,12),team,slot,name:name.trim(),npc,token:token(),online:true};r.members.push(m);r.config.teams[team].players[slot]={name:m.name,npc};}
   for(const s of io.sockets.sockets.values())if(s.id!==socket.id&&s.data.memberId===m.id){s.data={};s.emit('replaced');}
   Object.assign(socket.data,{role:'student',code:r.code,team:m.team,slot:m.slot,memberId:m.id});m.online=true;broadcast(r);return {state:publicRoom(r,socket.data),resumeToken:m.token,team:m.team,slot:m.slot};
  }));
  socket.on('answer',wrap(({choice,round,questionId,team})=>{const r=getRoom();const t=socket.data.role==='teacher'?team:socket.data.team;if(socket.data.role==='teacher')requireTeacher();if(![0,1].includes(t))throw Error('Tim tidak valid.');if(socket.data.role==='student'&&currentSlot(r,t)!==socket.data.slot)throw Error('Belum giliran Anda.');if(r.status!=='playing'||r.phase!=='question'||now()>=r.deadline)throw Error('Waktu menjawab sudah berakhir.');if(round!==r.round||questionId!==r.deck[t][r.round].id)throw Error('Soal sudah berubah.');recordAnswer(r,t,choice,socket.data.role);resolveAnswers(r);}));
  socket.on('control',wrap(({action})=>{
   requireTeacher();const r=getRoom();
   if(action==='start'){if(r.status!=='lobby')throw Error('Pertandingan tidak dalam lobi.');r.status='countdown';r.deadline=now()+3300;r.revision++;}
   else if(action==='pause'){if(!['playing','countdown'].includes(r.status))throw Error('Tidak dapat dijeda.');r.remaining=Math.max(1,r.deadline-now());r.resumeStatus=r.status;r.status='paused';r.deadline=null;}
   else if(action==='resume'){if(r.status!=='paused')throw Error('Pertandingan tidak dijeda.');r.status=r.resumeStatus||'playing';r.deadline=now()+r.remaining;}
   else if(action==='shuffle'){if(r.status!=='lobby')throw Error('Acak soal hanya sebelum mulai.');r.deck=makeDeck(db.questions(),r.config.questionCount,r.config.difficulty);}
   else if(action==='end'){if(!['playing','paused','countdown'].includes(r.status))throw Error('Tidak ada pertandingan aktif.');return end(r,'teacher');}
   else if(action==='reset'){if(['playing','paused','countdown'].includes(r.status))end(r,'reset');const fresh=newRoom(r.config,db.questions());Object.assign(r,{...fresh,code:r.code,members:r.members});}
   else if(action==='extend'){if(r.status!=='finished'||r.winner!==null)throw Error('Soal tambahan hanya untuk hasil seri.');const extra=makeDeck(db.questions(),5,r.config.difficulty,r.deck.flat().map(q=>q.id));r.deck.forEach((d,i)=>d.push(...extra[i]));r.round++;r.status='playing';r.matchId=randomBytes(16).toString('hex');startRound(r);}
   else throw Error('Kontrol tidak valid.');broadcast(r);
  }));
  socket.on('disconnect',()=>{const r=rooms.get(socket.data.code);if(r&&socket.data.memberId){const m=r.members.find(m=>m.id===socket.data.memberId);if(m){m.online=false;broadcast(r);}}});
 });
 const timer=setInterval(()=>{
  for(const r of rooms.values()){
   if(!r.deadline||now()<r.deadline)continue;
   if(r.status==='countdown'){r.status='playing';startRound(r);broadcast(r);}
   else if(r.status==='playing'&&r.phase==='question'){for(let t=0;t<2;t++)if(!r.answers[t])recordAnswer(r,t,null,'timeout');resolveAnswers(r);}
   else if(r.status==='playing'&&r.phase==='feedback'){if(r.round+1>=r.deck[0].length)end(r,'points');else{r.round++;startRound(r);broadcast(r);}}
  }
  for(const [key,r] of rates)if(now()-r.time>120000)rates.delete(key);
  for(const [key,s] of sessions)if(s.expires<now())sessions.delete(key);
 },100);
 let vite;
 if(production){app.use(express.static(resolve(root,'dist')));app.get('/{*path}',(_q,res)=>res.sendFile(resolve(root,'dist/index.html')));}
 else {const {createServer:createVite}=await import('vite');vite=await createVite({root,server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}
 app.use((err,_req,res,_next)=>res.status(400).json({error:err.type==='entity.parse.failed'?'JSON tidak valid.':'Permintaan tidak dapat diproses.'}));
 return {app,http,io,db,rooms,close:async()=>{clearInterval(timer);io.close();await vite?.close();await new Promise(r=>http.close(()=>r()));db.close();}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const instance=await createApp();const port=Number(process.env.PORT)||3000;instance.http.listen(port,process.env.HOST||'0.0.0.0',()=>console.log(`Tarik Tambang berjalan pada port ${port}`));
 for(const sig of ['SIGINT','SIGTERM'])process.on(sig,async()=>{await instance.close();process.exit(0);});
}
