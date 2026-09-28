export function mirrorLayout(count, scale, simple) {
  const route = [[750,900],[1000,900],[1000,550],[1550,550],[1550,1150],[2000,1150],[2000,1450],[2300,1450]];
  const transform = ([x,y]) => ({x:1300+(x-1300)*scale,y:900+(y-900)*scale});
  const solution = [0,0,2,2,2,2];
  const items = route.slice(1,count+1).map((point,index)=>({...transform(point),homeX:0,homeY:0,done:false,on:false,index,orientation:simple?(solution[index]===0?2:0):(solution[index]+1+index%2)%4,decoy:false}));
  if (count === 6) for (const [x,y] of [[650,550],[1550,1450],[1000,1150],[2300,900]]) items.push({x,y,homeX:0,homeY:0,done:false,on:false,index:items.length,orientation:1,decoy:true});
  return {items,source:transform(route[0]),receiver:transform(route[count+1]),path:route.slice(0,count+2).map(transform)};
}
export function reflectBeam(dx,dy,orientation) {
  return [[-dy,-dx],[-dx,dy],[dy,dx],[dx,-dy]][orientation];
}
export function traceBeam(mirrors, source, receiver) {
  let from = {...source}, dx = 1, dy = 0;
  const points = [{...source}], lit = new Set(), visited = new Set();
  for (let step=0;step<32;step++) {
    let hit = null, nearest = Infinity;
    for (const item of [...mirrors,{...receiver,index:-1}]) {
      const along=(item.x-from.x)*dx+(item.y-from.y)*dy;
      const across=Math.abs((item.x-from.x)*dy-(item.y-from.y)*dx);
      if (along>.01 && across<.01 && along<nearest) {nearest=along;hit=item;}
    }
    if (!hit) {
      const length=dx>0?2600-from.x:dx<0?from.x:dy>0?1800-from.y:from.y;
      points.push({x:from.x+dx*length,y:from.y+dy*length});
      return {points,lit:[...lit],connected:false};
    }
    points.push({x:hit.x,y:hit.y});
    if(hit.index===-1) return {points,lit:[...lit],connected:true};
    const visit=`${hit.index}:${dx}:${dy}`;
    if(visited.has(visit)) return {points,lit:[...lit],connected:false};
    visited.add(visit);lit.add(hit.index);
    [dx,dy]=reflectBeam(dx,dy,hit.orientation);from={x:hit.x,y:hit.y};
  }
  return {points,lit:[...lit],connected:false};
}
