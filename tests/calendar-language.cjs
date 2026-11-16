const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=p=>fs.readFileSync('extensions/macbook-menu@local/'+p,'utf8').replace(/^import .*;$/gm,'').replace(/export /g,'');
const names=Array.from({length:7},()=>({}));const month={};
const calendar={_selectedDate:new Date(2026,10,16,12),_weekStart:1,_useWeekdate:false,_monthLabel:month,
 get_text_direction:()=>0,layout_manager:{get_child_at:c=>names[c]},_update(){month.text='november-region'},_buildHeader(){},_rebuildCalendar(){}};
const date={_dayLabel:{},_dateLabel:{},setDate(){this._dayLabel.text='måndag'}};
const oldUpdate=calendar._update,oldDate=date.setDate;
const ctx={Intl,Date,GLib:{get_language_names_with_category:()=>['en_US.UTF-8']},Clutter:{TextDirection:{RTL:1}}};
vm.runInNewContext(source('panelClock.js')+'\n'+source('calendarLanguage.js')+'\nglobalThis.C=CalendarLanguage',ctx);
const c=new ctx.C({_calendar:calendar,_date:date});date.setDate(new Date(2026,10,16,12));assert.equal(date._dayLabel.text,'Monday');assert.equal(month.text,'November 2026');assert.deepEqual(names.map(x=>x.text),['M','T','W','T','F','S','S']);
calendar._selectedDate=new Date(2026,11,1,12);calendar._update();assert.equal(month.text,'December 2026');c.destroy();assert.equal(calendar._update,oldUpdate);assert.equal(date.setDate,oldDate);
console.log('Calendar uses UI language independently of Swedish regional dates, including month navigation PASS');
