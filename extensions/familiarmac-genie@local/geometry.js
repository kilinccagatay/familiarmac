export function smooth(t) { t = Math.max(0, Math.min(1, t)); return t*t*t*(t*(t*6-15)+10); }
export function point(u, v, progress, source, target) {
    if (![u,v,progress,source.width,source.height,target.x,target.y,target.width,target.height].every(Number.isFinite) || source.width<=0 || source.height<=0 || target.width<=0 || target.height<=0)
        return [u*source.width, v*source.height];
    const p=Math.max(0,Math.min(1,progress));
    // The lower edge narrows first; then the whole sheet flows into its preview.
    const neck=smooth((p-.22*(1-v))/.65);
    const travel=smooth((p-.22)/.78);
    const left=target.x*neck;
    const width=source.width+(target.width-source.width)*neck;
    return [left+u*width, v*source.height*(1-travel)+(target.y+v*target.height)*travel];
}

export function motionAllowed(userEnabled, systemAnimations) { return userEnabled && systemAnimations; }

// Each horizontal edge is linear in u and each side is monotonic in v.
// The four corners therefore bound every vertex throughout the animation.
export function bounds(progress, source, target) {
    const points=[[0,0],[1,0],[0,1],[1,1]].map(([u,v])=>point(u,v,progress,source,target));
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    const x=Math.min(...xs),y=Math.min(...ys);
    return {x,y,width:Math.max(...xs)-x,height:Math.max(...ys)-y};
}
