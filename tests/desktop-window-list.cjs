const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('overrides/desktop-icons/earlyWindowList.js','utf8').replace('export class','class')+';this.Early=EarlyDesktopWindowList',ctx);
class Signals {constructor(){this.s=new Map();this.id=0;}connect(name,fn){this.s.set(++this.id,{name,fn});return this.id;}disconnect(id){this.s.delete(id);}emit(name,arg){for(const {name:n,fn}of [...this.s.values()])if(n===name)fn(this,arg);}}
class Window extends Signals {constructor(title,owned=true){super();this.title=title;this.owned=owned;this.hidden=0;}get_title(){return this.title;}}
const display=new Signals(),wm=new Signals();let client={query_window_belongs_to:w=>w.owned,hide_from_window_list:w=>w.hidden++};
const early=new ctx.Early(display,wm,()=>client);
const desktop=new Window('Desktop Icons 1');display.emit('window-created',desktop);assert.equal(desktop.hidden,1); // before map
const late=new Window(null);display.emit('window-created',late);late.title='Desktop Icons 2';late.emit('notify::title');assert.equal(late.hidden,1);assert.equal(late.s.size,0);
for(const window of [new Window('Rename'),new Window('Desktop Icons 1',false)]){display.emit('window-created',window);wm.emit('map',{get_meta_window:()=>window});assert.equal(window.hidden,0);assert.equal(window.s.size,0);}
const waiting=new Window('Desktop Icons 3');const saved=client;client=null;display.emit('window-created',waiting);client=saved;early.refresh();assert.equal(waiting.hidden,1);
const gone=new Window(null);display.emit('window-created',gone);gone.emit('unmanaged');assert.equal(gone.s.size,0);
const pending=new Window(null);display.emit('window-created',pending);early.destroy();assert.equal(pending.s.size,0);assert.equal(display.s.size,0);assert.equal(wm.s.size,0);
console.log('Early desktop hiding: owned surfaces only, late title/client, dialogs, unmanaged and cleanup PASS');
