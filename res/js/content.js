(function() {
  var prefix = '[HTTP]:';
  var log = [
    prefix + '进入网络监听模式',
    prefix + '退出网络监听模式'
  ];
  Message.on('Listening', function(data, sender, cb){
    console.warn(log[0]);
  });
  Message.on('ListeningCancel', function(data, sender, cb){
    console.warn(log[1]);
  });
  window.addEventListener('beforeunload',function(){
    Message.send('beforeunload');
  });
  Message.send('pageInit');
})();