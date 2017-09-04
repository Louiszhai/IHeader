(function(document){
  var bg          = chrome.extension.getBackgroundPage(),
      types       = bg.getTypes(),
      allTypes    = bg.getAllTypes(),
      box         = document.getElementById('settings'),
      reloadBtn   = document.getElementById('reload'),
      corsBtn     = document.getElementById('cors');

  allTypes.forEach(function(type){
    createOptions(type);
  });

  reloadBtn.addEventListener('click', function(){
    bg.reloadAllListeners();
    switchBtnStatus(true);
    allTypes = types.concat();
  });

  bg.getDefaultCORS() && corsBtn.setAttribute('checked', 'true');
  corsBtn.addEventListener('click', function(){
    bg.setDefaultCORS(this.checked);
  });

  function switchBtnStatus(bool){
    reloadBtn.disabled = bool;
    reloadBtn.style.color = bool ? '#ccc' : '';
  }

  function createOptions(type){
    var id        = 'listen_' + type,
        p         = document.createElement('p'),
        checkbox  = document.createElement('input'),
        label     = document.createElement('label');
    checkbox.id = id;
    checkbox.type = 'checkbox';
    checkbox.className = 'listen';
    label.setAttribute('for', id);
    label.innerText = type;

    ~types.indexOf(type) && checkbox.setAttribute('checked', 'true');
    checkbox.addEventListener('click', function(){
      bg.setTypes(type, this.checked);
      var noChange = allTypes.length === types.length && types.every(function(v){
        return ~allTypes.indexOf(v);
      });
      switchBtnStatus(noChange);
    });

    p.appendChild(checkbox);
    p.appendChild(label);
    box.appendChild(p);
  }
})(document);
