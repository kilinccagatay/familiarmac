const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const classes=new Set(),tray={bannerAlignment:1,_bannerBin:{add_style_class_name:n=>classes.add(n),remove_style_class_name:n=>classes.delete(n)}};
const ctx={Clutter:{ActorAlign:{END:2}},Main:{messageTray:tray}};
vm.runInNewContext(fs.readFileSync('extensions/macbook-menu@local/notificationBanner.js','utf8').replace(/^import .*;$/gm,'').replace('export class','class')+';globalThis.Controller=NotificationBanner',ctx);
const original=Object.keys(tray);const c=new ctx.Controller();
assert.equal(tray.bannerAlignment,2);assert(classes.has('fm-notification-banners'));assert.deepEqual(Object.keys(tray),original);
c.destroy();c.destroy();assert.equal(tray.bannerAlignment,1);assert.equal(classes.size,0);
ctx.Main.messageTray=null;new ctx.Controller().destroy();
console.log('Banner right alignment, native tray preservation and cleanup PASS');
