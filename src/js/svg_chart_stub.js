/* v1.12 모바일 — Chart.js 대신 SVG로 직접 렌더링.
   200KB 라이브러리 없이도 라디아·산점도·막대·라인 차트를 보여줌. */
(function(){
  function _q(canvas){return canvas && canvas.getContext;}
  function _esc(s){return String(s).replace(/[<>&"]/g, c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));}
  function _replace(canvas, svgHtml){
    if(!canvas || !canvas.parentElement) return;
    canvas.style.display='none';
    var prev = canvas.parentElement.querySelector('.svg-chart-out');
    if(prev) prev.remove();
    var d = document.createElement('div');
    d.className='svg-chart-out';
    d.style.cssText='width:100%;height:100%;display:flex;align-items:center;justify-content:center';
    d.innerHTML = svgHtml;
    canvas.parentElement.appendChild(d);
  }
  // ───── Scatter (4분면 / 분포 / 구속vs잠재) ─────
  function svgScatter(data, opts){
    var W=420,H=240,M={l:42,r:14,t:12,b:36};
    var xs=opts.scales&&opts.scales.x||{}, ys=opts.scales&&opts.scales.y||{};
    var allPts=[]; (data.datasets||[]).forEach(function(ds){(ds.data||[]).forEach(function(p){if(p&&typeof p.x==='number')allPts.push(p);});});
    var xMin=xs.min!=null?xs.min:Math.min.apply(null,allPts.map(function(p){return p.x;}).concat([0]));
    var xMax=xs.max!=null?xs.max:Math.max.apply(null,allPts.map(function(p){return p.x;}).concat([100]));
    var yMin=ys.min!=null?ys.min:Math.min.apply(null,allPts.map(function(p){return p.y;}).concat([0]));
    var yMax=ys.max!=null?ys.max:Math.max.apply(null,allPts.map(function(p){return p.y;}).concat([100]));
    if(xMax===xMin)xMax=xMin+1; if(yMax===yMin)yMax=yMin+1;
    function xPx(x){return M.l+(x-xMin)/(xMax-xMin)*(W-M.l-M.r);}
    function yPx(y){return H-M.b-(y-yMin)/(yMax-yMin)*(H-M.t-M.b);}
    var svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">';
    // grid
    for(var i=0;i<=4;i++){var gy=M.t+i*(H-M.t-M.b)/4;svg+='<line x1="'+M.l+'" y1="'+gy+'" x2="'+(W-M.r)+'" y2="'+gy+'" stroke="#eee" stroke-width="0.5"/>';
      var gv=Math.round(yMax-(yMax-yMin)*i/4); svg+='<text x="'+(M.l-4)+'" y="'+(gy+3)+'" font-size="9" fill="#888" text-anchor="end">'+gv+'</text>';}
    for(var j=0;j<=4;j++){var gx=M.l+j*(W-M.l-M.r)/4;svg+='<line x1="'+gx+'" y1="'+M.t+'" x2="'+gx+'" y2="'+(H-M.b)+'" stroke="#eee" stroke-width="0.5"/>';
      var gv2=Math.round(xMin+(xMax-xMin)*j/4); svg+='<text x="'+gx+'" y="'+(H-M.b+12)+'" font-size="9" fill="#888" text-anchor="middle">'+gv2+'</text>';}
    // axes
    svg+='<line x1="'+M.l+'" y1="'+(H-M.b)+'" x2="'+(W-M.r)+'" y2="'+(H-M.b)+'" stroke="#999"/>';
    svg+='<line x1="'+M.l+'" y1="'+M.t+'" x2="'+M.l+'" y2="'+(H-M.b)+'" stroke="#999"/>';
    // datasets
    (data.datasets||[]).forEach(function(ds,di){
      var bg=ds.backgroundColor, br=ds.borderColor;
      // line dataset (e.g. diagonal)
      if(ds.type==='line' && ds.data && ds.data.length>1){
        var pts=ds.data.map(function(p){return xPx(p.x)+','+yPx(p.y);}).join(' ');
        svg+='<polyline points="'+pts+'" fill="none" stroke="'+(br||'#cf222e')+'" stroke-width="1.5" stroke-dasharray="4,3"/>';
        return;
      }
      (ds.data||[]).forEach(function(p,i){
        if(!p||typeof p.x!=='number') return;
        var c=Array.isArray(bg)?bg[i]:(bg||'#0969da80');
        var r=Array.isArray(ds.pointRadius)?ds.pointRadius[i]:(ds.pointRadius||4);
        svg+='<circle cx="'+xPx(p.x)+'" cy="'+yPx(p.y)+'" r="'+r+'" fill="'+c+'" stroke="'+(Array.isArray(br)?br[i]:br||'#0969da')+'" stroke-width="1"/>';
      });
    });
    var xt=opts.scales&&opts.scales.x&&opts.scales.x.title&&opts.scales.x.title.text||'';
    var yt=opts.scales&&opts.scales.y&&opts.scales.y.title&&opts.scales.y.title.text||'';
    if(xt) svg+='<text x="'+(W/2)+'" y="'+(H-2)+'" font-size="10" fill="#555" text-anchor="middle">'+_esc(xt)+'</text>';
    if(yt) svg+='<text x="10" y="'+(H/2)+'" font-size="10" fill="#555" text-anchor="middle" transform="rotate(-90 10 '+(H/2)+')">'+_esc(yt)+'</text>';
    svg+='</svg>'; return svg;
  }
  // ───── Bar (시퀀스, 향상도) ─────
  function svgBar(data, opts){
    var W=420,H=240,M={l:42,r:14,t:14,b:48};
    var labels=data.labels||[];
    var dss=data.datasets||[];
    var allVals=[].concat.apply([],dss.map(function(d){return (d.data||[]).filter(function(v){return typeof v==='number';});}));
    var maxV=Math.max.apply(null,allVals.concat([1]));
    var minV=Math.min.apply(null,allVals.concat([0]));
    if(minV>0)minV=0;
    function yPx(v){return H-M.b-(v-minV)/(maxV-minV)*(H-M.t-M.b);}
    var groupW=(W-M.l-M.r)/Math.max(1,labels.length);
    var barW=Math.max(4,(groupW-4)/Math.max(1,dss.length));
    var svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">';
    // grid
    for(var i=0;i<=4;i++){var gy=M.t+i*(H-M.t-M.b)/4;svg+='<line x1="'+M.l+'" y1="'+gy+'" x2="'+(W-M.r)+'" y2="'+gy+'" stroke="#eee" stroke-width="0.5"/>';
      var gv=Math.round(maxV-(maxV-minV)*i/4); svg+='<text x="'+(M.l-4)+'" y="'+(gy+3)+'" font-size="9" fill="#888" text-anchor="end">'+gv+'</text>';}
    // zero line if minV<0
    if(minV<0){var z=yPx(0);svg+='<line x1="'+M.l+'" y1="'+z+'" x2="'+(W-M.r)+'" y2="'+z+'" stroke="#999" stroke-width="0.8"/>';}
    // bars
    labels.forEach(function(lbl,li){
      var groupX=M.l+li*groupW+2;
      dss.forEach(function(ds,di){
        var v=ds.data[li]; if(typeof v!=='number') return;
        var c=Array.isArray(ds.backgroundColor)?ds.backgroundColor[li]:(ds.backgroundColor||'#0969da');
        var x=groupX+di*barW;
        var y=yPx(Math.max(0,v)), h=Math.abs(yPx(v)-yPx(0));
        svg+='<rect x="'+x+'" y="'+y+'" width="'+(barW-1)+'" height="'+h+'" fill="'+c+'" rx="1"/>';
      });
      var lx=groupX+groupW/2-2;
      svg+='<text x="'+lx+'" y="'+(H-M.b+12)+'" font-size="8.5" fill="#666" text-anchor="middle">'+_esc(String(lbl).slice(0,6))+'</text>';
    });
    svg+='</svg>'; return svg;
  }
  // ───── Radar (5축) ─────
  function svgRadar(data, opts){
    var W=300,H=240,cx=W/2,cy=H/2-8,R=Math.min(cx,cy)-30;
    var labels=data.labels||[]; var n=labels.length||5;
    function ang(i){return -Math.PI/2+i*2*Math.PI/n;}
    function pt(i,v){var r=R*Math.max(0,Math.min(1,v/100));return [cx+r*Math.cos(ang(i)),cy+r*Math.sin(ang(i))];}
    var svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">';
    // rings
    [0.2,0.4,0.6,0.8,1.0].forEach(function(f){
      var pts=[];for(var i=0;i<n;i++){var x=cx+R*f*Math.cos(ang(i)),y=cy+R*f*Math.sin(ang(i));pts.push(x+','+y);}
      svg+='<polygon points="'+pts.join(' ')+'" fill="none" stroke="#ddd" stroke-width="0.5"/>';
    });
    // spokes
    for(var i=0;i<n;i++){var p=pt(i,100);svg+='<line x1="'+cx+'" y1="'+cy+'" x2="'+p[0]+'" y2="'+p[1]+'" stroke="#ddd" stroke-width="0.5"/>';}
    // datasets
    (data.datasets||[]).forEach(function(ds,di){
      var pts=(ds.data||[]).map(function(v,i){return pt(i,v||0).join(',');}).join(' ');
      var fill=ds.backgroundColor||'rgba(9,105,218,0.18)', stk=ds.borderColor||'#0969da';
      var dash=ds.borderDash?' stroke-dasharray="4,3"':'';
      svg+='<polygon points="'+pts+'" fill="'+fill+'" stroke="'+stk+'" stroke-width="1.5"'+dash+'/>';
    });
    // labels
    for(var i=0;i<n;i++){var p2=pt(i,118);svg+='<text x="'+p2[0]+'" y="'+p2[1]+'" font-size="10" fill="#333" text-anchor="middle">'+_esc(labels[i]||'')+'</text>';}
    svg+='</svg>'; return svg;
  }
  // ───── Line (시계열) ─────
  function svgLine(data, opts){
    var W=420,H=240,M={l:42,r:42,t:12,b:36};
    var labels=data.labels||[];
    var dss=data.datasets||[];
    var allY=[].concat.apply([],dss.map(function(d){return (d.data||[]).filter(function(v){return typeof v==='number';});}));
    var maxY=Math.max.apply(null,allY.concat([1]));
    var minY=Math.min.apply(null,allY.concat([0]));
    if(maxY===minY)maxY=minY+1;
    function xPx(i){return M.l+(labels.length>1?i/(labels.length-1):0.5)*(W-M.l-M.r);}
    function yPx(v){return H-M.b-(v-minY)/(maxY-minY)*(H-M.t-M.b);}
    var svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">';
    // grid
    for(var i=0;i<=4;i++){var gy=M.t+i*(H-M.t-M.b)/4;svg+='<line x1="'+M.l+'" y1="'+gy+'" x2="'+(W-M.r)+'" y2="'+gy+'" stroke="#eee" stroke-width="0.5"/>';
      var gv=(maxY-(maxY-minY)*i/4); svg+='<text x="'+(M.l-4)+'" y="'+(gy+3)+'" font-size="9" fill="#888" text-anchor="end">'+gv.toFixed(0)+'</text>';}
    // x labels
    labels.forEach(function(l,i){svg+='<text x="'+xPx(i)+'" y="'+(H-M.b+14)+'" font-size="9" fill="#666" text-anchor="middle">'+_esc(String(l).split('\n')[0])+'</text>';});
    // lines
    dss.forEach(function(ds,di){
      var pts=(ds.data||[]).map(function(v,i){return typeof v==='number'?(xPx(i)+','+yPx(v)):null;}).filter(Boolean).join(' ');
      svg+='<polyline points="'+pts+'" fill="none" stroke="'+(ds.borderColor||'#0969da')+'" stroke-width="2"/>';
      (ds.data||[]).forEach(function(v,i){if(typeof v==='number')svg+='<circle cx="'+xPx(i)+'" cy="'+yPx(v)+'" r="3" fill="'+(ds.borderColor||'#0969da')+'"/>';});
    });
    return svg+'</svg>';
  }
  function StubChart(canvas, config){
    if(!_q(canvas)){return {destroy:function(){},update:function(){},resize:function(){}};}
    try{
      var t=config.type, svg='';
      if(t==='scatter') svg=svgScatter(config.data, config.options||{});
      else if(t==='bar') svg=svgBar(config.data, config.options||{});
      else if(t==='radar') svg=svgRadar(config.data, config.options||{});
      else if(t==='line') svg=svgLine(config.data, config.options||{});
      else svg='<div style="color:#999;font-size:11px;padding:20px">📊 차트 ('+t+')</div>';
      _replace(canvas, svg);
    }catch(e){console.warn('SVG chart error:',e);}
    return {destroy:function(){var p=canvas&&canvas.parentElement&&canvas.parentElement.querySelector('.svg-chart-out');if(p)p.remove();},
            update:function(){},resize:function(){}};
  }
  StubChart.register=function(){};StubChart.defaults={};StubChart.helpers={};
  window.Chart=StubChart;
})();