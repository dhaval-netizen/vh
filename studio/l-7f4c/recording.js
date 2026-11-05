export function recordingSupported(){return !!(navigator.mediaDevices?.getDisplayMedia&&navigator.mediaDevices?.getUserMedia&&navigator.mediaDevices?.setCaptureHandleConfig&&window.MediaRecorder);}
export async function captureReviewStreams(shouldContinue=()=>true){
 if(!recordingSupported())throw new Error('Please use a current desktop Chrome or Edge browser. This review requires support for recording this exact tab.');
 const handle='vh-review-'+crypto.randomUUID();navigator.mediaDevices.setCaptureHandleConfig({exposeOrigin:true,handle,permittedOrigins:[location.origin]});
 let screen,camera,cancelled=document.visibilityState!=='visible';const cancel=()=>{if(document.visibilityState!=='visible')cancelled=true;};const leaving=()=>{cancelled=true;};document.addEventListener('visibilitychange',cancel);window.addEventListener('pagehide',leaving);const valid=()=>{if(cancelled||!shouldContinue()||document.visibilityState!=='visible')throw new Error('Recording was cancelled because the review is no longer active.');};
 try{valid();
  screen=await navigator.mediaDevices.getDisplayMedia({video:{displaySurface:'browser',frameRate:{ideal:5,max:10}},audio:false,preferCurrentTab:true,selfBrowserSurface:'include',surfaceSwitching:'exclude',monitorTypeSurfaces:'exclude'});
  valid();const track=screen.getVideoTracks()[0];const captured=track?.getCaptureHandle?.();
  if(track?.getSettings().displaySurface!=='browser'||captured?.handle!==handle||captured?.origin!==location.origin)throw new Error('Share this review tab only. Other tabs, windows, and your entire screen are not accepted.');
  camera=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640,max:1280},height:{ideal:480,max:720},frameRate:{ideal:10,max:15}},audio:false});
  valid();if(camera.getAudioTracks().length||screen.getAudioTracks().length)throw new Error('Audio capture is not permitted.');
  return {screen,camera,handle};
 }catch(error){for(const stream of [screen,camera])stream?.getTracks().forEach(t=>t.stop());throw error;}finally{document.removeEventListener('visibilitychange',cancel);window.removeEventListener('pagehide',leaving);}
}
export class RecordingSession{
 constructor({streams,createVisit,upload,endVisit,onReady,onStop}){Object.assign(this,{streams,createVisit,upload,endVisit,onReady,onStop});this.recorders=[];this.queues={screen:Promise.resolve(),camera:Promise.resolve()};this.sequence={screen:0,camera:0};this.ack={screen:0,camera:0};this.active=false;this.starting=false;this.stopped=false;this.visit=null;this.ready=false;this.listeners=[];}
 listen(target,type,fn){target.addEventListener(type,fn);this.listeners.push(()=>target.removeEventListener(type,fn));}
 async start(){
  try{this.starting=true;this.listen(document,'visibilitychange',()=>{if(document.visibilityState!=='visible')this.stop('The review was closed when the tab was hidden.');});this.listen(window,'pagehide',()=>this.stop('The page was closed.'));if(document.visibilityState!=='visible')throw new Error('Keep this review tab visible to begin.');this.visit=await this.createVisit();if(this.stopped||document.visibilityState!=='visible'){if(!this.stopped)this.stop('The review tab is no longer visible.');await this.endVisit(this.visit.id);return;}this.startedAt=performance.now();
   const mime=['video/webm;codecs=vp8','video/webm'].find(m=>MediaRecorder.isTypeSupported(m));if(!mime)throw new Error('WebM recording is not supported in this browser.');
   for(const kind of ['screen','camera']){const stream=this.streams[kind];if(!stream?.getVideoTracks().length||stream.getVideoTracks().some(t=>t.readyState!=='live'||t.muted))throw new Error('Both video feeds must be active.');
    const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:kind==='screen'?350000:300000});
    recorder.addEventListener('dataavailable',e=>{if(!e.data.size||this.stopped&&!this.finishing)return;const seq=this.sequence[kind]++;this.queues[kind]=this.queues[kind].then(async()=>{if(e.data.size>4*1024*1024)throw new Error('A recording segment exceeded the upload limit.');await this.upload(this.visit.id,kind,seq,e.data);this.ack[kind]=performance.now();if(!this.ready&&!this.stopped&&this.ack.screen&&this.ack.camera){this.ready=true;this.active=true;Promise.resolve().then(()=>{if(!this.stopped)return this.onReady(this.visit.id);}).catch(error=>this.stop(error.message));}}).catch(error=>this.stop(error.message));});
    recorder.addEventListener('error',()=>this.stop('Recording failed. The design has been hidden.'));
    for(const track of stream.getVideoTracks()){this.listen(track,'ended',()=>this.stop('A recording feed stopped. The design has been hidden.'));this.listen(track,'mute',()=>this.stop('A recording feed was interrupted. The design has been hidden.'));}
    if(kind==='screen'&&this.streams.handle)this.listen(stream.getVideoTracks()[0],'capturehandlechange',()=>{const h=stream.getVideoTracks()[0].getCaptureHandle?.();if(h?.handle!==this.streams.handle||h?.origin!==location.origin)this.stop('The shared tab changed. The design has been hidden.');});
    recorder.start(4000);this.recorders.push(recorder);
   }
   this.timer=setInterval(()=>{const now=performance.now();if(now-this.startedAt>3600000)this.stop('This one-hour review session has ended. You can start a new session.');else if(now-(this.ack.screen||this.startedAt)>14000||now-(this.ack.camera||this.startedAt)>14000)this.stop('Recording uploads were interrupted. The design has been hidden.');},500);
   this.starting=false;
  }catch(error){this.stop(error.message);throw error;}
 }
 stop(reason='Recording stopped. The design is hidden.'){
  if(this.stopped)return;this.stopped=true;this.active=false;this.finishing=true;clearInterval(this.timer);for(const remove of this.listeners)remove();
  this.onStop(reason);
  const stops=this.recorders.map(r=>new Promise(resolve=>{if(r.state==='inactive'){resolve();return;}r.addEventListener('stop',resolve,{once:true});r.stop();}));
  for(const stream of [this.streams.screen,this.streams.camera])stream?.getTracks().forEach(t=>t.stop());
  Promise.all(stops).then(()=>Promise.allSettled(Object.values(this.queues))).then(()=>{this.finishing=false;if(this.visit)return this.endVisit(this.visit.id);}).catch(()=>{});
 }
}
