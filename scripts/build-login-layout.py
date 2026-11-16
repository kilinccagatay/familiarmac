#!/usr/bin/python3
"""Build a presentation-only GNOME 46 login resource overlay; fail on source drift."""
from pathlib import Path
import subprocess,sys,hashlib,json
lib=Path('/usr/lib/gnome-shell/libshell-14.so')
s=subprocess.check_output(['gresource','extract',str(lib),'/org/gnome/shell/gdm/loginDialog.js'],text=True)
def replace(old,new):
 global s
 if s.count(old)!=1:raise SystemExit('Unsupported login source; no installation performed: '+old[:70])
 s=s.replace(old,new)
names=Path(__file__).resolve().parents[1].joinpath('extensions/macbook-menu@local/panelClock.js').read_text().split('export function dateNameFormatters',1)[1].split('export function formatPanelDate',1)[0]
s='function dateNameFormatters'+names+'\n'+s
replace('        this._userWidget = new UserWidget.UserWidget(this.user);','        this._userWidget = new UserWidget.UserWidget(this.user, Clutter.Orientation.VERTICAL);')
replace('        parentActor.add_child(this);', '''        parentActor.add_child(this);

        // Only the GDM greeter has a second, large clock below the panel.
        // Keep accessibility/network/power controls and normal-session clocks intact.
        if (Main.sessionMode.isGreeter) {
            const panelClock = Main.panel.statusArea.dateMenu?.container;
            if (panelClock) {
                const wasVisible = panelClock.visible;
                const hidePanelClock = () => panelClock.hide();
                Main.sessionMode.connectObject('updated', hidePanelClock, this);
                hidePanelClock();
                this.connect('destroy', () => {
                    Main.sessionMode.disconnectObject(this);
                    panelClock.visible = wasVisible;
                });
            }
        }

        // Presentation only: GDM owns all authentication and user/session handling.
        this._macClock = new St.BoxLayout({vertical: true, style_class: 'macbook-login-clock'});
        this._macDate = new St.Label({x_align: Clutter.ActorAlign.CENTER});
        this._macTime = new St.Label({x_align: Clutter.ActorAlign.CENTER, style_class: 'macbook-login-time'});
        this._macClock.add_child(this._macDate);
        this._macClock.add_child(this._macTime);
        this.add_child(this._macClock);
        const names = dateNameFormatters(GLib.get_language_names_with_category('LC_MESSAGES'));
        const updateClock = () => {
            const now = GLib.DateTime.new_now_local();
            const day = new Date(Date.UTC(now.get_year(), now.get_month() - 1, now.get_day_of_month()));
            this._macDate.text = `${names.day.format(day)} ${now.get_day_of_month()} ${names.month.format(day)}`;
            this._macTime.text = now.format('%H:%M');
            return GLib.SOURCE_CONTINUE;
        };
        updateClock();
        const clockTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, updateClock);
        this.connect('destroy', () => GLib.source_remove(clockTimer));
        Main.layoutManager.keyboardBox.connectObject(
            'notify::height', () => this.queue_relayout(),
            'notify::visible', () => this.queue_relayout(), this);''')
old='''        actorBox.y1 = Math.floor(centerY - natHeight / 2);
        actorBox.x2 = actorBox.x1 + natWidth;
        actorBox.y2 = actorBox.y1 + natHeight;

        return actorBox;
    }

    vfunc_allocate'''
new='''        // Keep the complete password prompt visible, including errors and hints.
        const height = dialogBox.y2 - dialogBox.y1;
        const keyboardHeight = Main.keyboard.visible ? Main.layoutManager.keyboardBox.height : 0;
        const bottom = dialogBox.y2 - keyboardHeight - Math.min(48, height * 0.06);
        actorBox.y1 = Math.max(dialogBox.y1, Math.floor(bottom - natHeight));
        actorBox.x2 = actorBox.x1 + natWidth;
        actorBox.y2 = actorBox.y1 + natHeight;

        return actorBox;
    }

    vfunc_allocate'''
replace(old,new)
a=s.index('        } else if (userSelectionAllocation) {\n            // Grow the user list')
b=s.index('\n        // Finally hand out the allocations',a)
s=s[:a]+'        }\n'+s[b:]
replace('        // Finally hand out the allocations','''        // Date and clock occupy the upper part of the screen.
        const [, , clockWidth, clockHeight] = this._macClock.get_preferred_size();
        const clockBox = new Clutter.ActorBox();
        clockBox.x1 = dialogBox.x1 + Math.floor((dialogWidth - clockWidth) / 2);
        clockBox.x2 = clockBox.x1 + clockWidth;
        clockBox.y1 = dialogBox.y1 + Math.floor(dialogHeight * 0.10);
        clockBox.y2 = clockBox.y1 + clockHeight;
        const promptTop = authPromptAllocation?.y1 ?? userSelectionAllocation?.y1 ?? dialogBox.y2;
        this._macClock.visible = promptTop > clockBox.y2 + 24;
        this._macClock.allocate(clockBox);

        // Finally hand out the allocations''')
out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
(out/'loginDialog.js').write_text(s)
(out/'source.json').write_text(json.dumps({'library':str(lib),'sha256':hashlib.file_digest(lib.open('rb'),'sha256').hexdigest()}))
print('Built login presentation overlay; authentication methods unchanged.')
