const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const emitter=()=>({signals:new Map(),connect(n,f){this.signals.set(n,f);return n;},disconnect(n){this.signals.delete(n);}});
const jobs=new Map();let source=0;
let now=1000000,enabled=true;const appSystem=emitter(),layout=emitter();
class Settings {constructor(){Object.assign(this,emitter());} get_boolean(){return enabled;}}
const c={Gio:{Settings,SettingsSchemaSource:{get_default(){},new_from_directory:()=>({lookup(){}})}},GLib:{PRIORITY_DEFAULT_IDLE:200,SOURCE_REMOVE:false,idle_add(_p,fn){jobs.set(++source,fn);return source;},source_remove(id){jobs.delete(id);},get_monotonic_time:()=>now,build_filenamev:a=>a.join('/'),get_user_data_dir:()=>'/tmp'},Clutter:{Timeline:class{connect(){}start(){this.running=true;}stop(){this.running=false;}}},St:{},Shell:{AppSystem:{get_default:()=>appSystem},AppState:{STARTING:1,STOPPED:0}},Main:{layoutManager:layout,uiGroup:{get_children:()=>[]}},global:{stage:{}}};
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

// A drag begins with a left press but never emits St.Button::clicked.
const icon=Object.assign(emitter(),{app,icon:{icon:{}},animateLaunch(){},get_children:()=>[]});
c.Main.uiGroup.get_children=()=>[{name:'dashtodockContainer',get_children:()=>[icon]}];
const clicks=new c.Bounce();
assert(!icon.signals.has('button-press-event'),'Press alone must not register a pending launch');
assert.equal(clicks.pending.size,0,'Dragging/removing an unopened app must not keep it in the Dock');
icon.signals.get('clicked')(icon,3);assert.equal(clicks.pending.size,0,'Context menu is not a launch');
icon.signals.get('clicked')(icon,1);assert.equal(clicks.pending.size,1,'Completed left click retains launch feedback');
clicks.cancel();icon.animateLaunch();assert.equal(clicks.pending.size,1,'Native launch feedback still works');
clicks.destroy();assert.equal(icon.signals.size,0,'Click handler is disconnected on teardown');
console.log('Dock launch intent: drag/unpin and context menus excluded, completed clicks and native launch retained PASS');

function flush(){for(const [id,fn] of [...jobs]){jobs.delete(id);fn();}}
c.Main.uiGroup.get_children=()=>[];
const starts=new c.Bounce();app.state=1;
appSystem.signals.get('app-state-changed')(appSystem,app);
// Token bookkeeping is populated after the synchronous STARTING signal.
c.global[Symbol.for('familiarmac.trayActivation')]={hasApp:id=>id==='test.desktop'};
flush();assert.equal(starts.pending.size,0,'Tray Quit/activation must not create a launch icon');
starts.start(app);assert.equal(starts.pending.size,1,'Explicit Dock launch remains supported');starts.cancel();
delete c.global[Symbol.for('familiarmac.trayActivation')];
appSystem.signals.get('app-state-changed')(appSystem,app);flush();
assert.equal(starts.pending.size,1,'Ordinary non-tray startup still bounces');starts.cancel();
appSystem.signals.get('app-state-changed')(appSystem,app);app.state=0;flush();
assert.equal(starts.pending.size,0,'Stopped app cannot start a delayed bounce');
app.state=1;appSystem.signals.get('app-state-changed')(appSystem,app);starts.destroy();assert.equal(jobs.size,0);
console.log('Tray-generated startup excluded; real launches, stop races and idle cleanup PASS');
