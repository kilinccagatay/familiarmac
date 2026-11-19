// VM-only GNOME 46 prototype. Requires the opt-in Mutter API in patch-mutter.py.
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import {RoundedCornersEffect as LegacyEffect} from './rounded_corners_effect_legacy.js';

const NativeEffect = GObject.registerClass({GTypeName:'FamiliarMacNativeCorners'},class extends Clutter.Effect {
    constructor(){
        super();
        this.connect('notify::enabled',()=>this._sync());
    }
    vfunc_set_actor(actor){
        this._clear();
        super.vfunc_set_actor(actor);
    }
    _clear(){
        if(this._legacy){this._legacy.get_actor()?.remove_effect(this._legacy);this._legacy=null;}
        if(this._texture){
            try{this._texture.set_familiar_rounding(0,0,0,0,0,2);}catch(_){ }
            this._texture=null;
        }
    }
    _sync(){
        if(this._legacy){this._legacy.enabled=this.enabled;return;}
        if(!this._texture||!this._values)return;
        const v=this._values;
        this._texture.set_familiar_rounding(v[0],v[1],v[2],v[3],this.enabled?v[4]:0,v[5]);
    }
    updateUniforms(scale,config,windowBounds){
        const actor=this.get_actor();
        if(!actor)return;
        // Wayland buffer coordinates do not match the actor-space bounds.
        // Keep its established rendering path until native coordinates are validated.
        const window=actor.meta_window??actor.metaWindow;
        if(window?.get_client_type()===Meta.WindowClientType.WAYLAND){
            if(this._texture){this._texture.set_familiar_rounding(0,0,0,0,0,2);this._texture=null;}
            if(!this._legacy){this._legacy=new LegacyEffect();actor.add_effect_with_name('FamiliarMac Wayland corners',this._legacy);}
            this._legacy.enabled=this.enabled;
            this._legacy.updateUniforms(scale,config,windowBounds);
            return;
        }
        const texture=actor.get_texture();
        if(!texture)return;
        if(this._texture!==texture){this._clear();this._texture=texture;}
        const p=config.padding;
        const b=[windowBounds.x1+p.left*scale,windowBounds.y1+p.top*scale,
            windowBounds.x2-p.right*scale,windowBounds.y2-p.bottom*scale];
        let exponent=config.smoothing*10+2;
        let radius=config.borderRadius*scale*.5*exponent;
        const maxRadius=Math.max(0,Math.min(b[2]-b[0],b[3]-b[1])/2);
        if(radius>maxRadius){exponent*=maxRadius/radius;radius=maxRadius;}
        this._values=[...b,radius,Math.max(2,exponent)];
        this._sync();
    }
});
export const RoundedCornersEffect = typeof Meta.ShapedTexture.prototype.set_familiar_rounding==='function' ? NativeEffect : LegacyEffect;
