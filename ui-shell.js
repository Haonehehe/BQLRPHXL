/* BQLRPH UI Shell · dùng chung cho các module */
(function(){
  'use strict';
  var KEY='bqlrph_theme';
  var TITLES={
    qlbvr:'Quản lý bảo vệ rừng',lamba:'Quản lý đất đai · Lâm bạ',
    nhao:'Quản lý nhà ở trên lâm phận',mocgioi:'Quản lý mốc giới',
    trongrung:'Trồng và chăm sóc rừng',tasks:'Quản lý nhiệm vụ',
    tonghop:'Tổng hợp đường dẫn',pcccr:'Phòng cháy, chữa cháy rừng',
    pdf:'Công cụ PDF',bando:'Bản đồ và tọa độ',congcu:'Bộ tiện ích',
    lamnghiep:'Công cụ lâm nghiệp',phapluat:'Tra cứu pháp luật',
    thongbao:'Thông báo và niêm yết',admin:'Quản trị hệ thống'
  };
  function getTheme(){
    try{var t=localStorage.getItem(KEY);if(t==='dark'||t==='light')return t;}catch(e){}
    return 'light';
  }
  function applyTheme(t,save){
    t=t==='dark'?'dark':'light';
    document.documentElement.setAttribute('data-theme',t);
    if(document.body){
      document.body.classList.add('bq-ui');
      document.body.classList.toggle('bq-dark',t==='dark');
    }
    var meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',t==='dark'?'#17231d':'#f5f8f6');
    if(save!==false){try{localStorage.setItem(KEY,t);}catch(e){}}
    var b=document.querySelector('[data-bq-theme-toggle]');
    if(b){b.setAttribute('aria-label',t==='dark'?'Chuyển sang giao diện sáng':'Chuyển sang giao diện tối');b.innerHTML=t==='dark'?'<i class="fa-solid fa-sun" aria-hidden="true"></i><span>Giao diện sáng</span>':'<i class="fa-solid fa-moon" aria-hidden="true"></i><span>Giao diện tối</span>';}
  }
  function makeControls(){
    var group=document.createElement('div');
    group.className='bq-shell-actions';
    group.innerHTML='<a class="bq-ui-back" href="menu.html" aria-label="Quay lại menu"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i><span class="bq-ui-back-label">Quay lại Menu</span></a><button class="bq-ui-icon-button" type="button" data-bq-theme-toggle aria-label="Chuyển giao diện"></button>';
    group.querySelector('[data-bq-theme-toggle]').addEventListener('click',function(){applyTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark');});
    return group;
  }
  function inferModule(){
    var body=document.body,mod=body&&body.getAttribute('data-bqlrph-module');
    if(mod)return mod;
    var file=(location.pathname.split('/').pop()||'').toLowerCase();
    var map={
      'quanly-qlbvr.html':'qlbvr','quanly-datdai-lamba.html':'lamba',
      'quanly-nhao-lampart.html':'nhao','quanly-mocgioi.html':'mocgioi',
      'quanly-trongrung.html':'trongrung','quanly-nhiemvu-gantt.html':'tasks',
      'quanly-tonghop-duongdan.html':'tonghop','quanly-pcccr.html':'pcccr',
      'quanly-pdf.html':'pdf','tienich-bando.html':'bando',
      'tienich-congcu.html':'congcu','tienich-lamnghiep.html':'lamnghiep',
      'tienich-phapluat.html':'phapluat','tienich-thongbao.html':'thongbao',
      'admin.html':'admin'
    };
    mod=map[file]||'';
    if(mod&&body)body.setAttribute('data-bqlrph-module',mod);
    return mod;
  }
  function mount(){
    if(!document.body)return;
    if(document.documentElement.classList.contains('bqlrph-wait'))return;
    var mod=inferModule();
    if(!mod||mod==='menu')return;
    document.body.classList.add('bq-ui');
    if(document.querySelector('[data-bq-shell-mounted]')){applyTheme(getTheme(),false);return;}
    var controls=makeControls();
    var existing=document.querySelector('.top-in');
    if(existing){
      existing.appendChild(controls);
    }else{
      var header=document.createElement('header');
      header.className='bq-ui-header';
      header.setAttribute('data-bq-shell-mounted','1');
      header.innerHTML='<div class="bq-ui-header-inner"><div class="bq-ui-brand"><span class="bq-ui-brand-mark"><i class="fa-solid fa-tree" aria-hidden="true"></i></span><div><div class="bq-ui-brand-title">Ban Quản lý rừng phòng hộ Xuân Lộc</div><div class="bq-ui-brand-subtitle">'+(TITLES[mod]||document.title)+'</div></div></div></div>';
      header.querySelector('.bq-ui-header-inner').appendChild(controls);
      document.body.insertBefore(header,document.body.firstChild);
    }
    document.body.setAttribute('data-bq-shell-mounted','1');
    applyTheme(getTheme(),false);
  }
  function start(){
    mount();
    if(window.MutationObserver&&document.body){
      var obs=new MutationObserver(function(){mount();});
      obs.observe(document.documentElement,{attributes:true,attributeFilter:['class','data-theme']});
      obs.observe(document.body,{childList:true,subtree:true});
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
  window.BQLRPHTheme={set:function(t){applyTheme(t);},get:getTheme};
})();