// Finished seasonal vector artwork. Uses the original set's shapes and palette;
// painted animals, litter and guide vignettes are retained separately.
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { path as p, ellipse as e, rect as r, group as g, leaf, svg, random } from './shapes.mjs';

const blue = '#99bdc4', ink = '#70949c', cream = '#fff6df';
const line = (d, color = ink, w = 2.5) => p(d, 'none', color, w);
const sun = e(32, 23, 10, 10, '#edcf8c', '#b69a64', 2) + Array.from({length:8}, (_,i)=>g(line('M32 6V9','#b69a64',2),`rotate(${i*45} 32 23)`)).join('');
const cloud = p('M15 38C2 38 4 22 15 23C12 7 34 5 39 20C55 11 65 38 48 39Z', '#c4d8d7', ink, 2);
const drop = (x,y) => p(`M${x} ${y}q-9 12 0 12q9 0 0-12Z`,blue,ink,1.5);
const flame = p('M31 8C35 25 51 27 48 43C44 62 15 60 14 42C13 32 22 25 24 17Q25 33 29 32Q36 26 31 8Z','#e4a06c','#b67c57',2)+p('M31 31Q46 48 32 53Q18 49 31 31Z','#ffe4a4','none');
// Florida's rare hard frost is rime and glinting ice, never snow: a four-point glint, and a thermometer
// reading low beside a frost-rimmed leaf.
const star = (x,y,r,w) => `M${x} ${y-r}L${x+w} ${y-w}L${x+r} ${y}L${x+w} ${y+w}L${x} ${y+r}L${x-w} ${y+w}L${x-r} ${y}L${x-w} ${y-w}Z`;
const glint = (x,y,r) => p(star(x,y,r,r*.13),'#ffffff','none')+g(p(star(x,y,r*.6,r*.1),'#eef7ff','none'),`rotate(45 ${x} ${y})`);
const onLeaf = (body) => g(body,'translate(21 55) rotate(-24) scale(2.6)');
const frosted = onLeaf(p('M0 0Q-6-8 0-14Q7-8 0 0Z','#ffffff','#ffffff',1.5))+leaf(21,55,2.6,-24,'#a9bda5')
 +onLeaf([[-3,-4,.5],[-2.6,-8,.45],[-1.2,-11.4,.4],[2.6,-5.5,.5],[2.2,-9.6,.45],[.6,-12.6,.35],[-1,-6.5,.3],[1,-3,.35]].map(([x,y,r])=>e(x,y,r,r*.8,'#ffffff')).join(''))
 +glint(10,22,5.5)+glint(27,13,3.5);
const thermometer = r(36,7,13,38,6.5,cream,ink,2)+r(40,27,5,20,2.5,blue,'none')+e(42.5,50,9.5,9.5,blue,ink,2)+e(40,47,2.6,2.6,cream)+line('M49 15h-3.5M49 22h-3.5M49 29h-3.5',ink,1.6);
const flower = Array.from({length:5},(_,i)=>g(e(32,22,8,11,'#e5b1af','#b88c8a',1.8),`rotate(${i*72} 32 32)`)).join('')+e(32,32,7,7,'#edcc88','#b79d6c',1.5);
const rake = line('M45 10L23 43','#9d805e',5)+line('M11 38L35 51','#7e8e87',4)+[0,1,2,3,4].map(i=>line(`M${12+i*5} ${39+i*2.5}l-4 8`,'#7e8e87',2.5)).join('');
const bottle = r(17,27,26,29,6,'#ce9a7d','#986f5c',2)+r(23,19,13,9,2,'#c4c9b5','#7b928b',2);
export const SEASON_ICONS = {
 breezy: line('M9 22H40C56 22 52 7 43 12M8 33H52C65 33 58 51 50 44M12 45H32C45 45 40 57 34 54',ink,3.5),
 heat: g(sun,'translate(18 4) scale(.7)')+r(15,12,11,33,5,'#f5dfc1','#ac7c68',2)+e(20.5,47,10,10,'#da9b82','#ac7c68',2)+line('M21 43V25','#da9b82',4),
 rain: cloud+drop(17,43)+drop(32,46)+drop(47,43),
 storm: cloud+p('M33 34L23 47H32L28 59L45 41H35L40 34Z','#ecd18c','#b5a06e',1.5),
 hurricane: line('M46 14C15 1 1 38 24 49C45 59 65 35 50 22C35 9 18 22 25 35C31 44 46 39 43 30C40 23 33 27 34 32',ink,6),
 fog: line('M13 19H51M7 32H56M16 45H48','#afbfbc',6)+line('M17 17H46M12 30H51M20 43H44','#e9eddf',1.5),
 cold: frosted+thermometer,
 spring: flower,
 summer: sun+line('M9 42Q17 35 25 42T41 42T57 42M9 53Q17 46 25 53T41 53T57 53',ink,3),
 fall: leaf(30,48,2,-35,'#c49b72')+e(44,43,9,11,'#c3a075','#94794f',2)+e(44,35,10,4,'#99825b','#796b4f',2)+line('M44 31l2-6','#796b4f',2),
 winter: p('M13 13Q32 23 51 13L51 29L39 33L47 52L33 57L24 35L13 29Z','#d5a38b','#a57c69',2)+line('M15 20Q33 30 49 20M29 35L42 31M32 43L44 39M35 51L47 47','#fff0cf',4)+line('M34 57l1 3M40 55l1 3M46 53l1 3','#a57c69',2),
 fire: flame,
 douse: p('M13 28H35V38H24L20 52H11L16 36Z','#d89980','#a67965',2)+r(31,25,10,16,3,'#97b4b6',ink,2)+line('M43 30l11-6M44 35l12 1M43 40l10 7',blue,2.5),
 rake,
 torch: bottle+line('M31 20V13Q32 7 44 9L49 17','#7d928d',3)+g(flame,'translate(38 1) scale(.35)'),
 dig: line('M17 13L40 41','#a78863',6)+p('M31 36L42 30Q61 46 49 56Q36 56 31 36Z','#b7c6c0','#788f87',2)+line('M16 38q-8 7 1 12t-1 9M17 47l6-3','#e1cca4',2),
 scope: line('M15 12C49 4 59 31 42 43','#7b9290',5)+e(28,43,17,13,'#b6d5c1','#728f7c',2)+e(28,43,10,9,'#7d9fa5','#5e7c84',2)+e(25,40,3,3,cream),
 sort: ['#9ab08b','#9bbdc6','#e2cb91'].map((c,i)=>r(7+i*18,24,15,28,3,c,'#7e8c78',1.7)+r(6+i*18,20,17,5,2,c,'#7e8c78',1.7)+line(`M${13+i*18} 33v10`,cream,2)).join(''),
 task: r(12,12,40,45,5,'#efdfb9','#ad9874',2)+r(23,8,18,8,3,'#a9bda5','#7e9a7c',2)+[25,36,47].map(y=>line(`M19 ${y}l3 3 5-6`,'#7e9a7c',2)+line(`M33 ${y}h11`,'#b6a784',2)).join(''),
 level: p('M32 8L39 23L56 26L43 38L46 54L32 46L18 54L21 38L8 26L25 23Z','#ecd093','#b39a69',2)+leaf(36,46,1.7,25,'#9bb489'),
 edge: [14,31,48].map(x=>r(x,24,5,30,2,'#c2a17c','#967c5b',1.7)).join('')+line('M12 34H54M12 45H54','#b49b79',2)+line('M10 16Q27 3 44 17M36 16L45 18L43 9','#be8975',3),
 tank: r(13,13,38,44,10,'#d1e1d9',ink,2)+p('M15 36Q25 32 33 36T49 36V47Q49 55 40 55H23Q15 55 15 47Z',blue,'none')+r(23,8,18,6,2,'#a9beb5',ink,2)+line('M20 22V43',cream,3),
};

// Ids must differ from svg()'s own (glass, water, glow, grain): a duplicate resolves to the first.
const defs = `<defs><radialGradient id="soft"><stop stop-color="#fff7d2"/><stop offset=".22" stop-color="#ffd57b" stop-opacity=".9"/><stop offset="1" stop-color="#eeaa64" stop-opacity="0"/></radialGradient><radialGradient id="iceGlow"><stop stop-color="#ffffff" stop-opacity=".9"/><stop offset=".35" stop-color="#e6f3fb" stop-opacity=".5"/><stop offset="1" stop-color="#cfe5f4" stop-opacity="0"/></radialGradient><radialGradient id="fireflyGlow"><stop stop-color="#fbffd8"/><stop offset=".25" stop-color="#e2f27e" stop-opacity=".9"/><stop offset="1" stop-color="#b4d65a" stop-opacity="0"/></radialGradient><radialGradient id="mist"><stop stop-color="#faf9e9" stop-opacity=".25"/><stop offset="1" stop-color="#faf9e9" stop-opacity="0"/></radialGradient><radialGradient id="smoke"><stop stop-color="#c1becb" stop-opacity=".5"/><stop offset=".5" stop-color="#aaa4b5" stop-opacity=".35"/><stop offset="1" stop-color="#aaa4b5" stop-opacity="0"/></radialGradient><filter id="blur"><feGaussianBlur stdDeviation=".9"/></filter><linearGradient id="rain" x2="0" y2="1"><stop stop-color="#a7cad7" stop-opacity="0"/><stop offset=".85" stop-color="#c6e1e9" stop-opacity=".8"/><stop offset="1" stop-color="#f4f7e9" stop-opacity="0"/></linearGradient></defs>`;
const makeFlecks = (seed) => {
 const rng = random(seed);
 return (n,w,h,colors,size=.4) => Array.from({length:n},()=>e(2+rng()*(w-4),2+rng()*(h-4),size*(.3+rng()),size*(.3+rng()),colors[Math.floor(rng()*colors.length)])).join('');
};
function effect(key, flecks) {
 switch(key) {
 case 'wildfire': { const warm = flame.replaceAll('#e4a06c', '#ee914c').replaceAll('#b67c57', '#bd713f').replaceAll('#ffe4a4', '#fff0bd'); return g(warm,'translate(-3 -4) scale(.48 .6)')+g(warm,'translate(8 10) scale(.27 .38)')+g(warm,'translate(-1 14) scale(.24 .3)'); }
 case 'smoke': return e(12,12,12,12,'url(#smoke)')+e(9,8,7,6,'url(#smoke)');
 case 'ember': return e(3,3,3,3,'url(#soft)');
 case 'firefly': return e(4,4,4,4,'url(#fireflyGlow)')+e(4,4,.55,.55,'#f3ffb6');
 case 'fog_wisp': return e(64,24,64,23,'url(#mist)')+e(43,27,38,14,'url(#mist)')+e(88,22,30,12,'url(#mist)');
 case 'raindrop': return r(.8,0,1.4,14,.7,'url(#rain)');
 case 'lightning': {const bolt='M25 0L9 58H20L12 94H24L20 140L33 80H23L32 43H22L34 0Z';return `<g filter="url(#blur)" opacity=".5">${p(bolt,'#f5dd93','#f5dd93',7)}</g>`+p(bolt,'#fff5d4','none');}
 case 'puddle': return `<g filter="url(#blur)">${p('M3 7Q0 2 12 3Q20-1 28 3Q40 5 31 10Q24 15 17 11Q4 15 3 7Z','#aaa994','none')}${p('M4 6Q7 3 15 5Q27 1 32 6Q33 10 20 10Q8 12 4 6Z','#a6c6c6','none')}</g>`+line('M10 5Q16 4 20 5','#e3e9d5',.5);
 case 'leaf_blown': return p('M1 5Q3-1 8 2Q12 6 4 7Z','#c49a70','#977752',.35)+line('M1 6L8 2','#efd0a1',.4);
 case 'petal': return p('M1 4C0-1 5 0 5 2Q6 5 3 5Z','#dfa5ad','none')+line('M2 2l1 2','#f5ccd0',.35);
 case 'seed_fluff': return Array.from({length:13},(_,i)=>line(`M3 4Q${i/3} 2 ${.4+i*.4} ${.5+Math.abs(i-6)*.15}`,'#f5efdc',.22)).join('')+p('M2.7 3.5Q4 4 3 5.7Q2 5 2.7 3.5Z','#a78760','none');
 case 'frost': return e(5,5,3.2,3.2,'url(#iceGlow)')+glint(5,5,4.7);
 case 'resprout': return e(13,20,11,2,'#74634b').replace('/>',' opacity=".22"/>')+p('M5 20L8 12L11 15L14 10L17 16L20 14L22 20Z','#62584b','#82745e',.5)+[0,1,2,3,4,5].map(i=>leaf(8+i*2,18,.45+(i%2)*.18,-50+i*20,'#9fbb6c')).join('');
 case 'scorch': return `<g filter="url(#blur)" opacity=".5">${p('M4 13Q1 7 12 7Q14 1 24 5Q31 2 34 9Q43 9 39 18Q43 24 30 24Q21 30 16 24Q4 27 6 21Q0 19 4 13Z','#7e7565','none')}</g>`+flecks(100,36,23,['#c8bd9e','#aaa38d','#655f53'],.55)+Array.from({length:9},(_,i)=>line(`M${7+i*3.7} 21l-1-3`,'#706854',.7)).join('')+e(17,18,.6,.3,'#e9ac66');
 case 'firebreak': return `<g filter="url(#blur)">${e(17,11,16,10,'#eddfba')}</g>`+[0,1,2,3,4].map(i=>line(`M5 ${5+i*3}Q16 ${3+i*3} 29 ${5+i*3}`,'#c9b88f',.8)).join('')+line('M5 18l3 2m18-17 3 1','#a38a63',.6)+flecks(40,32,21,['#dacba8','#f3e9cd'],.3);
 default: throw Error(`Unknown seasonal effect ${key}`);
 }
}

// A file path, not URL.pathname: that keeps %20 and other escapes, which sharp can't open.
const source = (file) => fileURLToPath(new URL(`./source/seasons/${file}`, import.meta.url));

export async function buildSeasons(emit) {
 // Reset the grain seed for each build, even when invoked twice in one process.
 const flecks = makeFlecks(2036);
 const handoff = JSON.parse(await readFile(new URL('../../docs/art-requests.json',import.meta.url),'utf8'));
 for(const a of handoff.assets) {
  if(a.key.startsWith('ui_')) await emit(a.key,64,64,Buffer.from(svg(64,64,SEASON_ICONS[a.key.slice(3)])),'seasons.mjs');
  else if(a.group === 'Fire and weather effects') await emit(a.key,...a.logical,Buffer.from(svg(...a.logical,defs+effect(a.key, flecks))),'seasons.mjs');
 }
 // Low-contrast quartz painting keeps the game's overlaid runner lines legible.
 const sand = await sharp(source('sand.png')).resize(1080,1080,{fit:'cover'}).toBuffer();
 const flat = await sharp(sand).composite([{input:Buffer.from(svg(270,270,r(0,0,270,270,0,'#f0e5ca').replace('/>',' opacity=".65"/>')))}]).toBuffer();
 const rounded = Buffer.from(svg(270,270,r(0,0,270,270,14,'white')));
 await emit('dig_sand',270,270,await sharp(flat).composite([{input:rounded,blend:'dest-in'}]).png().toBuffer(),'seasons.mjs + source/seasons/sand.png');
 // The scope moves along this exact path: decoration must never shift its tunnel.
 const tunnel='M30 40 C130 90 30 170 120 220 Q160 245 120 285';
 const grains=flecks(3500,180,320,['#d7bd91','#f5e4be','#c3a17b'],.32);
 const burrow=`<defs><clipPath id="frame">${r(0,0,180,320,12,'white')}</clipPath><linearGradient id="depth" x2="0" y2="1"><stop stop-color="#f0deb6"/><stop offset="1" stop-color="#ae8968"/></linearGradient></defs><g clip-path="url(#frame)">${r(0,0,180,320,0,'url(#depth)')}${grains}${r(0,0,180,23,0,'#cbdeda')}${p('M0 29Q20 16 44 28T100 24T180 28V40H0Z','#e7d7ae','none')}${[12,56,102,151].map((x,i)=>leaf(x,29,.8,-30+i*20,'#8fa078')).join('')}${line('M62 39l-7 23 8 14m-8-14-8 3M139 38l-9 26 9 8m-9-8-9 3','#9c805f',1)}${p(tunnel,'none','#92704f',30)}${e(112,288,27,18,'#92704f')}${p(tunnel,'none','#6f5741',23)}${e(112,288,23,15,'#6f5741')}${line('M104 294Q115 300 129 292','#806247',1)}</g>`;
 await emit('burrow_section',180,320,Buffer.from(svg(180,320,burrow)),'seasons.mjs');
 // Explicit reviewed crops preserve antennae, disconnected limbs, ribbon and soft shadows.
 const crops = JSON.parse(await readFile(new URL('./source/seasons/crops.json',import.meta.url),'utf8'));
 for(const [key,box] of Object.entries(crops)) {
  const a=handoff.assets.find(a=>a.key===key), [w,h]=a.pixels;
  let crop=await sharp(source(box.file)).extract(box.rect).png().toBuffer();
  if (box.mask) crop=await sharp(crop).composite([{input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${box.rect.width}" height="${box.rect.height}"><path d="${box.mask}" fill="white"/></svg>`),blend:'dest-in'}]).png().toBuffer();
  const pic=await sharp(crop).trim({threshold:8}).resize(Math.round(w*.94),Math.round(h*.94),{fit:'inside'}).toBuffer({resolveWithObject:true});
  const top=a.anchor.startsWith('bottom')?h-pic.info.height:Math.round((h-pic.info.height)/2);
  let canvas=await sharp({create:{width:w,height:h,channels:4,background:'#00000000'}}).composite([{input:pic.data,left:Math.round((w-pic.info.width)/2),top}]).png().toBuffer();
  if(a.group==='Field guide cards') {
   canvas=await sharp(source(box.file)).extract(box.rect).flatten({background:'#ecdfb8'}).resize(w,h,{fit:'cover'}).composite([{input:Buffer.from(svg(...a.logical,r(0,0,...a.logical,6,'white'))),blend:'dest-in'}]).png().toBuffer();
  }
  await emit(key,...a.logical,canvas,`source/seasons/${box.file}`);
 }
}
