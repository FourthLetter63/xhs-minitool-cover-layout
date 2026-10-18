(function(){
'use strict';

var W=900,H=1200,EXPORT_W=1800,EXPORT_H=2400;
var canvas=document.getElementById('preview');
var ctx=canvas.getContext('2d');
var note=document.getElementById('note');
var exportPreview=document.getElementById('exportPreview');
var adjustBar=document.getElementById('adjustBar');
var adjustLabel=document.getElementById('adjustLabel');
var finishAdjustBtn=document.getElementById('finishAdjust');
var slotsPanel=document.getElementById('slotsPanel');
var overlayPanel=document.getElementById('overlayPanel');
var layoutCounts=document.getElementById('layoutCounts');
var layoutChoices=document.getElementById('layoutChoices');
var ratioInput=document.getElementById('ratio');
var ratioControl=document.getElementById('ratioControl');
var gridAdjust=document.getElementById('gridAdjust');
var rowAdjust=document.getElementById('rowAdjust');
var colAdjust=document.getElementById('colAdjust');
var resetGrid=document.getElementById('resetGrid');
var marginInput=document.getElementById('margin');
var gapInput=document.getElementById('gap');
var radiusInput=document.getElementById('radius');
var bgInput=document.getElementById('bg');
var bgHex=document.getElementById('bgHex');
var bgSwatch=document.getElementById('bgSwatch');
var batchFiles=document.getElementById('batchFiles');
var swapA=document.getElementById('swapA');
var swapB=document.getElementById('swapB');
var overlayArrange=document.getElementById('overlayArrange');
var overlayArrangeCount=document.getElementById('overlayArrangeCount');
var overlaySpacing=document.getElementById('overlaySpacing');
var overlaySpacingOut=document.getElementById('overlaySpacingOut');
var overlayAlignLeft=document.getElementById('overlayAlignLeft');
var overlayAlignCenter=document.getElementById('overlayAlignCenter');
var overlayAlignRight=document.getElementById('overlayAlignRight');
var overlayStack=document.getElementById('overlayStack');

var LAYOUTS={
  '1single':{count:1,name:'单图'},
  '2v':{count:2,name:'上下'},
  '2h':{count:2,name:'左右'},
  '3top':{count:3,name:'上 1 + 下 2'},
  '3bottom':{count:3,name:'上 2 + 下 1'},
  '3left':{count:3,name:'左 1 + 右 2'},
  '3right':{count:3,name:'左 2 + 右 1'},
  '3rows':{count:3,name:'三行',rows:3,cols:1},
  '4grid':{count:4,name:'2 × 2',rows:2,cols:2},
  '4top':{count:4,name:'上 1 + 下 3'},
  '4bottom':{count:4,name:'上 3 + 下 1'},
  '5top':{count:5,name:'上 1 + 下 2 × 2'},
  '5bottom':{count:5,name:'上 2 × 2 + 下 1'},
  '5mix':{count:5,name:'上 2 + 下 3'},
  '5mixrev':{count:5,name:'上 3 + 下 2'},
  '6grid':{count:6,name:'2 × 3',rows:3,cols:2},
  '9grid':{count:9,name:'3 × 3',rows:3,cols:3}
};
var LAYOUT_ORDER=['1single','2v','2h','3top','3bottom','3left','3right','3rows','4grid','4top','4bottom','5top','5bottom','5mix','5mixrev','6grid','9grid'];
var COUNTS=[1,2,3,4,5,6,9];
var state={layout:'2v',ratio:0.5,margin:5,gap:5,radius:5,bg:'#000000'};
var layoutTuning={};
var slots=[];
var overlays=[];
var activeAdjust=null;
var pointers={};
var gesture=null;
var guideX=false,guideY=false;

function makeSlot(){return {mode:'image',img:null,url:null,zoom:1,dx:0,dy:0,text:'',font:'auto',weight:400,size:54,lineHeight:64,color:'#E8DFA6',textDx:0,textDy:0};}
for(var si=0;si<9;si++)slots.push(makeSlot());

function setNote(t){note.textContent=t||'';}
function activeCount(){return LAYOUTS[state.layout].count;}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function isHex(v){return /^#[0-9a-fA-F]{6}$/.test(v);}
function fontStack(choice){
  if(choice==='lxgw')return '"XHSLXGW",serif';
  if(choice==='cormorant')return '"XHSCormorant","XHSLXGW",serif';
  return '"XHSCormorant","XHSLXGW",serif';
}
function fontOptions(selected){
  var opts=[['auto','默认（Cormorant / LXGW Bright）'],['lxgw','LXGW Bright'],['cormorant','Cormorant']];
  var s='';
  for(var i=0;i<opts.length;i++)s+='<option value="'+opts[i][0]+'"'+(opts[i][0]===selected?' selected':'')+'>'+opts[i][1]+'</option>';
  return s;
}
function colorPairHtml(id,value,label){
  return '<div class="color-pair"><span class="color-swatch" id="'+id+'Swatch"><input id="'+id+'" type="color" value="'+value+'" aria-label="'+label+'"></span><input id="'+id+'Hex" class="hex-input" type="text" value="'+value+'" maxlength="7" spellcheck="false" aria-label="'+label+'色号"></div>';
}
function bindColor(colorEl,hexEl,swatchEl,onChange){
  function apply(v){if(!isHex(v))return;v=v.toUpperCase();colorEl.value=v;hexEl.value=v;swatchEl.style.background=v;onChange(v);}
  swatchEl.style.background=colorEl.value;
  colorEl.addEventListener('input',function(){apply(colorEl.value);});
  hexEl.addEventListener('input',function(){
    if(isHex(hexEl.value)){hexEl.classList.remove('invalid');apply(hexEl.value);}else{hexEl.classList.add('invalid');}
  });
  hexEl.addEventListener('blur',function(){if(!isHex(hexEl.value)){hexEl.classList.remove('invalid');hexEl.value=colorEl.value.toUpperCase();}});
}

function equalBands(count){var a=[],v=count?100/count:0;for(var i=0;i<count;i++)a.push(v);return a;}
function ensureTuning(key,rows,cols){rows=rows||0;cols=cols||0;if(!layoutTuning[key])layoutTuning[key]={rows:equalBands(rows),cols:equalBands(cols)};var t=layoutTuning[key];if(t.rows.length!==rows)t.rows=equalBands(rows);if(t.cols.length!==cols)t.cols=equalBands(cols);return t;}
function rebalanceBand(arr,index,wanted){var min=5;wanted=Math.max(min,Math.min(100-min*(arr.length-1),Number(wanted)||min));var old=arr[index],delta=wanted-old;if(Math.abs(delta)<1e-9)return;arr[index]=wanted;var others=[];for(var i=0;i<arr.length;i++)if(i!==index)others.push(i);others.sort(function(a,b){return b-a;});var remaining=delta,j,can,take;if(remaining>0){for(i=0;i<others.length;i++){j=others[i];can=Math.max(0,arr[j]-min);take=Math.min(can,remaining);arr[j]-=take;remaining-=take;if(remaining<=1e-9)break;}}else if(others.length){j=others[0];arr[j]+=-remaining;remaining=0;}if(remaining>1e-9)arr[index]-=remaining;var sum=0;for(i=0;i<arr.length;i++)sum+=arr[i];if(Math.abs(sum-100)>1e-6&&others.length)arr[others[0]]+=100-sum;}
function weightedBands(total,gap,weights){var usable=Math.max(1,total-gap*Math.max(0,weights.length-1)),sum=0,pos=0,out=[];for(var i=0;i<weights.length;i++)sum+=weights[i];sum=Math.max(1,sum);for(i=0;i<weights.length;i++){var size=usable*weights[i]/sum,start=pos;out.push({start:start,size:size});pos+=size+(i<weights.length-1?gap:0);}return out;}
function updateGridOutputs(){var t=layoutTuning[state.layout];if(!t)return;var kinds=['rows','cols'];for(var k=0;k<kinds.length;k++){var kind=kinds[k],arr=t[kind]||[];for(var i=0;i<arr.length;i++){var pct=Math.round(arr[i]),o=document.getElementById(kind+i+'Out'),range=document.getElementById(kind+i),num=document.getElementById(kind+i+'Num');if(o)o.textContent=pct+'%';if(range)range.value=pct;if(num)num.value=pct;}}}
function renderGridAdjust(){var info=LAYOUTS[state.layout],rows=info.rows||0,cols=info.cols||0,isGrid=!!(rows||cols);ratioControl.classList.toggle('hidden',isGrid);if(!isGrid){gridAdjust.classList.add('hidden');rowAdjust.innerHTML='';colAdjust.innerHTML='';return;}gridAdjust.classList.remove('hidden');var t=ensureTuning(state.layout,rows,cols);function make(kind,count,target,label){if(count<=1){target.innerHTML='';return;}var html='<div class="grid-note">'+label+'合计 100%；调整一项时自动平衡其他'+(kind==='rows'?'行':'列')+'。</div>';for(var i=0;i<count;i++){html+='<div class="control"><label>'+(kind==='rows'?'第 '+(i+1)+' 行':'第 '+(i+1)+' 列')+' <output id="'+kind+i+'Out"></output></label><div class="band-editor"><input id="'+kind+i+'" type="range" min="5" max="90" step="1" value="'+Math.round(t[kind][i])+'"><input id="'+kind+i+'Num" type="number" min="5" max="90" step="1" value="'+Math.round(t[kind][i])+'"></div></div>';}target.innerHTML=html;for(i=0;i<count;i++){(function(idx){var input=document.getElementById(kind+idx),num=document.getElementById(kind+idx+'Num');function apply(v){rebalanceBand(t[kind],idx,v);updateGridOutputs();redraw();}input.addEventListener('input',function(){apply(input.value);});num.addEventListener('change',function(){apply(num.value);});num.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();apply(num.value);}});})(i);}}make('rows',rows,rowAdjust,'行高');make('cols',cols,colAdjust,'列宽');updateGridOutputs();}

function layoutNorm(key,ratio){
  var r=ratio||0.5;
  if(key==='1single')return [[0,0,1,1]];
  if(key==='2v')return [[0,0,1,r],[0,r,1,1]];
  if(key==='2h')return [[0,0,r,1],[r,0,1,1]];
  if(key==='3top')return [[0,0,1,r],[0,r,.5,1],[.5,r,1,1]];
  if(key==='3bottom')return [[0,0,.5,1-r],[.5,0,1,1-r],[0,1-r,1,1]];
  if(key==='3left')return [[0,0,r,1],[r,0,1,.5],[r,.5,1,1]];
  if(key==='3right')return [[0,0,1-r,.5],[0,.5,1-r,1],[1-r,0,1,1]];
  if(key==='3rows')return [[0,0,1,1/3],[0,1/3,1,2/3],[0,2/3,1,1]];
  if(key==='4grid')return [[0,0,.5,.5],[.5,0,1,.5],[0,.5,.5,1],[.5,.5,1,1]];
  if(key==='4top')return [[0,0,1,r],[0,r,1/3,1],[1/3,r,2/3,1],[2/3,r,1,1]];
  if(key==='4bottom')return [[0,0,1/3,1-r],[1/3,0,2/3,1-r],[2/3,0,1,1-r],[0,1-r,1,1]];
  if(key==='5top')return [[0,0,1,r],[0,r,.5,(r+1)/2],[.5,r,1,(r+1)/2],[0,(r+1)/2,.5,1],[.5,(r+1)/2,1,1]];
  if(key==='5bottom')return [[0,0,.5,(1-r)/2],[.5,0,1,(1-r)/2],[0,(1-r)/2,.5,1-r],[.5,(1-r)/2,1,1-r],[0,1-r,1,1]];
  if(key==='5mix')return [[0,0,.5,r],[.5,0,1,r],[0,r,1/3,1],[1/3,r,2/3,1],[2/3,r,1,1]];
  if(key==='5mixrev')return [[0,0,1/3,1-r],[1/3,0,2/3,1-r],[2/3,0,1,1-r],[0,1-r,.5,1],[.5,1-r,1,1]];
  if(key==='6grid')return [[0,0,.5,1/3],[.5,0,1,1/3],[0,1/3,.5,2/3],[.5,1/3,1,2/3],[0,2/3,.5,1],[.5,2/3,1,1]];
  return [[0,0,1/3,1/3],[1/3,0,2/3,1/3],[2/3,0,1,1/3],[0,1/3,1/3,2/3],[1/3,1/3,2/3,2/3],[2/3,1/3,1,2/3],[0,2/3,1/3,1],[1/3,2/3,2/3,1],[2/3,2/3,1,1]];
}
function rectsFor(width,height){
  var scale=width/W,m=state.margin*scale,g=state.gap*scale,innerW=width-2*m,innerH=height-2*m,out=[];
  var info=LAYOUTS[state.layout],rows=info.rows||0,cols=info.cols||0;
  if(rows||cols){var t=ensureTuning(state.layout,rows,cols),rs=weightedBands(innerH,g,t.rows),cs=weightedBands(innerW,g,t.cols);if(state.layout==='3rows'){for(var rr=0;rr<3;rr++)out.push({x:m,y:m+rs[rr].start,w:innerW,h:rs[rr].size});}else{for(var r=0;r<rows;r++)for(var c=0;c<cols;c++)out.push({x:m+cs[c].start,y:m+rs[r].start,w:cs[c].size,h:rs[r].size});}return out;}
  var norm=layoutNorm(state.layout,state.ratio);
  for(var i=0;i<norm.length;i++){
    var n=norm[i],x0=m+n[0]*innerW+(n[0]>0?g/2:0),y0=m+n[1]*innerH+(n[1]>0?g/2:0),x1=m+n[2]*innerW-(n[2]<1?g/2:0),y1=m+n[3]*innerH-(n[3]<1?g/2:0);
    out.push({x:x0,y:y0,w:Math.max(1,x1-x0),h:Math.max(1,y1-y0)});
  }
  return out;
}
function roundPath(c,x,y,w,h,r){
  r=Math.max(0,Math.min(r,Math.min(w,h)/2));c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();
}
function imageBounds(s,r){
  if(!s.img)return null;var iw=s.img.naturalWidth||s.img.width,ih=s.img.naturalHeight||s.img.height;if(!iw||!ih)return null;var scale=Math.max(r.w/iw,r.h/ih)*s.zoom;return {w:iw*scale,h:ih*scale,scale:scale};
}
function clampImage(s,r){
  var b=imageBounds(s,r);if(!b)return;var maxX=Math.max(0,(b.w-r.w)/2),maxY=Math.max(0,(b.h-r.h)/2);s.dx=clamp(s.dx,-maxX,maxX);s.dy=clamp(s.dy,-maxY,maxY);
}
function wrapLines(c,text,maxWidth){
  var paras=String(text||'').split('\n'),lines=[];
  for(var p=0;p<paras.length;p++){
    var str=paras[p];if(!str){lines.push('');continue;}var line='';
    for(var i=0;i<str.length;i++){
      var test=line+str.charAt(i);if(line&&c.measureText(test).width>maxWidth){lines.push(line);line=str.charAt(i);}else line=test;
    }
    lines.push(line);
  }
  return lines;
}
function drawTextBlock(c,text,x,y,maxWidth,size,lineHeight,weight,color,font,align){
  c.save();c.font=weight+' '+size+'px '+fontStack(font);c.fillStyle=color;c.textAlign=align||'center';c.textBaseline='middle';var lines=wrapLines(c,text,maxWidth),total=(lines.length-1)*lineHeight;for(var i=0;i<lines.length;i++)c.fillText(lines[i],x,y-total/2+i*lineHeight);c.restore();
}
function hexToRgba(hex,a){var n=parseInt(hex.slice(1),16),r=(n>>16)&255,g=(n>>8)&255,b=n&255;return 'rgba('+r+','+g+','+b+','+a+')';}
function draw(targetCtx,width,height,withGuides){
  var factor=width/W,rects=rectsFor(width,height),rad=state.radius*factor;targetCtx.save();targetCtx.fillStyle=state.bg;targetCtx.fillRect(0,0,width,height);
  for(var i=0;i<rects.length;i++){
    var r=rects[i],s=slots[i];targetCtx.save();roundPath(targetCtx,r.x,r.y,r.w,r.h,rad);targetCtx.clip();targetCtx.fillStyle='#111';targetCtx.fillRect(r.x,r.y,r.w,r.h);
    if(s.mode==='image'&&s.img){var b=imageBounds(s,{w:r.w,h:r.h});var iw=s.img.naturalWidth||s.img.width,ih=s.img.naturalHeight||s.img.height;var x=r.x+r.w/2-b.w/2+s.dx*factor,y=r.y+r.h/2-b.h/2+s.dy*factor;targetCtx.imageSmoothingEnabled=true;targetCtx.drawImage(s.img,x,y,iw*b.scale,ih*b.scale);}else if(s.mode==='text'&&s.text){drawTextBlock(targetCtx,s.text,r.x+r.w/2+s.textDx*factor,r.y+r.h/2+s.textDy*factor,r.w*.88,s.size*factor,s.lineHeight*factor,s.weight,s.color,s.font,'center');}
    targetCtx.restore();
    if(withGuides&&activeAdjust&&activeAdjust.kind==='slot'&&activeAdjust.index===i){targetCtx.save();targetCtx.strokeStyle='#34485a';targetCtx.lineWidth=2*factor;roundPath(targetCtx,r.x,r.y,r.w,r.h,rad);targetCtx.stroke();targetCtx.restore();}
  }
  for(var j=0;j<overlays.length;j++){
    var o=overlays[j];if(!o.text)continue;targetCtx.save();targetCtx.font=o.weight+' '+(o.size*factor)+'px '+fontStack(o.font);targetCtx.textAlign='center';targetCtx.textBaseline='middle';if(o.shadow){targetCtx.shadowColor=hexToRgba(o.shadowColor,o.shadowOpacity/100);targetCtx.shadowBlur=o.shadowBlur*factor;targetCtx.shadowOffsetX=o.shadowX*factor;targetCtx.shadowOffsetY=o.shadowY*factor;}var lines=wrapLines(targetCtx,o.text,width*.9),lh=o.lineHeight*factor,total=(lines.length-1)*lh;targetCtx.fillStyle=o.color;for(var li=0;li<lines.length;li++)targetCtx.fillText(lines[li],o.x*factor,o.y*factor-total/2+li*lh);targetCtx.restore();
  }
  if(withGuides&&activeAdjust){targetCtx.save();targetCtx.strokeStyle='rgba(52,72,90,.65)';targetCtx.lineWidth=1;if(guideX){targetCtx.beginPath();targetCtx.moveTo(width/2,0);targetCtx.lineTo(width/2,height);targetCtx.stroke();}if(guideY){targetCtx.beginPath();targetCtx.moveTo(0,height/2);targetCtx.lineTo(width,height/2);targetCtx.stroke();}targetCtx.restore();}
  targetCtx.restore();
}
function redraw(){draw(ctx,W,H,true);}

function layoutMiniHtml(key){
  var cells=layoutNorm(key,.5),s='<span class="layout-mini">';for(var i=0;i<cells.length;i++){var n=cells[i],left=n[0]*100,top=n[1]*100,w=(n[2]-n[0])*100,h=(n[3]-n[1])*100;s+='<i style="left:'+left+'%;top:'+top+'%;width:'+w+'%;height:'+h+'%"></i>';}
  return s+'</span>';
}
function renderLayoutUI(){
  var count=activeCount(),html='';for(var i=0;i<COUNTS.length;i++){var c=COUNTS[i];html+='<button type="button" class="layout-count'+(c===count?' active':'')+'" data-count="'+c+'">'+c+'</button>';}layoutCounts.innerHTML=html;
  html='';for(var j=0;j<LAYOUT_ORDER.length;j++){var key=LAYOUT_ORDER[j],l=LAYOUTS[key];if(l.count!==count)continue;html+='<button type="button" class="layout-choice'+(key===state.layout?' active':'')+'" data-layout="'+key+'">'+layoutMiniHtml(key)+'<span>'+l.name+'</span></button>';}layoutChoices.innerHTML=html;
  var countBtns=layoutCounts.querySelectorAll('button');for(var b=0;b<countBtns.length;b++)countBtns[b].addEventListener('click',function(){var wanted=Number(this.getAttribute('data-count'));for(var k=0;k<LAYOUT_ORDER.length;k++){if(LAYOUTS[LAYOUT_ORDER[k]].count===wanted){state.layout=LAYOUT_ORDER[k];break;}}renderLayoutUI();renderSlots();updateSwap();redraw();});
  var layoutBtns=layoutChoices.querySelectorAll('button');for(var q=0;q<layoutBtns.length;q++)layoutBtns[q].addEventListener('click',function(){state.layout=this.getAttribute('data-layout');renderLayoutUI();renderSlots();updateSwap();redraw();});
  renderGridAdjust();
}
function updateSwap(){var n=activeCount(),a='',b='';for(var i=0;i<n;i++){a+='<option value="'+i+'">框 '+(i+1)+'</option>';b+='<option value="'+i+'"'+(i===Math.min(1,n-1)?' selected':'')+'>框 '+(i+1)+'</option>';}swapA.innerHTML=a;swapB.innerHTML=b;}

function releaseSlot(s){if(s.url){try{URL.revokeObjectURL(s.url);}catch(e){}s.url=null;}s.img=null;}
function loadImageFile(file,index){
  return new Promise(function(resolve){
    if(!file||!file.type||file.type.indexOf('image/')!==0){setNote('请选择图片文件。');resolve(false);return;}
    var url=URL.createObjectURL(file),img=new Image();setNote('正在载入图片…');
    img.onload=function(){
      var s=slots[index],iw=img.naturalWidth,ih=img.naturalHeight,maxDim=Math.max(iw,ih);releaseSlot(s);
      if(maxDim>4096){var scale=4096/maxDim,c=document.createElement('canvas');c.width=Math.max(1,Math.round(iw*scale));c.height=Math.max(1,Math.round(ih*scale));var cc=c.getContext('2d');cc.imageSmoothingEnabled=true;cc.drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);s.img=c;s.url=null;}else{s.img=img;s.url=url;}
      s.mode='image';s.zoom=1;s.dx=0;s.dy=0;renderSlots();redraw();setNote('');resolve(true);
    };
    img.onerror=function(){URL.revokeObjectURL(url);setNote('图片读取失败，请换一张。');resolve(false);};img.src=url;
  });
}

function renderSlots(){
  var n=activeCount(),html='';for(var i=0;i<n;i++){var s=slots[i];html+='<details class="slot-card"'+(i===0?' open':'')+'><summary><span>框 '+(i+1)+'</span><em>'+(s.mode==='image'?'图片':'文字')+'</em></summary><div class="slot-body">';
    html+='<div class="slot-head"><span class="mini-label">内容类型</span><select id="mode'+i+'"><option value="image"'+(s.mode==='image'?' selected':'')+'>图片</option><option value="text"'+(s.mode==='text'?' selected':'')+'>文字</option></select></div>';
    html+='<div id="imageUI'+i+'" class="image-ui'+(s.mode==='text'?' hidden':'')+'"><div class="slot-tools"><label class="file-btn primary">选择图片<input id="file'+i+'" type="file" accept="image/*"></label><button id="adjust'+i+'" type="button">调整构图</button></div><div class="control"><label>缩放 <output id="zoomOut'+i+'">'+Math.round(s.zoom*100)+'%</output></label><input id="zoom'+i+'" type="range" min="100" max="350" value="'+Math.round(s.zoom*100)+'"></div><button id="reset'+i+'" type="button" class="full">重置图片位置</button></div>';
    html+='<div id="textUI'+i+'" class="text-ui'+(s.mode==='image'?' hidden':'')+'"><textarea id="text'+i+'" placeholder="输入框内文字">'+escapeHtml(s.text)+'</textarea><div class="subgrid"><div><span class="mini-label">字体</span><select id="font'+i+'">'+fontOptions(s.font)+'</select></div><div><span class="mini-label">字重</span><select id="weight'+i+'">'+weightOptions(s.weight)+'</select></div></div><div class="control"><label>字号 <output id="sizeOut'+i+'">'+s.size+' px</output></label><input id="size'+i+'" type="range" min="20" max="120" value="'+s.size+'"></div><div class="control"><label>行高 <output id="lineOut'+i+'">'+s.lineHeight+' px</output></label><input id="line'+i+'" type="range" min="24" max="160" value="'+s.lineHeight+'"></div><div class="row"><span class="mini-label">文字颜色</span>'+colorPairHtml('textColor'+i,s.color,'文字颜色')+'</div><div class="slot-tools"><button id="adjustText'+i+'" type="button">调整位置</button><button id="resetText'+i+'" type="button">居中</button></div></div>';
    html+='</div></details>';}
  slotsPanel.innerHTML=html;
  for(var j=0;j<n;j++)bindSlot(j);
}
function escapeHtml(t){return String(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function weightOptions(v){var vals=[[400,'Regular'],[500,'Medium'],[600,'Semibold'],[700,'Bold']],s='';for(var i=0;i<vals.length;i++)s+='<option value="'+vals[i][0]+'"'+(vals[i][0]===v?' selected':'')+'>'+vals[i][1]+'</option>';return s;}
function bindSlot(i){
  var s=slots[i],mode=document.getElementById('mode'+i),file=document.getElementById('file'+i),zoom=document.getElementById('zoom'+i),text=document.getElementById('text'+i),font=document.getElementById('font'+i),weight=document.getElementById('weight'+i),size=document.getElementById('size'+i),line=document.getElementById('line'+i),color=document.getElementById('textColor'+i),hex=document.getElementById('textColor'+i+'Hex'),swatch=document.getElementById('textColor'+i+'Swatch');
  mode.addEventListener('change',function(){s.mode=mode.value;finishAdjust();renderSlots();redraw();});
  file.addEventListener('change',function(e){loadImageFile(e.target.files[0],i);});
  document.getElementById('adjust'+i).addEventListener('click',function(){if(!s.img){setNote('请先选择图片。');return;}startAdjust('slot',i);});
  zoom.addEventListener('input',function(){s.zoom=Number(zoom.value)/100;document.getElementById('zoomOut'+i).textContent=zoom.value+'%';clampImage(s,rectsFor(W,H)[i]);redraw();});
  document.getElementById('reset'+i).addEventListener('click',function(){s.zoom=1;s.dx=0;s.dy=0;zoom.value=100;document.getElementById('zoomOut'+i).textContent='100%';redraw();});
  text.addEventListener('input',function(){s.text=text.value;redraw();});font.addEventListener('change',function(){s.font=font.value;redraw();});weight.addEventListener('change',function(){s.weight=Number(weight.value);redraw();});size.addEventListener('input',function(){s.size=Number(size.value);document.getElementById('sizeOut'+i).textContent=size.value+' px';redraw();});line.addEventListener('input',function(){s.lineHeight=Number(line.value);document.getElementById('lineOut'+i).textContent=line.value+' px';redraw();});
  bindColor(color,hex,swatch,function(v){s.color=v;redraw();});
  document.getElementById('adjustText'+i).addEventListener('click',function(){if(!s.text.trim()){setNote('请先输入文字。');return;}startAdjust('slot',i);});document.getElementById('resetText'+i).addEventListener('click',function(){s.textDx=0;s.textDy=0;redraw();});
}

function makeOverlay(){return {text:'',font:'auto',weight:500,size:55,lineHeight:65,color:'#F5F2EA',x:W/2,y:H/2,shadow:false,shadowColor:'#000000',shadowOpacity:45,shadowBlur:8,shadowX:0,shadowY:3,arrangeSelected:false};}
function selectedOverlayItems(){var a=[];for(var i=0;i<overlays.length;i++){var o=overlays[i];if(o.arrangeSelected&&o.text.trim())a.push({o:o,i:i});}return a;}
function overlayTextMetrics(o){ctx.save();ctx.font=o.weight+' '+o.size+'px '+fontStack(o.font);var lines=wrapLines(ctx,o.text,W*.9),w=1;for(var i=0;i<lines.length;i++)w=Math.max(w,ctx.measureText(lines[i]).width);w=Math.min(W*.9,w);var h=Math.max(o.lineHeight,lines.length*o.lineHeight);ctx.restore();return {w:w,h:h};}
function updateOverlayArrangeUI(){var count=selectedOverlayItems().length;overlayArrangeCount.textContent='已选 '+count+' 条';overlayArrange.classList.toggle('hidden',count<2);}
function alignSelectedOverlays(mode){var items=selectedOverlayItems();if(items.length<2){setNote('请至少选择两条有文字内容的叠加文字。');return;}var left=W,right=0,metrics=[];for(var i=0;i<items.length;i++){var m=overlayTextMetrics(items[i].o);metrics.push(m);left=Math.min(left,items[i].o.x-m.w/2);right=Math.max(right,items[i].o.x+m.w/2);}var center=(left+right)/2;for(i=0;i<items.length;i++){var o=items[i].o,mm=metrics[i];if(mode==='left')o.x=left+mm.w/2;else if(mode==='right')o.x=right-mm.w/2;else o.x=center;o.x=clamp(o.x,mm.w/2,W-mm.w/2);}redraw();setNote('已对齐 '+items.length+' 条叠加文字。');}
function stackSelectedOverlays(){var items=selectedOverlayItems();if(items.length<2){setNote('请至少选择两条有文字内容的叠加文字。');return;}items.sort(function(a,b){return a.o.y-b.o.y;});var spacing=Number(overlaySpacing.value)||0,metrics=[],top=H,bottom=0,total=spacing*(items.length-1);for(var i=0;i<items.length;i++){var m=overlayTextMetrics(items[i].o);metrics.push(m);top=Math.min(top,items[i].o.y-m.h/2);bottom=Math.max(bottom,items[i].o.y+m.h/2);total+=m.h;}var center=(top+bottom)/2,cursor=center-total/2;if(total<=H)cursor=clamp(cursor,0,H-total);for(i=0;i<items.length;i++){items[i].o.y=cursor+metrics[i].h/2;cursor+=metrics[i].h+spacing;}redraw();setNote('已按 '+spacing+' px 间距纵向排列 '+items.length+' 条叠加文字。');}
function renderOverlays(){
  var html='';for(var i=0;i<overlays.length;i++){var o=overlays[i];html+='<div class="overlay-card"><div class="overlay-head"><strong>文字 '+(i+1)+'</strong><label class="overlay-select"><input id="overlaySelect'+i+'" type="checkbox"'+(o.arrangeSelected?' checked':'')+'>排版</label></div><textarea id="overlayText'+i+'" placeholder="输入叠加文字">'+escapeHtml(o.text)+'</textarea><div class="subgrid"><div><span class="mini-label">字体</span><select id="overlayFont'+i+'">'+fontOptions(o.font)+'</select></div><div><span class="mini-label">字重</span><select id="overlayWeight'+i+'">'+weightOptions(o.weight)+'</select></div></div><div class="control"><label>字号 <output id="overlaySizeOut'+i+'">'+o.size+' px</output></label><input id="overlaySize'+i+'" type="range" min="20" max="140" value="'+o.size+'"></div><div class="control"><label>行高 <output id="overlayLineOut'+i+'">'+o.lineHeight+' px</output></label><input id="overlayLine'+i+'" type="range" min="24" max="180" value="'+o.lineHeight+'"></div><div class="row"><span class="mini-label">文字颜色</span>'+colorPairHtml('overlayColor'+i,o.color,'叠加文字颜色')+'</div><label class="shadow-row"><input id="overlayShadow'+i+'" type="checkbox"'+(o.shadow?' checked':'')+'>文字阴影</label><div id="overlayShadowUI'+i+'" class="'+(o.shadow?'':'hidden')+'"><div class="row"><span class="mini-label">阴影颜色</span>'+colorPairHtml('shadowColor'+i,o.shadowColor,'阴影颜色')+'</div><div class="control"><label>透明度 <output id="shadowOpacityOut'+i+'">'+o.shadowOpacity+'%</output></label><input id="shadowOpacity'+i+'" type="range" min="0" max="100" value="'+o.shadowOpacity+'"></div><div class="subgrid"><div><span class="mini-label">模糊</span><input id="shadowBlur'+i+'" type="number" min="0" max="40" value="'+o.shadowBlur+'"></div><div><span class="mini-label">水平偏移</span><input id="shadowX'+i+'" type="number" min="-30" max="30" value="'+o.shadowX+'"></div></div><div class="subgrid"><div><span class="mini-label">纵向偏移</span><input id="shadowY'+i+'" type="number" min="-30" max="30" value="'+o.shadowY+'"></div></div></div><div class="overlay-actions"><button id="adjustOverlay'+i+'" type="button">调整位置</button><button id="centerOverlay'+i+'" type="button">居中</button><button id="removeOverlay'+i+'" type="button">删除</button></div></div>';}
  overlayPanel.innerHTML=html;for(var j=0;j<overlays.length;j++)bindOverlay(j);updateOverlayArrangeUI();
}
function bindOverlay(i){
  var o=overlays[i],select=document.getElementById('overlaySelect'+i),text=document.getElementById('overlayText'+i),font=document.getElementById('overlayFont'+i),weight=document.getElementById('overlayWeight'+i),size=document.getElementById('overlaySize'+i),line=document.getElementById('overlayLine'+i),color=document.getElementById('overlayColor'+i),hex=document.getElementById('overlayColor'+i+'Hex'),swatch=document.getElementById('overlayColor'+i+'Swatch'),shadow=document.getElementById('overlayShadow'+i),shadowUI=document.getElementById('overlayShadowUI'+i),sc=document.getElementById('shadowColor'+i),sh=document.getElementById('shadowColor'+i+'Hex'),ss=document.getElementById('shadowColor'+i+'Swatch'),so=document.getElementById('shadowOpacity'+i),sb=document.getElementById('shadowBlur'+i),sx=document.getElementById('shadowX'+i),sy=document.getElementById('shadowY'+i);
  select.addEventListener('change',function(){o.arrangeSelected=select.checked;updateOverlayArrangeUI();});text.addEventListener('input',function(){o.text=text.value;updateOverlayArrangeUI();redraw();});font.addEventListener('change',function(){o.font=font.value;redraw();});weight.addEventListener('change',function(){o.weight=Number(weight.value);redraw();});size.addEventListener('input',function(){o.size=Number(size.value);document.getElementById('overlaySizeOut'+i).textContent=size.value+' px';redraw();});line.addEventListener('input',function(){o.lineHeight=Number(line.value);document.getElementById('overlayLineOut'+i).textContent=line.value+' px';redraw();});bindColor(color,hex,swatch,function(v){o.color=v;redraw();});
  shadow.addEventListener('change',function(){o.shadow=shadow.checked;shadowUI.classList.toggle('hidden',!o.shadow);redraw();});bindColor(sc,sh,ss,function(v){o.shadowColor=v;redraw();});so.addEventListener('input',function(){o.shadowOpacity=Number(so.value);document.getElementById('shadowOpacityOut'+i).textContent=so.value+'%';redraw();});sb.addEventListener('input',function(){o.shadowBlur=Number(sb.value)||0;redraw();});sx.addEventListener('input',function(){o.shadowX=Number(sx.value)||0;redraw();});sy.addEventListener('input',function(){o.shadowY=Number(sy.value)||0;redraw();});
  document.getElementById('adjustOverlay'+i).addEventListener('click',function(){if(!o.text.trim()){setNote('请先输入叠加文字。');return;}startAdjust('overlay',i);});document.getElementById('centerOverlay'+i).addEventListener('click',function(){o.x=W/2;o.y=H/2;redraw();});document.getElementById('removeOverlay'+i).addEventListener('click',function(){finishAdjust();overlays.splice(i,1);renderOverlays();redraw();});
}

function startAdjust(kind,index){activeAdjust={kind:kind,index:index};pointers={};gesture=null;guideX=false;guideY=false;canvas.classList.add('adjusting');adjustBar.classList.remove('hidden');adjustLabel.textContent=kind==='overlay'?'正在调整叠加文字 '+(index+1):'正在调整框 '+(index+1);setNote('拖动改变位置；图片可双指缩放。');redraw();}
function finishAdjust(){activeAdjust=null;pointers={};gesture=null;guideX=false;guideY=false;canvas.classList.remove('adjusting');adjustBar.classList.add('hidden');redraw();}
finishAdjustBtn.addEventListener('click',finishAdjust);
function pointerPoint(e){var r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}
function pointerList(){var a=[];for(var k in pointers)if(Object.prototype.hasOwnProperty.call(pointers,k))a.push(pointers[k]);return a;}
function snapshotGesture(){
  if(!activeAdjust)return;var ps=pointerList();if(!ps.length){gesture=null;return;}var cx=0,cy=0;for(var i=0;i<ps.length;i++){cx+=ps[i].x;cy+=ps[i].y;}cx/=ps.length;cy/=ps.length;
  if(activeAdjust.kind==='overlay'){var o=overlays[activeAdjust.index];gesture={kind:'overlay',cx:cx,cy:cy,x:o.x,y:o.y};return;}
  var s=slots[activeAdjust.index],dist=0;if(ps.length>=2)dist=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y);gesture={kind:'slot',mode:s.mode,cx:cx,cy:cy,dx:s.mode==='image'?s.dx:s.textDx,dy:s.mode==='image'?s.dy:s.textDy,zoom:s.zoom,dist:dist};
}
// Touch gestures are handled separately so the mini-tool WebView cannot
// interpret vertical image dragging as a request to scroll the page.
function moveAdjustment(){
  if(!activeAdjust||!gesture)return;
  var ps=pointerList();if(!ps.length)return;
  var cx=0,cy=0;for(var i=0;i<ps.length;i++){cx+=ps[i].x;cy+=ps[i].y;}cx/=ps.length;cy/=ps.length;var snap=18;
  if(activeAdjust.kind==='overlay'){
    var o=overlays[activeAdjust.index],nx=gesture.x+(cx-gesture.cx),ny=gesture.y+(cy-gesture.cy);
    guideX=Math.abs(nx-W/2)<=snap;guideY=Math.abs(ny-H/2)<=snap;
    o.x=guideX?W/2:clamp(nx,0,W);o.y=guideY?H/2:clamp(ny,0,H);redraw();return;
  }
  var s=slots[activeAdjust.index];
  if(gesture.mode==='image'){
    s.dx=gesture.dx+(cx-gesture.cx);s.dy=gesture.dy+(cy-gesture.cy);
    if(ps.length>=2&&gesture.dist>0){
      var d=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y);
      s.zoom=clamp(gesture.zoom*d/gesture.dist,1,3.5);
      var z=document.getElementById('zoom'+activeAdjust.index),zo=document.getElementById('zoomOut'+activeAdjust.index);
      if(z)z.value=Math.round(s.zoom*100);if(zo)zo.textContent=Math.round(s.zoom*100)+'%';
    }
    guideX=Math.abs(s.dx)<=snap;guideY=Math.abs(s.dy)<=snap;
    if(guideX)s.dx=0;if(guideY)s.dy=0;
    clampImage(s,rectsFor(W,H)[activeAdjust.index]);
  }else{
    s.textDx=gesture.dx+(cx-gesture.cx);s.textDy=gesture.dy+(cy-gesture.cy);
    guideX=Math.abs(s.textDx)<=snap;guideY=Math.abs(s.textDy)<=snap;
    if(guideX)s.textDx=0;if(guideY)s.textDy=0;
  }
  redraw();
}
canvas.addEventListener('pointerdown',function(e){
  if(e.pointerType==='touch'||!activeAdjust)return;
  pointers[e.pointerId]=pointerPoint(e);
  try{canvas.setPointerCapture(e.pointerId);}catch(err){}
  snapshotGesture();e.preventDefault();
});
canvas.addEventListener('pointermove',function(e){
  if(e.pointerType==='touch'||!activeAdjust||!pointers[e.pointerId])return;
  pointers[e.pointerId]=pointerPoint(e);moveAdjustment();e.preventDefault();
});
function endPointer(e){
  if(e.pointerType==='touch'||!pointers[e.pointerId])return;
  delete pointers[e.pointerId];guideX=false;guideY=false;snapshotGesture();redraw();
}
canvas.addEventListener('pointerup',endPointer);
canvas.addEventListener('pointercancel',endPointer);
canvas.addEventListener('lostpointercapture',endPointer);
function syncTouchPoints(e){
  // Every active finger is tracked by identifier; this supports drag and pinch.
  for(var k in pointers)if(Object.prototype.hasOwnProperty.call(pointers,k)&&k.charAt(0)==='t')delete pointers[k];
  for(var i=0;i<e.targetTouches.length;i++){
    var t=e.targetTouches[i],r=canvas.getBoundingClientRect();
    pointers['t'+t.identifier]={x:(t.clientX-r.left)*W/r.width,y:(t.clientY-r.top)*H/r.height};
  }
}
canvas.addEventListener('touchstart',function(e){
  if(!activeAdjust)return;
  syncTouchPoints(e);snapshotGesture();
  if(e.cancelable)e.preventDefault();
},{passive:false});
canvas.addEventListener('touchmove',function(e){
  if(!activeAdjust)return;
  syncTouchPoints(e);moveAdjustment();
  if(e.cancelable)e.preventDefault();
},{passive:false});
function endTouch(e){
  if(!activeAdjust)return;
  syncTouchPoints(e);guideX=false;guideY=false;snapshotGesture();redraw();
  if(e.cancelable)e.preventDefault();
}
canvas.addEventListener('touchend',endTouch,{passive:false});
canvas.addEventListener('touchcancel',endTouch,{passive:false});
canvas.addEventListener('wheel',function(e){if(!activeAdjust||activeAdjust.kind!=='slot')return;var s=slots[activeAdjust.index];if(s.mode!=='image'||!s.img)return;s.zoom=clamp(s.zoom*Math.exp(-e.deltaY*.0025),1,3.5);clampImage(s,rectsFor(W,H)[activeAdjust.index]);var z=document.getElementById('zoom'+activeAdjust.index),zo=document.getElementById('zoomOut'+activeAdjust.index);if(z)z.value=Math.round(s.zoom*100);if(zo)zo.textContent=Math.round(s.zoom*100)+'%';redraw();e.preventDefault();},{passive:false});
canvas.addEventListener('click',function(e){if(activeAdjust)return;var p=pointerPoint(e),rects=rectsFor(W,H),hit=-1;for(var i=0;i<rects.length;i++){var r=rects[i];if(p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h){hit=i;break;}}if(hit<0)return;var s=slots[hit];if(s.mode==='image'&&!s.img){var f=document.getElementById('file'+hit);if(f)f.click();}else startAdjust('slot',hit);});

function slotReady(s){return s.mode==='image'?!!s.img:!!s.text.trim();}
function ensureFonts(){
  if(!document.fonts||!document.fonts.load)return Promise.resolve();var jobs=[];jobs.push(document.fonts.load('400 32px "XHSLXGW"'));jobs.push(document.fonts.load('400 32px "XHSCormorant"'));return Promise.all(jobs).catch(function(){return null;});
}
function saveOutput(type){
  var n=activeCount();for(var i=0;i<n;i++){if(!slotReady(slots[i])){setNote('当前布局的每个框都需要有图片或文字。');return;}}
  setNote('正在生成图片…');ensureFonts().then(function(){var out=document.createElement('canvas');out.width=EXPORT_W;out.height=EXPORT_H;draw(out.getContext('2d'),EXPORT_W,EXPORT_H,false);var dataUrl=out.toDataURL(type,type==='image/jpeg'?0.94:undefined);var mini=window.xhs&&window.xhs.miniTool;if(!mini||typeof mini.saveImageToPhotosAlbum!=='function'){exportPreview.src=dataUrl;exportPreview.classList.remove('hidden');setNote('已生成预览；当前环境没有小红书保存接口，请在创服平台模拟器或真机中测试保存。');return;}var savePathPromise;if(typeof mini.writeTempFile==='function'){savePathPromise=mini.writeTempFile({data:dataUrl}).then(function(res){return res.filePath;});}else savePathPromise=Promise.resolve(dataUrl);return savePathPromise.then(function(path){return mini.saveImageToPhotosAlbum({filePath:path});}).then(function(){exportPreview.classList.add('hidden');setNote('已保存到系统相册。');}).catch(function(err){exportPreview.src=dataUrl;exportPreview.classList.remove('hidden');setNote('保存失败；已生成预览，请检查相册权限后重试。');if(window.console)console.log(err);});});
}

resetGrid.addEventListener('click',function(){var info=LAYOUTS[state.layout],rows=info.rows||0,cols=info.cols||0;if(!rows&&!cols)return;layoutTuning[state.layout]={rows:equalBands(rows),cols:equalBands(cols)};renderGridAdjust();redraw();});
overlayAlignLeft.addEventListener('click',function(){alignSelectedOverlays('left');});
overlayAlignCenter.addEventListener('click',function(){alignSelectedOverlays('center');});
overlayAlignRight.addEventListener('click',function(){alignSelectedOverlays('right');});
overlaySpacing.addEventListener('input',function(){overlaySpacingOut.textContent=overlaySpacing.value+' px';});
overlayStack.addEventListener('click',stackSelectedOverlays);

ratioInput.addEventListener('input',function(){state.ratio=Number(ratioInput.value)/100;document.getElementById('ratioOut').textContent=ratioInput.value+'%';redraw();});
marginInput.addEventListener('input',function(){state.margin=Number(marginInput.value);document.getElementById('marginOut').textContent=marginInput.value;redraw();});
gapInput.addEventListener('input',function(){state.gap=Number(gapInput.value);document.getElementById('gapOut').textContent=gapInput.value;redraw();});
radiusInput.addEventListener('input',function(){state.radius=Number(radiusInput.value);document.getElementById('radiusOut').textContent=radiusInput.value;redraw();});
bindColor(bgInput,bgHex,bgSwatch,function(v){state.bg=v;redraw();});
batchFiles.addEventListener('change',function(e){var files=[];var all=e.target.files||[];for(var i=0;i<all.length;i++)if(all[i].type&&all[i].type.indexOf('image/')===0)files.push(all[i]);var n=activeCount(),count=Math.min(files.length,n),p=Promise.resolve();for(var j=0;j<count;j++){(function(file,index){p=p.then(function(){return loadImageFile(file,index);});})(files[j],j);}p.then(function(){batchFiles.value='';if(files.length>n)setNote('已填入前 '+n+' 张；当前布局只有 '+n+' 个框。');else if(count)setNote('已填入 '+count+' 张图片。');});});
document.getElementById('swapBtn').addEventListener('click',function(){var a=Number(swapA.value),b=Number(swapB.value);if(a===b)return;var t=slots[a];slots[a]=slots[b];slots[b]=t;finishAdjust();renderSlots();redraw();setNote('已交换框 '+(a+1)+' 和框 '+(b+1)+'。');});
document.getElementById('clearAll').addEventListener('click',function(){finishAdjust();for(var i=0;i<slots.length;i++){releaseSlot(slots[i]);slots[i]=makeSlot();}overlays=[];renderSlots();renderOverlays();redraw();setNote('已清空。');});
document.getElementById('addOverlay').addEventListener('click',function(){overlays.push(makeOverlay());renderOverlays();redraw();});
document.getElementById('savePng').addEventListener('click',function(){saveOutput('image/png');});
document.getElementById('saveJpg').addEventListener('click',function(){saveOutput('image/jpeg');});

renderLayoutUI();updateSwap();renderSlots();renderOverlays();redraw();
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(redraw).catch(function(){redraw();});
})();