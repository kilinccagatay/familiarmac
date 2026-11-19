// Run with gjs -m tests/login-unicode.js GENERATED_LOGIN_DIALOG.
// Use GI's actual gunichar conversion instead of numeric Node test fixtures.
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
const [,bytes]=Gio.File.new_for_path(ARGV[0]).load_contents(null);
const source=new TextDecoder().decode(bytes);
const method=source.match(/    _macTypeToLogin\(event\) \{[\s\S]*?\n    \}/)[0];
const Main={sessionMode:{isGreeter:true}};
const Clutter={EventType:{KEY_PRESS:1},ModifierType:{CONTROL_MASK:4,MOD1_MASK:8,SUPER_MASK:64},EVENT_PROPAGATE:0,EVENT_STOP:1};
const item={contains:()=>false};
const global={stage:{get_key_focus:()=>item}};
const login=eval('({'+method+'})');
let text='';const secret={visible:true};
Object.assign(login,{_userSelectionBox:{visible:true},_userList:{_items:{user:item}},
 _authPrompt:{_passwordEntry:secret,_updateEntry(){this._entry=secret;},addCharacter(c){text+=c;}},
 _onUserListActivated(){this._user={};},_showPrompt(){}});
for(const first of ['0','1','9',' ','.','ğ','A']){
 login._user=null;login._macTypingLogin=false;login._authPrompt._entry={visible:true};text='';
 const c=GLib.utf8_get_char(first);
 if(typeof c!=='string')throw Error('Unexpected GI gunichar representation');
 const result=login._macTypeToLogin({type:()=>1,get_state:()=>0,get_key_unicode:()=>c});
 if(result!==1||text!==first)throw Error('Printable first-character handling failed');
}
print('Native GJS/GLib gunichar: printable first characters preserved PASS');
