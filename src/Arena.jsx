import React from 'react';
export const npcNames=['Arka','Nadia','Bima','Zahra','Raka','Sari','Damar','Alya','Rio','Hana','Fajar','Nisa','Dito','Maya','Iqbal','Citra','Adnan','Lila','Bayu','Salma','Rafi','Tara','Ilham','Dina'];
const skins=['#e9b88b','#bc805b','#f4cfac','#885636','#c99670','#e3aa81'];
const hairs=['#362b2a','#674134','#191f2c','#7e4b26','#45324c','#bc7c39'];
export function Voxel({id=0,color='#e76552',className='',style={},label=false}){
 const skin=skins[id%6],hair=hairs[Math.floor(id/4)%6],hijab=id%4===3;
 return <svg className={`voxel ${className}`} style={style} viewBox="0 0 76 110" role="img" aria-label={`Karakter ${npcNames[id]}`}>
 <ellipse cx="39" cy="102" rx="29" ry="6" fill="#15372e" opacity=".14"/>
 <g className="npc-body"><path className="leg-left" d="M22 64h14v34H22z" fill="#273c4c"/><path className="leg-right" d="M42 64h14v34H42z" fill="#273c4c"/><path d="M22 92h14v8H18v-6zM42 92h14l5 8H42z" fill="#182b30"/>
 <path d="M20 38h37v37H20z" fill={color}/><path d="m57 38 8 6v31h-8z" fill="#000" opacity=".15"/><path d="m20 38 8-7h31l6 13-8-6z" fill={color}/>
 <path d="M11 43h12v27H11zM55 43h12v27H55z" fill={color}/><path d="M11 60h12v11H11zM55 60h12v11H55z" fill={skin}/>
 <path d="M24 8h32v32H24z" fill={skin}/><path d="m56 8 8 6v27l-8-1z" fill={skin}/><path d="m24 8 8-6h29l3 12-8-6z" fill={hijab?color:hair}/>
 <path d="M22 8h36v10H22zM22 14h7v14h-7zM52 14h8v14h-8z" fill={hijab?color:hair}/>
 {hijab&&<path d="M20 19h6v24h34V19h5v29H20z" fill={color}/>}
 <path d="M32 23h4v5h-4zM46 23h4v5h-4z" fill="#26312e"/><path d="M36 33h9v2h-9z" fill="#a15c50"/>
 {id%6===0&&<path d="M29 22h10v8H29zM43 22h10v8H43zM39 25h4" fill="none" stroke="#233531" strokeWidth="2"/>}
 {id%4===2&&<path d="M22 8h37v6H22zM17 12h44v5H17z" fill={color}/>}
 <path d="M26 46h24v4H26z" fill="#fff" opacity=".35"/></g>{label&&<title>{npcNames[id]}</title>}</svg>;
}
export function Arena({room,preview=false}){
 const teams=room?.config.teams||[{name:'Tim Merah',color:'#e76552',players:[{npc:0},{npc:3},{npc:4}]},{name:'Tim Biru',color:'#4c91c9',players:[{npc:2},{npc:7},{npc:10}]}];
 const position=room?.position||0,finished=room?.status==='finished';
 return <div className={`arena ${preview?'mini-arena':''} ${room?.status==='playing'?'in-play':''}`} aria-label={`Arena tarik tambang. Posisi tali ${position}. Batas kemenangan 6.`}>
 <svg className="landscape" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><pattern id="grass" width="32" height="26" patternUnits="userSpaceOnUse"><path d="m5 22 2-5 2 5m15-10 2-4 2 4" stroke="#84ad62" fill="none" strokeWidth="2"/></pattern></defs>
 <path fill="#dff0ed" d="M0 0h1000v300H0z"/><circle cx="826" cy="47" r="26" fill="#f7d786"/><g fill="#fff" opacity=".85"><path d="M100 45h105v18H90V53h10zM390 26h96v18H375V33h15zM705 66h90v15h-105V73h15z"/></g>
 <path d="m0 143 120-53 135 50 109-63 142 67 110-57 147 62 135-58 102 55v154H0" fill="#bed9b1"/>
 <path d="m0 162 160-36 190 40 175-37 180 34 170-39 125 29v147H0" fill="#a1c58b"/>
 <path fill="#94b976" d="M0 185h1000v115H0z"/><path fill="url(#grass)" d="M0 185h1000v115H0z"/>
 <path d="M500 188v107" stroke="#fffcdf" strokeWidth="4" strokeDasharray="9 6"/>
 <path d="m470 275 30-10 30 10-30 10z" fill="#fff9df" opacity=".8"/>
 <g fill="#487653"><path d="M28 155h10v45H28zM18 128h30v35H18zM951 145h9v48h-9zM938 116h35v39h-35z"/></g>
 </svg>
 <div className="arena-label"><span>WORD VALLEY</span><span>ARENA 01 <i/></span></div>
 <div className="rope-world" style={{transform:`translateX(${-position*5.7}%)`}}>
 <div className="rope-line"/><div className="rope-ribbon"/></div>
 {teams.map((t,side)=><div key={side} style={{'--arrival':side===0?'-45px':'45px',left:`${(side===0?10:65)-(position>0?(side===0?1.2:7.3):(side===0?7.3:1.2))*position}%`}} className={`formation side-${side} ${room?.status==='lobby'?'arriving':''} ${finished?(room.winner===side?'celebrate':room.winner===null?'': 'fallen'):room?.phase==='feedback'?'tug':''}`}>
 {t.players.map((p,i)=><Voxel key={i} id={p.npc} color={t.color} style={{'--npc-scale':t.players.length>5?.78:1,left:`${t.players.length===1?50:15+i*(70/(t.players.length-1))}%`,animationDelay:`${i*.13}s`}}/>)}</div>)}
 <span className="arena-team team-left" style={{color:teams[0].color}}>{teams[0].name}</span><span className="arena-team team-right" style={{color:teams[1].color}}>{teams[1].name}</span>
 {finished&&room.winner!==null&&<div className="confetti" aria-hidden="true">{Array.from({length:24},(_,i)=><i key={i} style={{left:`${i*4.3}%`,background:['#e76552','#f4ce76','#5798ce','#fff'][i%4],animationDelay:`${(i%7)*.12}s`}}/>)}</div>}</div>;
}
