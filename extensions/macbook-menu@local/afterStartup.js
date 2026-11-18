// Wait for the Shell's startup allocation/animation before altering overview
// layout and workspace policy. Cancel both stages if the extension is disabled.
export function afterStartup(layout, loop, initialize) {
    let signal=0,source=0,cancelled=false;
    const schedule=()=>{
        if(signal){layout.disconnect(signal);signal=0;}
        if(cancelled)return;
        source=loop.idle_add(loop.PRIORITY_DEFAULT_IDLE,()=>{
            source=0;
            if(!cancelled)initialize();
            return loop.SOURCE_REMOVE;
        });
    };
    if(layout._startingUp)signal=layout.connect('startup-complete',schedule);
    else schedule();
    return ()=>{cancelled=true;if(signal){layout.disconnect(signal);signal=0;}if(source){loop.source_remove(source);source=0;}};
}
