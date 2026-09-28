import {createGame,startGame,updateGame,WORLD,segmentDistance} from '../../src/galaxy.mjs';
import {STEP,controlMask,recordFrame} from '../../src/difficulty.mjs';

export function play(game,difficulty,delay=0) {
  const state=createGame(game,difficulty),replay=[];
  startGame(state);
  const tick=(keys=[])=>{recordFrame(replay,controlMask(new Set(keys)));updateGame(state,new Set(keys),STEP);};
  for(let i=0;i<delay;i++)tick();
  const fly=(target,radius=12)=>{
    for(let i=0;i<6000&&state.phase==='running';i++){
      const dx=target.x-state.ship.x,dy=target.y-state.ship.y;
      if(Math.hypot(dx,dy)<radius)return;
      const keys=[];if(Math.abs(dx)>5)keys.push(dx>0?'d':'a');if(Math.abs(dy)>5)keys.push(dy>0?'s':'w');
      if(Math.hypot(dx,dy)>60)keys.push('shift');tick(keys);
    }
  };
  const kind=state.config.kind;
  if(kind==='collect'||kind==='race')for(const item of state.items)fly(item);
  if(kind==='rescue')for(const item of state.items){fly(item);fly({x:1300,y:900});}
  if(kind==='mirror')for(const item of state.items.filter(item=>!item.decoy)){
    fly(item,50);
    for(let i=0;i<4&&item.orientation!==(item.index<2?0:2)&&state.phase==='running';i++){tick(['e']);if(state.phase==='running')tick();}
  }
  if(kind==='survive'){
    while(state.phase==='running'&&state.elapsed<60){
      let best=[],value=-Infinity;
      for(const [dx,dy,keys] of [[1,0,['d']],[-1,0,['a']],[0,1,['s']],[0,-1,['w']],[1,1,['d','s']],[1,-1,['d','w']],[-1,1,['a','s']],[-1,-1,['a','w']]]){
        const n=Math.hypot(dx,dy),point={x:state.ship.x+dx/n*150,y:state.ship.y+dy/n*150};
        if(point.x<40||point.y<40||point.x>WORLD.width-40||point.y>WORLD.height-40)continue;
        let score=Infinity,endpoint=Infinity;
        for(const rock of state.hazards){const future={x:rock.x+rock.vx*.13,y:rock.y+rock.vy*.13};score=Math.min(score,segmentDistance(future,state.ship,point)-rock.r);endpoint=Math.min(endpoint,Math.hypot(point.x-future.x,point.y-future.y)-rock.r);}
        score+=endpoint*.15;
        if(score>value){value=score;best=[...keys,'shift'];}
      }
      tick(best);
    }
  }
  if(kind==='shoot')for(const target of state.items){
    for(let i=0;i<9000&&!target.done&&state.phase==='running';i++){
      const dx=target.x-state.ship.x,dy=target.y+20-state.ship.y;
      const keys=[' '];if(Math.abs(dx)>10)keys.push(dx>0?'d':'a');if(Math.abs(dy)>10)keys.push(dy>0?'s':'w');
      if(Math.hypot(dx,dy)>150)keys.push('shift');
      if(keys.length===1)keys.push('w');tick(keys);
    }
  }
  return {state,replay};
}
