/**
 * Created by louiszhai on 17/7/14.
 */

(function(window){
  var proxyMap = {};
  var pac = function(url, host){
    if (host in proxyMap) {
      return 'PROXY ' + proxyMap[host];
    } else {
      return 'SYSTEM';
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
    localStorage.setItem('proxyMap', JSON.stringify(proxyMap));
  };
  //window.setProxy = function(map){
  //  chrome.proxy.settings.clear({ scope: 'regular' }, callback);
  //  updateProxy(map);
  //};
  //window.removeProxy = function(keys){
  //  keys.forEach(function(key){
  //    delete proxyMap[key];
  //  });
  //  updateProxy();
  //};
  window.getProxyMap = function(){
    return proxyMap;
  };
  window.setProxyMap = function(map){
    proxyMap = map;
  };

  var map = JSON.parse(localStorage.getItem('proxyMap') || '{}');
  updateProxy(map);
})(window);