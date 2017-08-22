/**
 * Created by louiszhai on 17/8/22.
 */

function notification(message) {
  if (!('Notification' in window)) { // 判断浏览器是否支持Notification功能
    console.log('This browser does not support desktop notification');
  } else if (Notification.permission === "granted") { // 判断是否授予通知的权限
    new Notification(message); // 创建通知
    return true;
  } else if (Notification.permission !== 'denied') { // 首次向用户申请权限
    Notification.requestPermission(function (permission) { // 申请权限
      if (permission === "granted") { // 用户授予权限后, 弹出通知
        new Notification(message); // 创建通知
        return true;
      }
    });
  }
}