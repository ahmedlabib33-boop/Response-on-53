(()=>{
  'use strict';

  const PROTOCOL='response53-cobrowse-v1';
  const params=new URLSearchParams(location.search);
  const invitedRoom=(params.get('conference')||'').replace(/[^A-Za-z0-9_-]/g,'').slice(0,80);
  const invitedRole=params.get('role')==='guest'?'guest':'host';
  const state={
    api:null,room:invitedRoom,role:invitedRole,localId:'',controllerId:'',connected:false,
    applyingRemote:false,follow:true,pending:null,expanded:false,lastSent:0,drag:null
  };

  const ar=()=>document.body.classList.contains('arabic-mode');
  const t=(en,ara)=>ar()?ara:en;
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};

  const launcher=el('button','conference-launcher');
  launcher.type='button';launcher.setAttribute('aria-haspopup','dialog');
  const dock=el('section','conference-dock');dock.setAttribute('role','dialog');dock.setAttribute('aria-modal','false');
  dock.innerHTML=`
    <header class="conference-head">
      <div class="conference-head-copy"><strong class="conference-title"></strong><small class="conference-state"></small></div>
      <button class="conference-icon-btn conference-expand" type="button" aria-label="Expand conference">↗</button>
      <button class="conference-icon-btn conference-minimize" type="button" aria-label="Minimize conference">—</button>
      <button class="conference-icon-btn conference-close" type="button" aria-label="Close conference">×</button>
    </header>
    <div class="conference-setup">
      <h3></h3><p class="conference-intro"></p>
      <div class="conference-field"><label for="conferenceName"></label><input id="conferenceName" maxlength="45" autocomplete="name"></div>
      <div class="conference-field"><label for="conferenceRoom"></label><input id="conferenceRoom" maxlength="80" spellcheck="false"></div>
      <button class="conference-primary" type="button"></button>
      <div class="conference-disclosure"></div>
    </div>
    <div class="conference-live">
      <div class="conference-request"><span></span><button class="accept" type="button"></button><button class="reject" type="button"></button></div>
      <div class="conference-toolbar">
        <button class="conference-action conference-invite" type="button"></button>
        <button class="conference-action conference-follow active" type="button"></button>
        <button class="conference-action conference-control" type="button"></button>
      </div>
      <div class="conference-frame"></div>
      <div class="conference-tip"></div>
    </div>
    <div class="conference-toast" role="status" aria-live="polite"></div>`;
  document.body.append(launcher,dock);

  const q=s=>dock.querySelector(s);
  const ui={
    title:q('.conference-title'),status:q('.conference-state'),setup:q('.conference-setup'),setupTitle:q('.conference-setup h3'),intro:q('.conference-intro'),
    name:q('#conferenceName'),room:q('#conferenceRoom'),nameLabel:q('label[for="conferenceName"]'),roomLabel:q('label[for="conferenceRoom"]'),start:q('.conference-primary'),
    disclosure:q('.conference-disclosure'),expand:q('.conference-expand'),minimize:q('.conference-minimize'),close:q('.conference-close'),frame:q('.conference-frame'),
    invite:q('.conference-invite'),follow:q('.conference-follow'),control:q('.conference-control'),tip:q('.conference-tip'),
    request:q('.conference-request'),requestText:q('.conference-request span'),accept:q('.conference-request .accept'),reject:q('.conference-request .reject'),toast:q('.conference-toast')
  };

  ui.name.value=invitedRole==='guest'?'Eng. OLA':'Eng. Ahmed Labib';
  ui.room.value=state.room;

  function refreshText(){
    dock.dir=ar()?'rtl':'ltr';
    launcher.textContent=t('Voice conference','مكالمة صوتية');
    dock.setAttribute('aria-label',t('Voice conference and presentation control','المكالمة الصوتية والتحكم في العرض'));
    ui.title.textContent=t('Live voice conference','مكالمة صوتية مباشرة');
    ui.status.textContent=state.connected?t('Voice connected · app sync ready','الصوت متصل · مزامنة العرض جاهزة'):t('Talk and co-browse','تحدث وتصفح بشكل مشترك');
    ui.setupTitle.textContent=state.room?t('Join the presentation','الانضمام إلى العرض'):t('Start a presentation call','بدء مكالمة عرض');
    ui.intro.textContent=t('Keep this dock open while moving through any tab. Participants can follow the same section and request presentation control.','اترك هذه النافذة مفتوحة أثناء التنقل بين أي تبويب. يمكن للمشاركين متابعة القسم نفسه وطلب التحكم في العرض.');
    ui.nameLabel.textContent=t('Your display name','اسمك الظاهر');
    ui.roomLabel.textContent=t('Secure room name','اسم غرفة الاجتماع');
    ui.start.textContent=state.room?t('Join conference','انضم إلى المكالمة'):t('Start conference','ابدأ المكالمة');
    ui.disclosure.textContent=t('This is a voice-only call. App navigation, open source panels, language and scroll position are synchronized. Search text and form entries are never transmitted.','هذه مكالمة صوتية فقط. تتم مزامنة التنقل داخل التطبيق وصفحات المصدر المفتوحة واللغة وموضع التمرير. لا تُنقل نصوص البحث أو بيانات النماذج مطلقًا.');
    ui.expand.setAttribute('aria-label',t('Expand conference','تكبير نافذة المكالمة'));
    ui.minimize.setAttribute('aria-label',t('Minimize conference','تصغير نافذة المكالمة'));
    ui.close.setAttribute('aria-label',t('Leave conference','مغادرة المكالمة'));
    ui.invite.textContent=t('Copy invitation','نسخ رابط الدعوة');
    ui.follow.textContent=state.follow?t('Following presenter','متابعة مقدم العرض'):t('Follow paused','المتابعة متوقفة');
    const owns=state.connected&&state.controllerId&&state.controllerId===state.localId;
    ui.control.textContent=state.role==='host'&&state.controllerId&&state.controllerId!==state.localId?t('Revoke control','استعادة التحكم'):owns?t('You control','أنت المتحكم'):t('Request control','طلب التحكم');
    ui.control.classList.toggle('warn',state.role==='host'&&state.controllerId&&state.controllerId!==state.localId);
    ui.control.disabled=owns&&state.role!=='host';
    ui.tip.textContent=t('Voice only · navigation sync keeps everyone on the same app tab and reading position.','صوت فقط · تحافظ مزامنة التنقل على تبويب التطبيق وموضع القراءة نفسه لدى الجميع.');
    ui.accept.textContent=t('Grant','منح التحكم');ui.reject.textContent=t('Decline','رفض');
  }

  function toast(message){ui.toast.textContent=message;ui.toast.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>ui.toast.classList.remove('show'),4200);}
  function randomRoom(){return 'Response53-'+Date.now().toString(36)+'-'+crypto.getRandomValues(new Uint32Array(1))[0].toString(36);}
  function openDock(){dock.classList.add('open');dock.classList.remove('minimized');launcher.hidden=true;refreshText();}
  function minimize(){dock.classList.add('minimized');launcher.hidden=false;}

  launcher.addEventListener('click',openDock);
  ui.minimize.addEventListener('click',minimize);
  ui.expand.addEventListener('click',()=>{state.expanded=!state.expanded;dock.classList.toggle('expanded',state.expanded);ui.expand.textContent=state.expanded?'↙':'↗';});
  ui.close.addEventListener('click',()=>{
    if(state.api){try{state.api.executeCommand('hangup');state.api.dispose();}catch(_){ }state.api=null;}
    state.connected=false;state.localId='';state.controllerId='';dock.classList.remove('connected','open','expanded');launcher.hidden=false;launcher.classList.remove('is-live');refreshText();
  });

  function loadJitsi(){
    if(window.JitsiMeetExternalAPI)return Promise.resolve();
    if(loadJitsi.promise)return loadJitsi.promise;
    loadJitsi.promise=new Promise((resolve,reject)=>{
      const s=document.createElement('script');s.src='https://meet.jit.si/external_api.js';s.async=true;s.onload=resolve;s.onerror=()=>reject(new Error('Jitsi API failed to load'));document.head.appendChild(s);
    });
    return loadJitsi.promise;
  }

  async function join(){
    if(state.api)return;
    const name=(ui.name.value||'Guest').trim().slice(0,45);
    state.room=(ui.room.value||randomRoom()).replace(/[^A-Za-z0-9_-]/g,'').slice(0,80);
    ui.room.value=state.room;
    if(!invitedRoom){
      state.role='host';
      const p=new URLSearchParams(location.search);p.set('conference',state.room);p.set('role','host');history.replaceState(null,'',location.pathname+'?'+p.toString()+location.hash);
    }
    ui.start.disabled=true;ui.start.textContent=t('Connecting…','جارٍ الاتصال…');
    try{
      await loadJitsi();
      // Expose the meeting surface before Jitsi reports the joined event so the
      // user can reach the microphone control during connection.
      dock.classList.add('connected');
      state.api=new window.JitsiMeetExternalAPI('meet.jit.si',{
        roomName:state.room,parentNode:ui.frame,width:'100%',height:'100%',lang:ar()?'ar':'en',userInfo:{displayName:name},
        configOverwrite:{prejoinPageEnabled:false,startWithAudioMuted:false,startWithVideoMuted:true,disableVideo:true,disableDeepLinking:true,enableWelcomePage:false,toolbarButtons:['microphone','chat','participants-pane','raisehand','settings','hangup']},
        interfaceConfigOverwrite:{MOBILE_APP_PROMO:false,SHOW_JITSI_WATERMARK:false,TILE_VIEW_MAX_COLUMNS:2}
      });
      wireApi();
    }catch(err){
      state.api=null;dock.classList.remove('connected');ui.start.disabled=false;refreshText();toast(t('Unable to open the conference service. Check the connection and try again.','تعذر فتح خدمة المكالمة. تحقق من الاتصال وحاول مرة أخرى.'));
    }
  }

  function wireApi(){
    const api=state.api;
    api.addEventListener('videoConferenceJoined',e=>{
      state.connected=true;state.localId=e.id||'';if(state.role==='host')state.controllerId=state.localId;
      dock.classList.add('connected');launcher.classList.add('is-live');ui.start.disabled=false;refreshText();
      send({type:'hello',role:state.role,name:e.displayName||ui.name.value,controllerId:state.controllerId});
      setTimeout(sendState,800);
    });
    api.addEventListener('participantJoined',()=>{if(state.role==='host')setTimeout(sendState,900);});
    api.addEventListener('endpointTextMessageReceived',receive);
    api.addEventListener('readyToClose',()=>ui.close.click());
    api.addEventListener('errorOccurred',e=>{if(e?.isFatal)toast(t('The conference connection ended unexpectedly.','انقطع اتصال المكالمة بصورة غير متوقعة.'));});
  }

  function send(payload,target){
    if(!state.api||!state.connected)return;
    const text=JSON.stringify({protocol:PROTOCOL,ts:Date.now(),...payload});
    try{
      if(target){state.api.executeCommand('sendEndpointTextMessage',target,text);return;}
      const peers=(state.api.getParticipantsInfo?.()||[]).filter(p=>p.participantId&&p.participantId!==state.localId);
      peers.forEach(p=>state.api.executeCommand('sendEndpointTextMessage',p.participantId,text));
    }catch(_){ }
  }

  function receive(evt){
    const sender=evt?.senderInfo?.id||'';let msg;
    try{msg=JSON.parse(evt?.eventData?.text||'');}catch(_){return;}
    if(msg.protocol!==PROTOCOL)return;
    if(msg.type==='hello'){
      if(msg.role==='host'&&msg.controllerId&&!state.controllerId)state.controllerId=msg.controllerId;
      if(state.role==='host')sendState(sender);refreshText();return;
    }
    if(msg.type==='control-request'&&state.role==='host'){
      state.pending={id:sender,name:msg.name||t('Participant','مشارك')};
      ui.requestText.textContent=t(`${state.pending.name} is asking to control the presentation.`,`يطلب ${state.pending.name} التحكم في العرض.`);ui.request.classList.add('show');return;
    }
    if(msg.type==='control-granted'){
      state.controllerId=msg.participantId;state.follow=true;refreshText();
      if(state.localId===msg.participantId)toast(t('You now control the presentation.','أصبح التحكم في العرض لديك الآن.'));return;
    }
    if(msg.type==='control-denied'&&sender){toast(t('The control request was declined.','تم رفض طلب التحكم.'));return;}
    if(msg.type==='state'){
      if(state.controllerId&&sender!==state.controllerId)return;
      if(!state.controllerId)state.controllerId=sender;
      if(state.follow)applyState(msg.view);refreshText();
    }
  }

  function activeView(){
    const tabs=[...document.querySelectorAll('#tabbar .tb')];
    const section=tabs.findIndex(x=>x.getAttribute('aria-selected')==='true');
    const sec=document.querySelectorAll('#host > .sec')[Math.max(0,section)];
    const subs=sec?[...sec.querySelectorAll(':scope > .subbar .sb')]:[];
    const sub=Math.max(0,subs.findIndex(x=>x.getAttribute('aria-selected')==='true'));
    const pane=sec?.querySelector('.pane:not([hidden])');
    const details=pane?[...pane.querySelectorAll('details')].map((d,i)=>d.open?i:-1).filter(i=>i>=0):[];
    const max=Math.max(1,document.documentElement.scrollHeight-innerHeight);
    return{section:Math.max(0,section),sub,arabic:ar(),scroll:Math.max(0,Math.min(1,scrollY/max)),details};
  }
  function sendState(target){
    if(state.applyingRemote||!state.connected||state.controllerId!==state.localId)return;
    send({type:'state',view:activeView()},target);
  }
  function applyState(view){
    if(!view||!Number.isInteger(view.section))return;
    state.applyingRemote=true;
    try{
      if(ar()!==!!view.arabic)document.getElementById('langToggleTop')?.click();
      if(typeof window.pick==='function')window.pick(view.section);else document.querySelectorAll('#tabbar .tb')[view.section]?.click();
      const sec=document.querySelectorAll('#host > .sec')[view.section];
      sec?.querySelectorAll(':scope > .subbar .sb')[view.sub||0]?.click();
      const pane=sec?.querySelector('.pane:not([hidden])');
      if(pane&&Array.isArray(view.details))[...pane.querySelectorAll('details')].forEach((d,i)=>{d.open=view.details.includes(i);});
      setTimeout(()=>{const max=Math.max(0,document.documentElement.scrollHeight-innerHeight);scrollTo({top:max*Math.max(0,Math.min(1,Number(view.scroll)||0)),behavior:'smooth'});setTimeout(()=>{state.applyingRemote=false;},450);},180);
    }catch(_){state.applyingRemote=false;}
  }

  ui.start.addEventListener('click',join);
  ui.invite.addEventListener('click',async()=>{
    const p=new URLSearchParams(location.search);p.set('conference',state.room);p.set('role','guest');
    const url=location.origin+location.pathname+'?'+p.toString()+location.hash;
    try{await navigator.clipboard.writeText(url);toast(t('Invitation link copied. Send it to Eng. OLA.','تم نسخ رابط الدعوة. أرسله إلى م. علا.'));}
    catch(_){prompt(t('Copy this invitation link:','انسخ رابط الدعوة:'),url);}
  });
  ui.follow.addEventListener('click',()=>{state.follow=!state.follow;ui.follow.classList.toggle('active',state.follow);refreshText();if(state.follow)send({type:'hello',role:state.role,name:ui.name.value,controllerId:state.controllerId});});
  ui.control.addEventListener('click',()=>{
    if(state.role==='host'&&state.controllerId!==state.localId){state.controllerId=state.localId;send({type:'control-granted',participantId:state.localId});sendState();toast(t('Presentation control returned to you.','تمت استعادة التحكم في العرض.'));refreshText();return;}
    send({type:'control-request',name:ui.name.value});toast(t('Control request sent to the host.','تم إرسال طلب التحكم إلى مقدم العرض.'));
  });
  ui.accept.addEventListener('click',()=>{if(!state.pending)return;state.controllerId=state.pending.id;send({type:'control-granted',participantId:state.pending.id});ui.request.classList.remove('show');state.pending=null;refreshText();});
  ui.reject.addEventListener('click',()=>{if(state.pending)send({type:'control-denied'},state.pending.id);ui.request.classList.remove('show');state.pending=null;});

  document.addEventListener('click',e=>{
    if(!state.connected||state.applyingRemote||state.controllerId!==state.localId)return;
    if(e.target.closest('#tabbar,.subbar,details,.smart-table-shell'))setTimeout(()=>sendState(),240);
  },true);
  window.addEventListener('scroll',()=>{
    if(!state.connected||state.applyingRemote||state.controllerId!==state.localId)return;
    const now=Date.now();if(now-state.lastSent<240)return;state.lastSent=now;sendState();
  },{passive:true});
  window.addEventListener('site-language',()=>{refreshText();if(state.connected&&state.controllerId===state.localId)setTimeout(sendState,120);});

  const head=q('.conference-head');
  head.addEventListener('pointerdown',e=>{
    if(innerWidth<=700||e.target.closest('button')||state.expanded)return;
    const r=dock.getBoundingClientRect();state.drag={x:e.clientX-r.left,y:e.clientY-r.top};head.setPointerCapture(e.pointerId);
  });
  head.addEventListener('pointermove',e=>{
    if(!state.drag)return;const left=Math.max(8,Math.min(innerWidth-dock.offsetWidth-8,e.clientX-state.drag.x));const top=Math.max(8,Math.min(innerHeight-dock.offsetHeight-8,e.clientY-state.drag.y));
    dock.style.left=left+'px';dock.style.top=top+'px';dock.style.right='auto';dock.style.bottom='auto';
  });
  head.addEventListener('pointerup',()=>{state.drag=null;});

  refreshText();
  if(invitedRoom)openDock();
})();
