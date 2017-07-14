(function(document){
  var bg = chrome.extension.getBackgroundPage(),
    types = bg.getTypes(),
    originTypes = types.concat(),
    checkboxs = document.getElementsByClassName('listen'),
    reloadBtn = document.getElementById('reload');

  [].forEach.call(checkboxs, function(checkbox){
    var type = checkbox.id.replace('listen_', '');
    ~types.indexOf(type) && checkbox.setAttribute('checked', true);

    checkbox.addEventListener('click', function(){
      var type = checkbox.id.replace('listen_', '');
      bg.setTypes(type, this.checked);
      var noChange = originTypes.length === types.length && types.every(function(v){
          return ~originTypes.indexOf(v);
        });
      switchBtnStatus(noChange);
    });
  });

  reloadBtn.addEventListener('click', function(){
    bg.reloadAllListeners();
    switchBtnStatus(true);
    originTypes = types.concat();
  });

  function switchBtnStatus(bool){
    reloadBtn.disabled = bool;
    reloadBtn.style.color = bool ? '#ccc' : '';
  }
})(document);
