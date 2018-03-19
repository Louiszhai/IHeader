/**
 * Created by louiszhai on 17/7/14.
 */

(function(window){
  var proxyMap = {};
  var pac = function(url, host){
    if (host in proxyMap) {
      return 'PROXY ' + proxyMap[host];
    } else {
      return 'AUTO_DETECT;';
    }
  };
  pac = 'var FindProxyForURL = ' + pac + ';';

  var details = {
    value: {
      mode: "pac_script",
      pacScript: {
        data: ''
      }
    },
    scope: 'regular'
  };
  var callback = function(){};

  window.updateProxy = function(map){
    Object.assign(proxyMap, map);
    details.value.pacScript.data = 'var proxyMap = ' + JSON.stringify(proxyMap) + ';' + pac;
    chrome.proxy.settings.set(details, callback);
  };
  window.getProxyMap = function(){
    return proxyMap;
  };
  window.setProxyMap = function(map){
    proxyMap = map;
    localStorage.setItem('proxyMap', JSON.stringify(proxyMap));
  };
  window.toggleProxy = function(flag){
    if(flag){
      if(!window.isProxyOn){
        var map = JSON.parse(localStorage.getItem('proxyMap'));
        updateProxy(map);
        window.isProxyOn = true;
      }
    }else if(window.isProxyOn){
      chrome.proxy.settings.clear({ scope: 'regular' }, callback);
      window.isProxyOn = false;
    }
  };
  (function() {
    if(localStorage.getItem('proxyMap')){
      proxyMap = JSON.parse(localStorage.getItem('proxyMap'));
    } else {
      localStorage.setItem('proxyMap', '{}');
    }
    window.toggleProxy(localStorage.getItem('proxySwitch') === 'true');
  })();
})(window);