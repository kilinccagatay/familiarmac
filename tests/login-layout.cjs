const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(process.argv[2],'utf8');
const method=source.match(/    _getCenterActorAllocation\(dialogBox, actor\) \{[\s\S]*?\n    \}/)[0];
const context={Clutter:{ActorBox:class {}},Main:{keyboard:{visible:false},layoutManager:{keyboardBox:{height:300}}}};
vm.runInNewContext('globalThis.layout={'+method+'};',context);
for(const height of [768,900,1800]){
 const box=context.layout._getCenterActorAllocation({x1:0,y1:0,x2:1440,y2:height},{get_preferred_size:()=>[0,0,300,200]});
 assert.equal(box.x1,570);assert.ok(box.y1>height/2);assert.ok(box.y2<=height);
}
context.Main.keyboard.visible=true;
const box=context.layout._getCenterActorAllocation({x1:0,y1:0,x2:1440,y2:900},{get_preferred_size:()=>[0,0,300,200]});
assert.ok(box.y2<=600);
console.log('Login layout: centered horizontally, lower prompt, keyboard clearance PASS');

assert.ok(source.includes("GLib.get_language_names_with_category('LC_MESSAGES')"));
assert.ok(!source.includes("this._macDate.text = now.format('%a"));
const formatterSource=source.slice(0,source.indexOf('import '));
const clockContext={Intl};vm.runInNewContext(formatterSource,clockContext);
const names=clockContext.dateNameFormatters(['en_US.UTF-8']);
assert.equal(names.day.format(new Date('2026-11-16T12:00:00Z')),'Mon');
assert.equal(names.month.format(new Date('2026-11-16T12:00:00Z')),'Nov');
console.log('Login date: UI language formatters, independent of regional LC_TIME PASS');
const typingMethod=source.match(/    _macTypeToLogin\(event\) \{[\s\S]*?\n    \}/)[0];
let focus,chars=[],activated=0;
const item={contains:()=>false};focus=item;
const password={visible:true};
const loginContext={Main:{sessionMode:{isGreeter:true}},Clutter:{EventType:{KEY_PRESS:1},ModifierType:{CONTROL_MASK:4,MOD1_MASK:8,SUPER_MASK:64},EVENT_PROPAGATE:0,EVENT_STOP:1},global:{stage:{get_key_focus:()=>focus}}};
vm.runInNewContext('globalThis.login={'+typingMethod+'};',loginContext);
const login=loginContext.login;
Object.assign(login,{_userSelectionBox:{visible:true},_userList:{_items:{user:item}},_authPrompt:{_entry:password,_passwordEntry:password,addCharacter:c=>chars.push(c)},_onUserListActivated(){activated++;this._user={};}});
const key=(code,mods=0)=>({type:()=>1,get_state:()=>mods,get_key_unicode:()=>code});
for(const code of [0,13,9,27,127])assert.equal(login._macTypeToLogin(key(code)),0);
assert.equal(activated,0);
for(const char of ['A','!','@','ğ',' '])assert.equal(login._macTypeToLogin(key(char.codePointAt(0),char==='@'?128:1)),1);
assert.equal(activated,1);assert.deepEqual(chars,Array.from('A!@ğ ').map(c=>c.codePointAt(0)));
assert.equal(login._macTypeToLogin(key(97,4)),0,'Control shortcuts are not password characters');
login._macTypingLogin=false;login._user=null;focus=null;login._userList._items.other={contains:()=>false};
assert.equal(login._macTypeToLogin(key(97)),0,'Never choose an arbitrary user');
console.log('Type to login: first character, rapid typing, symbols, Unicode, modifiers and account selection PASS');
