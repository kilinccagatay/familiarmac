import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Keep the full-resolution captured window, including its aspect ratio.
export function preparePreviewMagnification(widget, image, app) {
    widget.add_style_class_name('familiarmac-window-preview');
    widget._fmCreateMagnificationActor = (width, height) => {
        const tile=widget.child;
        const clone=new St.Widget({layout_manager:new Clutter.BinLayout(),reactive:false});
        const picture=new St.Widget({content:image.content,x_align:Clutter.ActorAlign.CENTER,y_align:Clutter.ActorAlign.CENTER});
        picture.set_size(width*image.width/Math.max(1,tile.width),height*image.height/Math.max(1,tile.height));
        clone.add_child(picture);
        const badge=app?.create_icon_texture(Math.ceil(width*.28/St.ThemeContext.get_for_stage(global.stage).scale_factor));
        if(badge){badge.x_align=Clutter.ActorAlign.END;badge.y_align=Clutter.ActorAlign.END;badge.set_size(width*.28,width*.28);clone.add_child(badge);}
        return clone;
    };
    Main.extensionManager.lookup('macbook-menu@local')?.stateObj?._dockMagnification?.track(widget);
}
