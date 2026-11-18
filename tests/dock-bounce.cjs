const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const emitter=()=>({signals:new Map(),connect(n,f){this.signals.set(n,f);return n;},disconnect(n){this.signals.delete(n);}});
let now=1000000,enabled=true;const appSystem=emitter(),layout=emitter();
class Settings {constructor(){Object.assign(this,emitter());} get_boolean(){return enabled;}}
const c={Gio:{Settings,SettingsSchemaSource:{get_default(){},new_from_directory:()=>({lookup(){}})}},GLib:{get_monotonic_time:()=>now,build_filenamev:a=>a.join('/'),get_user_data_dir:()=>'/tmp'},Clutter:{Timeline:class{connect(){}start(){this.running=true;}stop(){this.running=false;}}},St:{},Shell:{AppSystem:{get_default:()=>appSystem},AppState:{STARTING:1,STOPPED:0}},Main:{layoutManager:layout,uiGroup:{get_children:()=>[]}},global:{stage:{}}};
vm.runInNewContext(fs.readFileSync('extensions/macbook-menu@local/dockBounce.js','utf8').replace(/^import .*;$/gm,'').replace(/^export /gm,'')+';globalThis.Bounce=DockBounce;',c);
assert.equal(c.bounceOffset(0,100),0);assert.equal(c.bounceOffset(900,100),0);assert(Math.abs(c.bounceOffset(360,100)+42)<.00001);assert.equal(c.bounceOffset(800,100),0);
let mapped=false;const app={state:1,get_id:()=> 'test.desktop',get_windows:()=>mapped?[{skip_taskbar:false,minimized:false,is_override_redirect:()=>false,get_compositor_private:()=>({mapped:true})}]:[]};
const b=new c.Bounce();b.start(app);const first=b.pending.get('test.desktop');b.start(app);assert.equal(b.pending.get('test.desktop'),first,'Repeated clicks must not restart the timer');
mapped=true;b.update();assert.equal(b.pending.size,0);assert.equal(b.timeline,null);assert.equal(app.state,1,'Never modify startup state');
mapped=false;b.start(app);now+=16000000;b.update();assert.equal(b.pending.size,0,'Failed launches must time out');
enabled=false;b.start(app);assert.equal(b.pending.size,0,'System motion preference gates launch feedback');
enabled=true;b.start(app);app.state=0;appSystem.signals.get('app-state-changed')(appSystem,app);assert.equal(b.pending.size,0);b.update();
b.destroy();assert.equal(appSystem.signals.size,0);assert.equal(layout.signals.size,0);
console.log('Dock bounce: bounded launch feedback, mapped-window stop, repeat-click coalescing, failed startup, motion preference and cleanup PASS');
