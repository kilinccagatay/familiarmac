const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=p=>fs.readFileSync('extensions/macbook-menu@local/'+p,'utf8').replace(/^import .*;$/gm,'').replace(/export /g,'');
const names=Array.from({length:7},()=>({}));const month={};
const header=()=>({children:[],add_child(b){this.children.push(b)},remove_child(b){this.children=this.children.filter(x=>x!==b)}});
let selected;
const calendar={_backButton:{},_forwardButton:{},_topBox:header(),setDate(d){selected=d},_selectedDate:new Date(2026,10,16,12),_weekStart:1,_useWeekdate:false,_monthLabel:month,
 get_text_direction:()=>0,layout_manager:{get_child_at:c=>names[c]},_update(){month.text='november-region'},_buildHeader(){},_rebuildCalendar(){}};
const date={_dayLabel:{},_dateLabel:{},setDate(){this._dayLabel.text='måndag'}};
const oldUpdate=calendar._update,oldDate=date.setDate;
const ctx={Intl,Date,Gettext:{dgettext:(_domain,t)=>t},St:{BoxLayout:class{constructor(props){Object.assign(this,props);this.children=[]}add_child(a){this.children.push(a)}},Button:class{constructor(props){Object.assign(this,props)}connect(_s,fn){this.click=fn}destroy(){this.destroyed=true}}},GLib:{get_language_names_with_category:()=>['en_US.UTF-8']},Clutter:{ActorAlign:{CENTER:1,END:2},TextDirection:{RTL:1}}};
vm.runInNewContext(source('panelClock.js')+'\n'+source('calendarLanguage.js')+'\nglobalThis.C=CalendarLanguage',ctx);
const c=new ctx.C({_calendar:calendar,_date:date});date.setDate(new Date(2026,10,16,12));assert.equal(date._dayLabel.text,'Monday');assert.equal(month.text,'November 2026');assert.deepEqual(names.map(x=>x.text),['M','T','W','T','F','S','S']);
calendar._selectedDate=new Date(2026,11,1,12);calendar._update();assert.equal(month.text,'December 2026');const first=c.todayButton;first.click();assert.equal(selected.toDateString(),new Date().toDateString());
c.localize();assert.equal(calendar._topBox.children.length,2);
calendar._topBox=header();calendar._buildHeader();assert.notEqual(c.todayButton,first);assert.equal(calendar._topBox.children.length,2);
assert.deepEqual(calendar._topBox.children[1].children,[calendar._backButton,c.todayButton,calendar._forwardButton]);assert.equal(date._dayLabel.x_align,1);
const last=c.todayButton;c.destroy();assert.equal(last.destroyed,true);assert.equal(calendar._update,oldUpdate);assert.equal(date.setDate,oldDate);
console.log('Calendar uses UI language independently of Swedish regional dates, including month navigation PASS');
