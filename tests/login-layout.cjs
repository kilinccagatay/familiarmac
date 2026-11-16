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
