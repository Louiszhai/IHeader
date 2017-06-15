(function() {
  var UNINIT = 0, // 页面不支持缓存
      INITED = 1, // 页面支持缓存，但缓存未打开
      ACTIVE = 2, // 页面缓存已激活
      types = JSON.parse(localStorage.getItem('types')) || [ 'main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'object', 'xmlhttprequest', 'other']; // 请求类型
  
  /* 获取filter */
  function getFilter(tabId){
    return {
      urls: ['<all_urls>'],
      tabId: tabId,
      types: types
    };
  }

  /* 处理插件图标状态 */
  var PageActionIcon = (function(){
    var pageAction = chrome.pageAction,
        icons = {},
        tips = {};
    icons[INITED] = 'res/images/lightning_green.png';
    icons[ACTIVE] = 'res/images/lightning_red.png';

    tips[INITED] = Text('iconTips');
    tips[ACTIVE] = Text('iconHideTips');

    function PageActionIcon(tabId){
      this.tabId  = tabId;
      this.status = UNINIT;
      pageAction.show(tabId);
    }
    PageActionIcon.prototype.init = function(){
      if(this.status !== INITED){
        this.status = INITED;
        this.setIcon();
      }
      return this;
    };
    PageActionIcon.prototype.active = function(){
      if(this.status !== ACTIVE){
        this.status = ACTIVE;
        this.setIcon();
      }
      return this;
    };
    PageActionIcon.prototype.hide = function(){
      if(this.status !== UNINIT){
        this.status = UNINIT;
        pageAction.hide(this.tabId);
      }
      return this;
    };
    PageActionIcon.prototype.setIcon = function(){
      pageAction.setIcon({
        tabId : this.tabId,
        path  : icons[this.status]
      });
      pageAction.setTitle({
        tabId : this.tabId,
        title : tips[this.status]
      });
      return this;
    };
    PageActionIcon.prototype.restore = function(){
      this.setIcon();
      pageAction.show(this.tabId);
      return this;
    };
    return PageActionIcon;
  })();

  /* 处理Tab页信息 */
  var PageViews = (function(){
    var tabs = {};
    
    function PageViews(tabId, url){
      var instance = tabs[tabId];
      if(instance){
        return instance;
      }
      
      if(!(this instanceof PageViews)){
        return new PageViews(tabId);
      }
      
      tabs[tabId] = this;
      this.tabId = tabId;
      this.url    = url;
      this.init();
    }
    PageViews.get = function(tabId){
      return tabs[tabId];
    };
    PageViews.remove = function(tabId){
      if(tabs[tabId]){
        delete tabs[tabId];
      }
    };
    PageViews.prototype.init = function(){
      if(!this.icon){
        this.icon = new PageActionIcon(this.tabId).init();
        /* 初次init不需要恢复icon */
        this.needNextRestore = false;
      }
      return this;
    };
    PageViews.prototype.switchActive = function(){
      var icon = this.icon;
      if(icon){
        var status = icon.status;
        var tabId = this.tabId;
        switch(status){
          case ACTIVE:
            icon.init();
            PageListeners.remove(tabId);
            Message.send(tabId, 'cacheListeningCancel');
            break;
          default:
            icon.active();
            PageListeners(tabId);
            Message.send(tabId, 'cacheListening');
        }
      }
      return this;
    };
    PageViews.prototype.restore = function(){
      if(this.needNextRestore){
        this.icon && this.icon.restore();
      }else{
        this.needNextRestore = true;
      }
      return this;
    };
    PageViews.prototype.remove = function(){
      PageViews.remove(this.tabId);
      return this;
    };
    return PageViews;
  })();
  
  /* 处理Tab页监听器 */
  var PageListeners = (function(){
    var allListeners = {};

    function PageListeners(tabId){
      if(allListeners[tabId]){
        return allListeners[tabId];
      }

      /* 返回合适的实例 */
      if(!(this instanceof PageListeners)){
        return new PageListeners(tabId);
      }
      
      /* 初始化变量 */
      var _this = this;
      var filter = getFilter(tabId);

      /* 捕获responseHeaders */
      //var l0 = new Listener('onHeadersReceived', filter, ['blocking', 'responseHeaders'], function(details){
      //  console.log('onHeadersReceived:', details);
      //  var responseHeaders = details.responseHeaders;
      //  for(var i = 0; i< responseHeaders.length; i++){
      //    //if(responseHeaders[i].name === 'x-frame-options'){
      //    //  responseHeaders.splice(i, 1);
      //    //}
      //    if(responseHeaders[i].name === 'Cache-Control'){
      //      responseHeaders[i].value = 'max-age=315360000';
      //    }
      //  }
      //  responseHeaders.push({name: 'author', value: 'louis'});
      //  //responseHeaders.push({name: 'Access-Control-Allow-Origin', value: '*'});
      //  return {responseHeaders: responseHeaders};
      //});

      /* 捕获requestHeaders */
      var l1 = new Listener('onSendHeaders', filter, ['requestHeaders'], function(details){
        // console.log('onSendHeaders:', details);
        _this.saveMesage('request', details);
      });

      /* 捕获responseHeaders */
      var l2 = new Listener('onResponseStarted', filter, ['responseHeaders'], function(details){
        // console.log('onResponseStarted:', details);
        _this.saveMesage('response', details);
      });

      /* 捕获 Completed responseHeaders */
      var l3 = new Listener('onCompleted', filter, ['responseHeaders'], function(details){
        // console.log('onCompleted:', details);
        _this.saveMesage('complete', details);
      });

      allListeners[tabId] = this;
      this.tabId = tabId;
      this.listeners = {
        //'onHeadersReceived': l0,
        'onSendHeaders': l1,
        'onResponseStarted': l2,
        'onCompleted': l3
      };
      this.messages = {};
      
      console.log('tabId=' + tabId + ' listener on');
    }
    PageListeners.has = function(tabId){
      return !!allListeners.hasOwnProperty(tabId);
    };
    PageListeners.get = function(tabId){
      return allListeners[tabId];
    };
    PageListeners.getAll = function(){
      return allListeners;
    };
    PageListeners.remove = function(tabId){
      var pageListeners = allListeners[tabId];
      if(pageListeners){
        var listeners = pageListeners.listeners,
            keys = Object.keys(pageListeners.listeners);
            
        keys.length && keys.forEach(function(key){
          listeners[key].remove();
        });
        
        delete allListeners[tabId];
        console.log('tabId=' + tabId + ' listener off');
      }
    };
    PageListeners.prototype.remove = function(){
      PageListener.remove(this.tabId);
      return this;
    };
    PageListeners.prototype.saveMesage = function(type, message){
      var requestId = message.requestId;
      if(this.messages[requestId] instanceof Object){
        this.messages[requestId][type] = message;
      }else{
        var obj = {};
        obj[type] = message;
        this.messages[requestId] = obj;
      }
      return this;
    };
    return PageListeners;
  })();

  /* 独立的监听器 */
  var Listener = (function(){
    var webRequest = chrome.webRequest;

    function Listener(type, filter, extraInfoSpec, callback){
      this.type = type;
      this.filter = filter;
      this.extraInfoSpec = extraInfoSpec;
      this.callback = callback;
      this.init();
    }
    Listener.prototype.init = function(){
      webRequest[this.type].addListener(
        this.callback,
        this.filter,
        this.extraInfoSpec
      );
      return this;
    };
    Listener.prototype.remove = function(){
      webRequest[this.type].removeListener(this.callback);
      return this;
    };
    Listener.prototype.reload = function(){
      this.remove().init();
      return this;
    };
    return Listener;
  })();
  
  /* 监听pageAction的点击事件--设置default_popup后失效 */
  // chrome.pageAction.onClicked.addListener(function(tab) {
  //   PageViews(tab.id, tab.url).switchActive();
  // });
  
  /* 监听content script发送的消息 */
  // Message.on('cacheInit', function(data, sender, cb){
  //   PageViews(sender.tab.id, sender.url);
  //   console.log('cacheInit');
  // });
  // Message.on('cacheUnInit', function(data, sender, cb){
  //   PageViews(sender.tab.id, sender.url).icon.hide();
  // });
  /* 页面卸载前处理 */
  Message.on('beforeunload', function(data, sender, cb){
    var tabId = sender.tab.id;
    clearMessages(tabId);
    //PageViews(tabId).restore().isClearMessages = true;
    PageViews(tabId).isClearMessages = true;
  });

  /* 监听tab关闭的事件，移除关闭页面实例 */
  chrome.tabs.onRemoved.addListener(function(tabId, removeInfo){
    clearTab(tabId);
  });
  /* 监听tab刷新的事件 */
  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo){
    if(changeInfo.status === 'loading'){
      /* 每次刷新页面，icon都会回到初始状态并且不可点击，此处初始化PageView实例 或者 恢复icon之前的状态 */
      var pageView = PageViews(tabId).restore();
      // 刷新到监听器触发期间, 有可能部分请求已经发送了, 可能会误删一些请求信息, 故注释之
      // if(!pageView.isClearMessages){
      //   clearMessage(tabId);
      // }
      // pageView.isClearMessages = false;
    }
  });
  
  /* 监听快捷键 */
  chrome.commands.onCommand.addListener(function(command) {
    if (command == "toggle_status") {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        var tab = tabs[0];
        tab && PageViews(tab.id, tab.url).switchActive();
      });
    }
  });
  
  /* 安装提示 */
  chrome.runtime.onInstalled.addListener(function(data){
    if(data.reason == 'install' || data.reason == 'update'){
      chrome.tabs.query({}, function(tabs){
        tabs.forEach(function(tab){
          PageViews(tab.id).restore();
        });
      });
      console.log('[扩展]:', data.reason);
    }
  });

  /* 回收Tab */
  var clearTab = function(tabId){
    PageViews.remove(tabId);
    PageListeners.remove(tabId);
  };

  /* 更新右键菜单 */
  function updateContextMenus(){
    chrome.contextMenus.removeAll();

    chrome.contextMenus.create({
      title: '切换Header监听模式',
      id: 'contextMenu-0',
      contexts: ['all']
    });
    
    chrome.contextMenus.onClicked.addListener(function (menu, tab){
      PageViews(tab.id, tab.url).switchActive();
    });
  }

  window.addEventListener('load', function(){
    updateContextMenus();
  });

  /* 清除该Tab的所有历史消息 */
  window.clearMessages = function(tabId, isForce){
    var pageView = PageViews.get(tabId);
    if(pageView){
      (pageView.preserveLog && !isForce) || PageListeners.has(tabId) && (PageListeners(tabId).messages = {});
    }
  };

  /* 获取是否保存之前的log */
  window.getPreserveLog = function(tabId){
    var pageView = PageViews.get(tabId);
    if(pageView){
      return pageView.preserveLog;
    }
  };

  /* 设置是否保存之前的log */
  window.setPreserveLog = function(tabId, bool){
    var pageView = PageViews.get(tabId);
    pageView && (pageView.preserveLog = bool);
  };

  
  /* 获取当前监听的请求类型 */
  window.getTypes = function(){
    return types;
  };

  /* 设置监听的请求类型 */
  window.setTypes = function(type, needOrNot){
    var included = ~types.indexOf(type); /* 是否包含 */
    if(needOrNot && !included){
      types.push(type);
    }else if(!needOrNot && included){
      types.splice(~included, 1);
    }
    localStorage.setItem('types', JSON.stringify(types));
  };

  /* 获取该Tab页的所有请求消息 */
  window.getMessages = function(tabId){
    return PageListeners.has(tabId) ? PageListeners(tabId).messages : null;
  };

  /* 获取监听的状态 */
  window.getPageListenerStatus = function(tabId){
    return PageListeners.has(tabId);
  };

  /* 获取所有的页面监听器 */
  window.getAllPageListeners = function(){
    return PageListeners.getAll();
  };

  window.reloadAllListeners = function(){
    var allListeners = PageListeners.getAll(),
        i,
        j,
        pageListeners;
    for(i in allListeners){
      if(allListeners.hasOwnProperty(i)){
        pageListeners = allListeners[i].listeners;
        for(j in pageListeners){
          if(pageListeners.hasOwnProperty(j)){
            pageListeners[j].reload();
          }
        }
      }
    }
  };

  /* 修改请求头 */
  /* remove headerMap === { url: {key: false } */
  /* modify headerMap === { url: {key: value } */
  var webRequestEvent = {
    requestHeaders: 'onBeforeSendHeaders',
    responseHeaders: 'onHeadersReceived'
  };

  /* set modify header */
  window.setModifyHeadersListener = function(type, tabId, headerMap){
    var listeners = PageListeners(tabId).listeners,
        eventType = webRequestEvent[type],
        listener = listeners[eventType],
        mapName = 'changelist';

    if(listener instanceof Object){
      var originHeaderMap = listener[mapName];
      if(originHeaderMap){
        var key;
        for(key in headerMap){
          if(headerMap.hasOwnProperty(key)){
            var urlObject = originHeaderMap[key];
            if(urlObject){
              coverProperty(urlObject, headerMap[key]);
              if(isEmptyObject(urlObject)){
                delete originHeaderMap[key];
              }
            }else{
              originHeaderMap[key] = headerMap[key];
            }
          }
        }
      }else{
        listener[mapName] = headerMap;
      }
    }else{
      var l = setHeadersListener(eventType, type, tabId);
      /* 初始化modifyHeaders */
      l[mapName] = headerMap;
      /* 加入listeners列表 */
      listeners[eventType] = l;
    }
  };

  /* 设置 Headers listener */
  function setHeadersListener(eventType, type, tabId){
    var l = new Listener(eventType, getFilter(tabId), ['blocking', type], function(details){
      var changelist = l.changelist,
          headers    = details[type],
          obj        = {};

      if(changelist && details.url in changelist){ // 后续加入正则匹配
        var headerMap    = changelist[details.url],
            keys       = Object.keys(headerMap),
            addHeaders = [],
            removeList = keys.filter(function(key){
              var keyValue = headerMap[key];
              if(keyValue === true) {
                return true;
              }else {
                addHeaders.push({name: key, value: keyValue});
              }
            });

        removeList.length && removeList.forEach(function(key){
          var index,
              hasItem = headers.some(function(header, i){
                // TODO 多个同名的response header, 每次删除的都是最后一个
                if(header.name === key){
                  index = i;
                  return true;
                }
              });
          if(hasItem){
            headers.splice(index, 1);
          }else{
            /* 清除无效的修改规则 */
            delete headerMap[key];
            if(isEmptyObject(headerMap)){
              delete changelist[details.url];
            }
          }
        });
        [].push.apply(headers, addHeaders);
      }
      obj[type] = headers;
      return obj;
    });
    return l;
  }

  /* 是否空对象 */
  function isEmptyObject(obj){
    var key;
    for(key in obj){
      if(obj.hasOwnProperty(key)){
        return false;
      }
    }
    return true;
  }

  /* copy & cover origin property */
  function coverProperty(targetObj, obj){
    for(var key in obj){
      if(obj.hasOwnProperty(key)){
        var value = obj[key];
        if(value === false){
          delete targetObj[key];
        }
      }
    }
  }
})();
