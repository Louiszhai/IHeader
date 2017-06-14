(function(ns){
  "use strict";
  
  /**
  * 插件与插件间、插件与插件页面脚本间数据通信
  **/
  var Message = (function(){
    var EventCallbacks = {};
    var apiAllowMethods = ['apiNotAllowed'];

    var _fmtMethods = function(methods){
      var _methods = {};
      Array.prototype.slice.call(methods, 0).forEach(function(method){
        if(Array.isArray(method)){
          method.forEach(function(method){
            _methods[method] = true;
          });
        } else {
          _methods[method] = true;
        }
      });
      return Object.keys(_methods);
    }

    var MsgError = function(message){
      if(!(this instanceof MsgError)){
        return new MsgError(message);
      }
      this.name = 'MsgError';
      this.message = message || 'Message Error';
    }
    MsgError.prototype = Object.create(Error.prototype);
    MsgError.prototype.constructor = MsgError;

    var msgObj = {
      Error : MsgError,
      send : function(tabIdOrExtensionId, type, data, cb){
        var sendTo,
          argv=[];
        if(/^\d+$/.test(tabIdOrExtensionId) && chrome.tabs){
          sendTo = 'tabs';
          argv.push(tabIdOrExtensionId);
        } else if(/^[a-z]{32}$/.test(tabIdOrExtensionId)){
          sendTo = 'runtime';
          argv.push(tabIdOrExtensionId);
        } else {
          sendTo = 'runtime';
          cb   = data;
          data = type;
          type = tabIdOrExtensionId;
        }
        if(typeof data == 'function'){
          cb = data,
          data = null;
        }
        return new Promise(function(resolve, reject){
          argv = argv.concat([{
            type : type,
            data : data
          }, function(retData){
            var err;
            if(retData instanceof MsgError || (retData && typeof retData == 'object' && retData.name == 'MsgError')){
              err = MsgError(retData.message);
            }
            err = err || chrome.runtime.lastError;
            if(err){
              reject(err);
              cb && cb(err);
            } else {
              resolve(retData);
              cb && cb(null, retData);
            }
          }]);
          chrome[sendTo].sendMessage.apply(chrome[sendTo], argv);
        }).catch(function(e){
          // 暂时不在页面输出错误日志
          // console.log(e);
        });
      },
      on : function(type, func){
        if(!EventCallbacks[type]){
          EventCallbacks[type] = [];
        }
        EventCallbacks[type].push(func);
      },
      addApiAllowMethods : function(methods){
        methods = _fmtMethods(arguments);
        methods.forEach(function(method){
          if(apiAllowMethods.indexOf(method) === -1){
            apiAllowMethods.push(method);
          }
        });
        return apiAllowMethods;
      },
      rmApiAllowMethods : function(methods){
        methods = _fmtMethods(arguments);
        methods.forEach(function(method){
          var idx = apiAllowMethods.indexOf(method);
          if(idx !== -1){
            apiAllowMethods.splice(idx, 1);
          }
        });
        return apiAllowMethods; 
      }
    }

    function onMessage(data, sender, sendResponse){
      var type = data.type;
      if(type && EventCallbacks[type]){
        var ret = false,
          cbs = EventCallbacks[type],
          l   = cbs.length - 1,
          cbDatas = {
            str : ''
          };
        cbs.forEach(function(cb, idx){
          ret = cb(data.data, sender, function(data){
            if(data instanceof MsgError || (data && typeof data == 'object' && data.name == 'MsgError')){
              sendResponse(MsgError(data.message));
              return;
            }
            if(!data || typeof data !== 'object'){
              cbDatas.str = data;
            } else {
              for(var key in data){
                cbDatas[key] = data[key];
              }
            }
            if(idx === l){
              var keys = Object.keys(cbDatas);
              if(keys.length == 1 && keys[0] == 'str'){
                cbDatas = cbDatas.str;
              }
              sendResponse(cbDatas);
            }
            
          }) || ret;
        });
        return ret;
      }
    }

    chrome.runtime.onMessage.addListener(onMessage);
    if(chrome.runtime.onMessageExternal){
      chrome.runtime.onMessageExternal.addListener(function(data, sender, sendResponse){
        var type = data && data.type;
        if(apiAllowMethods.indexOf(type) == -1){
          console.log('--------------');
          msgObj.send(sender.id, 'apiNotAllowed', {
            'method' : type || null
          }).catch(function(e){});
          sendResponse(MsgError('This api method is not allowed.'));
          return;
        }
        return onMessage(data, sender, sendResponse);
      });
    }

    return msgObj;
  })();

  /**
  * 页面间数据通讯
  **/
  var WindowMessage = (function(){
    var cbs = {};

    var winMsgObj = {
      send : function(target, type, data, allowOrigin){
        if(typeof target == 'string'){
          allowOrigin = data;
          data = type;
          type = target;
          target = window;
        }
        allowOrigin = allowOrigin || '*';
        target.postMessage({
          type : type,
          data : data
        }, allowOrigin);
        return this;
      },
      receive : function(type, cb){
        if(!cbs[type]){
          cbs[type] = [];
        }
        cbs[type].push(cb);
        return this;
      }
    }
    window.addEventListener("message", function(event){
      if(!event.data || !event.data.type){
        return;
      }
      var type = event.data.type,
        data = event.data.data;
      if(cbs[type]){
        cbs[type].forEach(function(cb){
          cb(data, event);
        });
      }
    }, false);
    return winMsgObj;
  })();

  /*解析模板中多语言*/
  document.addEventListener('DOMContentLoaded', function(){
    Array.prototype.forEach.call(document.querySelectorAll('[data-itext]'), function(el){
      el.innerText = chrome.i18n.getMessage(el.getAttribute('data-itext'));
    });
  }); 

  ns.Message = Message;
  ns.WindowMessage = WindowMessage;
  ns.Text = chrome.i18n.getMessage; 
  /*url字符串解析*/
  ns.parseUrl = function(url){
    var a = document.createElement('a'),
      ret = {};
    a.href = url;
    Object.keys(window.location).forEach(function(key){
      if(window.location.hasOwnProperty(key) && typeof window.location[key] === 'string'){
        ret[key] = a[key];
      }
    });
    return ret;
  } 
})(this);