import { StrictMode, useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import VideoPlayer from '../src/components/MessageAttachments/VideoPlayer';
import { StreamingAttachment } from '../src/components/MessageAttachments/StreamingAttachment';
import type { MessageAttachment } from '../src/api/interfaces/MessageAttachmentDtos';
function Spike() {
 const [open,setOpen]=useState(false);
 const attach=useCallback((element:HTMLMediaElement|null)=>{if(element) void element.play().catch(()=>{});},[]);
 return <main style={{width:640}}><button onClick={()=>setOpen(v=>!v)}>Toggle</button>{open&&<VideoPlayer src="/artifacts/stages/media-stage5a-evidence/clip.webm" onElement={attach}/>}</main>;
}
const fixture = (window as Window & { __stage5aAttachment?: MessageAttachment }).__stage5aAttachment;
createRoot(document.getElementById('root')!).render(<StrictMode>{fixture
 ? <main style={{width:640}}><StreamingAttachment attachment={fixture}/><textarea aria-label="Fixture composer"/></main>
 : <Spike/>}</StrictMode>);
