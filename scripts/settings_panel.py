"""Build a version-guarded, user-local Settings sidebar extension."""
from pathlib import Path
import shutil
import subprocess
import xml.etree.ElementTree as ET

def prepare(root, base, home, binary):
    source=root/'native/settings-panel.c'
    if not shutil.which('cc'):
        print('Dock & Window sidebar needs a C compiler; About remains available.')
        return ''
    tree=ET.fromstring(subprocess.check_output(['gresource','extract',str(binary),'/org/gnome/Settings/gtk/cc-window.ui']))
    panel=tree.find('.//object[@id="panel_list"]')
    split=tree.find('.//object[@id="split_view"]')
    if panel is None or panel.get('class')!='CcPanelList' or split is None or split.get('class')!='AdwNavigationSplitView':
        print('Unsupported Settings sidebar template; left unchanged.')
        return ''
    schema=home/'.local/share/gnome-shell/extensions/familiarmac-genie@local/schemas'
    if not (schema/'gschemas.compiled').exists(): return ''
    target=base/'settings-panel.so'
    temporary=target.with_suffix('.tmp.so')
    result=subprocess.run(['cc','-shared','-fPIC','-O2','-Wall','-Wextra',str(source),'-o',str(temporary),'-ldl',
        '-Wl,-l:libgtk-4.so.1','-Wl,-l:libadwaita-1.so.0','-Wl,-l:libgio-2.0.so.0','-Wl,-l:libgobject-2.0.so.0','-Wl,-l:libglib-2.0.so.0'],capture_output=True,text=True)
    if result.returncode:
        temporary.unlink(missing_ok=True)
        print('Dock & Window helper could not be built; native Settings retained: '+result.stderr)
        return ''
    temporary.replace(target)
    parent=next(e for e in tree.iter() if panel in list(e));parent.remove(panel)
    box=ET.SubElement(parent,'object',{'class':'GtkBox'})
    ET.SubElement(box,'property',name='orientation').text='vertical'
    ET.SubElement(box,'child').append(panel)
    sidebar=ET.SubElement(ET.SubElement(box,'child'),'object',{'class':'GtkListBox'})
    ET.SubElement(sidebar,'property',name='name').text='fm-dock-list'
    ET.SubElement(sidebar,'property',name='visible').text='False'
    ET.SubElement(ET.SubElement(sidebar,'style'),'class',name='navigation-sidebar')
    row=ET.SubElement(ET.SubElement(sidebar,'child'),'object',{'class':'GtkListBoxRow'})
    ET.SubElement(row,'property',name='name').text='fm-dock-row'
    content=ET.SubElement(ET.SubElement(row,'child'),'object',{'class':'GtkBox'})
    for key,value in [('spacing','12'),('margin-top','12'),('margin-bottom','12'),('margin-start','6'),('margin-end','6')]:
        ET.SubElement(content,'property',name=key).text=value
    icon=ET.SubElement(ET.SubElement(content,'child'),'object',{'class':'GtkImage'})
    ET.SubElement(icon,'property',name='icon-name').text='familiarmac-dock-window-symbolic'
    label=ET.SubElement(ET.SubElement(content,'child'),'object',{'class':'GtkLabel'})
    ET.SubElement(label,'property',name='label').text='Dock & Window'
    ET.SubElement(label,'property',name='xalign').text='0'
    ET.ElementTree(tree).write(base/'cc-window.ui',encoding='utf-8',xml_declaration=True)
    # Keep these beside the helper so About restore removes this entire integration.
    for name in ('settings-applications.py','mission_control_settings.py','menu_setup.py','dock-window.ui','release-update.py'):
        shutil.copy2(root/'scripts'/name,base/name)
    applications=home/'.local/share/applications'
    applications.mkdir(parents=True,exist_ok=True)
    # Match the GTK application ID so Shell shows a human-readable app name.
    command=str(base/'settings-applications.py').replace('\\','\\\\').replace('"','\\"')
    (applications/'org.familiarmac.MissionControlSettings.desktop').write_text(
        '[Desktop Entry]\nType=Application\nName=Settings\nIcon=org.gnome.Settings\n'
        f'Exec=/usr/bin/python3 "{command}" --mission-control\nNoDisplay=true\n')
    shutil.copytree(root/'assets/magic-mouse',base/'magic-mouse-assets',dirs_exist_ok=True)
    mouse_ui=(root/'scripts/magic-mouse.ui').read_text().replace('@ASSETS@',(base/'magic-mouse-assets').resolve().as_uri())
    (base/'magic-mouse.ui').write_text(mouse_ui)
    subprocess.run(['/usr/bin/python3',str(base/'settings-applications.py'),'--generate',str(base/'dock-page.ui')],check=True)
    import shlex
    q=shlex.quote
    return (f' if /usr/bin/python3 {q(str(base/"settings-applications.py"))} --generate {q(str(base/"dock-page.ui"))}; then\n'
        f'  export FAMILIARMAC_DOCK_UI={q(str(base/"dock-page.ui"))}\n'
        f'  export FAMILIARMAC_GENIE_SCHEMAS={q(str(schema))}\n'
        f'  export FAMILIARMAC_UPDATER={q(str(base/"release-update.py"))}\n'
        f'  export FAMILIARMAC_APP_RECHECK={q(str(base/"settings-applications.py"))}\n'
        f'  export LD_PRELOAD={q(str(target))}${{LD_PRELOAD:+:$LD_PRELOAD}}\n'
        f'  export G_RESOURCE_OVERLAYS="/org/gnome/Settings/gtk={base}:$G_RESOURCE_OVERLAYS"\n fi\n')
