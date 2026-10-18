import { performance } from 'node:perf_hooks';
// Synthetic reproduction of DmItemsList observer registration; no DOM/React timing claims.
for (const n of [1000,5000,10000]) {
 const messages=Array.from({length:n},(_,i)=>({id:i+1,senderId:2}));
 let comparisons=0; let start=performance.now();
 for(const m of messages) messages.find(x=>{comparisons++;return x.id===m.id;});
 const beforeMs=performance.now()-start;
 start=performance.now(); const index=new Map(messages.map(m=>[m.id,m]));
 for(const m of messages) index.get(m.id);
 console.log(JSON.stringify({n,beforeComparisons:comparisons,afterVisits:n*2,beforeMs,afterMs:performance.now()-start}));
}
