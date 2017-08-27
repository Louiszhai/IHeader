(function() {
  var UNINIT   = 0, // 扩展未初始化
      INITED   = 1, // 扩展已初始化，但未激活
      ACTIVE   = 2, // 扩展已激活
      types    = JSON.parse(localStorage.getItem('types')), // 请求类型
      allTypes = [
        'main_frame',
        'sub_frame',
        'stylesheet',
        'script',
        'image',
        'font',
        'object',
        'xmlhttprequest',
        'ping',
        'csp_report',
        'media',
        'websocket',
        'other'
      ];
  !types && (types = allTypes) && localStorage.setItem('types', JSON.stringify(types));

  /* 获取filter */
  function getFilter(tabId){
    var filter = {
      urls: ['<all_urls>'],
      types: types
    };
    tabId !== 'all' && (filter.tabId = tabId);
    return filter;
  }

  /* 处理扩展图标状态 */
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

  /* 处理标签页状态 */
  var TabControler = (function(){
    var tabs = {};
    
    function TabControler(tabId, url){
      var instance = tabs[tabId];
      if(instance){
        return instance;
      }
      
      if(!(this instanceof TabControler)){
        return new TabControler(tabId);
      }
      
      tabs[tabId] = this;
      this.tabId = tabId;
      this.url    = url;
      this.init();
    }
    TabControler.get = function(tabId){
      return tabs[tabId];
    };
    TabControler.remove = function(tabId){
      if(tabs[tabId]){
        delete tabs[tabId];
        ListenerControler.remove(tabId);
      }
    };
    TabControler.prototype.init = function(){
      if(!this.icon){
        this.icon = new PageActionIcon(this.tabId).init();
        /* 初次init不需要恢复icon */
        this.needNextRestore = false;
      }
      return this;
    };
    TabControler.prototype.switchActive = function(){
      var icon = this.icon;
      if(icon){
        var status = icon.status;
        var tabId = this.tabId;
        switch(status){
          case ACTIVE:
            icon.init();
            ListenerControler.remove(tabId);
            Message.send(tabId, 'ListeningCancel');
            break;
          default:
            icon.active();
            ListenerControler(tabId);
            Message.send(tabId, 'Listening');
        }
      }
      return this;
    };
    TabControler.prototype.restore = function(){
      if(this.needNextRestore){
        this.icon && this.icon.restore();
      }else{
        this.needNextRestore = true;
      }
      return this;
    };
    TabControler.prototype.remove = function(){
      TabControler.remove(this.tabId);
      return this;
    };
    return TabControler;
  })();

  /* 监听器控制器 */
  var ListenerControler = (function(){
    /* 所有的监听器控制器列表 */
    var allListeners = {};

    function ListenerControler(tabId){
      /* 如有就返回已有的实例 */
      if(allListeners[tabId]){
        return allListeners[tabId];
      }

      /* 强制以构造器方式调用 */
      if(!(this instanceof ListenerControler)){
        return new ListenerControler(tabId);
      }
      
      /* 初始化变量 */
      var _this = this;
      var filter = getFilter(tabId);

      allListeners[tabId] = this;
      this.tabId = tabId;
      this.messages = {};

      if(tabId !== 'all'){
        /* 捕获requestHeaders */
        var l1 = new Listener('onSendHeaders', filter, ['requestHeaders'], function(details){
          _this.saveMesage('request', details);
        });

        /* 捕获responseHeaders */
        var l2 = new Listener('onResponseStarted', filter, ['responseHeaders'], function(details){
          _this.saveMesage('response', details);
        });

        /* 捕获 Completed Details */
        var l3 = new Listener('onCompleted', filter, ['responseHeaders'], function(details){
          _this.saveMesage('complete', details);
        });

        this.listeners = {
          'onSendHeaders': l1,
          'onResponseStarted': l2,
          'onCompleted': l3
        };
        console.log('tabId=' + tabId + ' listener on');
      }else{
        this.listeners = {};
        console.log('Global listener on');
      }
    }
    ListenerControler.has = function(tabId){
      return !!allListeners.hasOwnProperty(tabId);
    };
    ListenerControler.get = function(tabId){
      return allListeners[tabId];
    };
    ListenerControler.getAll = function(){
      return allListeners;
    };
    ListenerControler.remove = function(tabId){
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
    ListenerControler.prototype.remove = function(){
      ListenerControler.remove(this.tabId);
      return this;
    };
    ListenerControler.prototype.saveMesage = function(type, message){
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
    return ListenerControler;
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
  //   TabControler(tab.id, tab.url).switchActive();
  // });
  
  /* 监听content script发送的消息 */
  // Message.on('cacheInit', function(data, sender, cb){
  //   TabControler(sender.tab.id, sender.url);
  //   console.log('cacheInit');
  // });
  // Message.on('cacheUnInit', function(data, sender, cb){
  //   TabControler(sender.tab.id, sender.url).icon.hide();
  // });
  /* 页面卸载前处理 */
  Message.on('beforeunload', function(data, sender, cb){
    var tabId = sender.tab.id;
    clearMessages(tabId);
    //TabControler(tabId).restore().isClearMessages = true;
    TabControler(tabId).isClearMessages = true;
  });

  /* 监听tab关闭的事件，移除关闭页面实例 */
  chrome.tabs.onRemoved.addListener(function(tabId, removeInfo){
    TabControler.remove(tabId);
  });
  /* 监听tab刷新的事件 */
  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo){
    if(changeInfo.status === 'loading'){
      /* 每次刷新页面，icon都会回到初始状态并且不可点击，此处初始化TabControler实例 或者 恢复icon之前的状态 */
      var currentTab = TabControler(tabId).restore();
      // 刷新到监听器触发期间, 有可能部分请求已经发送了, 可能会误删一些请求信息, 故注释之
      // if(!currentTab.isClearMessages){
      //   clearMessage(tabId);
      // }
      // currentTab.isClearMessages = false;
    }
  });
  
  /* 监听快捷键 */
  chrome.commands.onCommand.addListener(function(command) {
    if (command == "toggle_status") {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        var tab = tabs[0];
        tab && TabControler(tab.id, tab.url).switchActive();
      });
    }
  });
  
  /* 安装提示 */
  chrome.runtime.onInstalled.addListener(function(data){
    if(data.reason == 'install' || data.reason == 'update'){
      chrome.tabs.query({}, function(tabs){
        tabs.forEach(function(tab){
          TabControler(tab.id).restore();
        });
      });
      // 重启全局监听器
      var globalListeners = JSON.parse(localStorage.getItem('globalListener') || '[]');
      globalListeners.forEach(function(listener){
        window.setModifyHeadersListener(listener.type, 'all', listener.changelist, true);
      });
      // 动态载入Notification js文件
      setTimeout(function(){
        var partMessage = data.reason == 'install' ? '安装成功' : '更新成功';
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          var tab = tabs[0];
          if (!/chrome:\/\//.test(tab.url)){
            chrome.tabs.executeScript(tab.id, {file: 'res/js/notification.js'}, function(){
              chrome.tabs.executeScript(tab.id, {code: 'notification("IHeader扩展程序'+ partMessage +'")'}, function(log){
                log[0] && console.log('[Notification]: 成功弹出通知');
              });
            });
          } else {
            console.log('[Notification]: Cannot access a chrome:// URL');
          }
        });
      },1000);
      console.log('[扩展]:', data.reason);
    }
  });

  /* 更新右键菜单 */
  function updateContextMenus(){
    chrome.contextMenus.removeAll();

    chrome.contextMenus.create({
      title: '切换Header监听模式',
      id: 'contextMenu-0',
      contexts: ['all']
    });
    
    chrome.contextMenus.onClicked.addListener(function (menu, tab){
      TabControler(tab.id, tab.url).switchActive();
    });
  }

  window.addEventListener('load', function(){
    updateContextMenus();
  });

  /* 清除该Tab的所有历史消息 */
  window.clearMessages = function(tabId, isForce){
    var currentTab = TabControler.get(tabId);
    if(currentTab){
      (currentTab.preserveLog && !isForce) || ListenerControler.has(tabId) && (ListenerControler(tabId).messages = {});
    }
  };

  /* 获取是否保存之前的log */
  window.getPreserveLog = function(tabId){
    var currentTab = TabControler.get(tabId);
    if(currentTab){
      return currentTab.preserveLog;
    }
  };

  /* 设置是否保存之前的log */
  window.setPreserveLog = function(tabId, bool){
    var currentTab = TabControler.get(tabId);
    currentTab && (currentTab.preserveLog = bool);
  };

  /* 获取所有支持的请求类型 */
  window.getAllTypes = function(){
    return allTypes;
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
    return ListenerControler.has(tabId) ? ListenerControler(tabId).messages : null;
  };

  /* 获取监听的状态 */
  window.getPageListenerStatus = function(tabId){
    return ListenerControler.has(tabId);
  };

  /* 获取所有的页面监听器 */
  window.getAllPageListeners = function(){
    return ListenerControler.getAll();
  };

  window.reloadAllListeners = function(){
    var allListeners = ListenerControler.getAll(),
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

  window.syncStore4Listener = function(listeners){
    var list = [];
    Object.keys(listeners).forEach(function(key){
      var o = {},
          listener = listeners[key];
      o.changelist = listener.changelist;
      o.type = listener.extraInfoSpec[1];
      list.push(o);
    });
    localStorage.setItem('globalListener', JSON.stringify(list));
  };

  /* 修改请求头 */
  /* remove headerMap === { url: {key: false } */
  /* modify headerMap === { url: {key: value } */
  var webRequestEvent = {
    requestHeaders: 'onBeforeSendHeaders',
    responseHeaders: 'onHeadersReceived'
  };

  /* set modify header */
  window.setModifyHeadersListener = function(type, tabId, headerMap, ignoreStore){
    var listeners = ListenerControler(tabId).listeners,
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
      /* init modifyHeaders */
      l[mapName] = headerMap;
      /* add it to listeners list */
      listeners[eventType] = l;
    }

    /* 存储全局监听器的内容 */
    !ignoreStore && tabId === 'all' && window.syncStore4Listener(listeners);
  };

  /* set Headers listener */
  function setHeadersListener(eventType, type, tabId){
    var l = new Listener(eventType, getFilter(tabId), ['blocking', type], function(details){
      var changelist = l.changelist,
          headers    = details[type],
          url        = details.url,
          obj        = {},
          hasRule    = changelist && (url in changelist || Object.keys(changelist).some(
                         function(v) {
                           return ~url.indexOf(v) && (url = v);
                       }));

      if(hasRule){
        var headerMap  = changelist[url],
            keys       = Object.keys(headerMap),
            addHeaders = [],
            removeList = keys.filter(function(key){
                           var keyValue = headerMap[key];
                           return keyValue === true || (addHeaders.push({name: key, value: keyValue}), false);
                         });

        removeList.length && removeList.forEach(function(key){
          headers.some(function(header, i){
            // TODO 多个同名的response header, 每次删除的都是最后一个
            return header.name === key && headers.splice(i, 1);
          });
        });
        [].push.apply(headers, addHeaders);
      }
      obj[type] = headers;
      return obj;
    });
    return l;
  }

  /* is empty object */
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
        } else {
          targetObj[key] = value;
        }
      }
    }
  }
})();
