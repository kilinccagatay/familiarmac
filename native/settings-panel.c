/* User-scoped Settings integration. Only public GTK/Adwaita/GIO functions;
 * no CcWindow struct offsets or package binary patches. Loaded by a hash-guarded
 * wrapper and inert without the matching sidebar resource marker. */
#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
typedef void *P;
typedef unsigned long UL;
extern const char *g_type_name_from_instance(P), *gtk_widget_get_name(P);
extern P gtk_widget_get_first_child(P),gtk_widget_get_next_sibling(P);
extern P g_object_ref(P),g_object_get_data(P,const char*);
extern void g_object_unref(P),g_object_set_data_full(P,const char*,P,void(*)(P));
extern UL g_signal_connect_data(P,const char*,P,P,P,int);
extern unsigned g_idle_add(int(*)(P),P);
extern P gtk_builder_new(void),gtk_builder_get_object(P,const char*);
extern unsigned gtk_builder_add_from_file(P,const char*,P*);
extern void g_error_free(P),g_free(P);
extern P adw_navigation_split_view_get_content(P);
extern void adw_navigation_split_view_set_content(P,P),adw_navigation_split_view_set_show_content(P,int);
extern void gtk_list_box_unselect_all(P),gtk_list_box_select_row(P,P),gtk_widget_set_sensitive(P,int),gtk_widget_set_visible(P,int);
extern void adw_preferences_row_set_title(P,const char*),adw_action_row_set_subtitle(P,const char*);
extern P g_settings_schema_source_get_default(void),g_settings_schema_source_new_from_directory(const char*,P,int,P*),g_settings_schema_source_lookup(P,const char*,int),g_settings_new_full(P,P,const char*),g_settings_new(const char*);
extern int g_settings_get_boolean(P,const char*),g_settings_set_boolean(P,const char*,int);
extern void g_object_set(P,const char*,...),g_object_get(P,const char*,...),gtk_window_set_transient_for(P,P),gtk_window_destroy(P);
extern void g_settings_schema_unref(P),g_settings_schema_source_unref(P),g_settings_bind(P,const char*,P,const char*,unsigned);
extern P g_subprocess_newv(const char*const*,int,P*);
extern void g_subprocess_communicate_utf8_async(P,const char*,P,P,P);
extern int g_subprocess_communicate_utf8_finish(P,P,char**,char**,P*),g_subprocess_get_successful(P);

extern int gtk_widget_get_mapped(P);
extern P gtk_window_get_application(P),g_simple_action_new(const char*,P);
extern void gtk_window_present(P),g_action_map_add_action(P,P),g_action_map_remove_action(P,const char*);
typedef struct {P window,app,split,list,row,native_list,page,previous,genie,desktop,dock,dock_size,dock_zoom,toggle,motion,dialog,update_row;int changing,syncing,startup;} State;
static P find(P root,const char *type,const char *name) {
 if(!root)return NULL;
 if((!type||!strcmp(g_type_name_from_instance(root),type))&&(!name||!strcmp(gtk_widget_get_name(root),name)))return root;
 for(P p=gtk_widget_get_first_child(root);p;p=gtk_widget_get_next_sibling(p)){P hit=find(p,type,name);if(hit)return hit;}
 return NULL;
}
/* Preserve the native list's row model and header callback. The custom list
 * is a header between Appearance and the following native row, never a fake
 * CcPanelList row with missing private metadata. */
extern const char*gtk_image_get_icon_name(P);
extern P gtk_css_provider_new(void),gdk_display_get_default(void);
extern void gtk_css_provider_load_from_data(P,const char*,long),gtk_style_context_add_provider_for_display(P,P,unsigned),gtk_widget_set_name(P,const char*);
extern P gtk_widget_get_parent(P),gtk_box_new(int,int),gtk_list_box_row_get_header(P);
extern void gtk_box_remove(P,P),gtk_box_append(P,P),gtk_list_box_row_set_header(P,P),gtk_list_box_invalidate_headers(P);
typedef struct {P list,data;void(*func)(P,P,P);void(*destroy)(P);} Header;
static void header_free(P data){Header*h=data;if(h->destroy)h->destroy(h->data);free(h);}
static void header_dispatch(P row,P before,P data){
 Header*h=data;h->func(row,before,h->data);
 P sidebar=g_object_get_data(h->list,"fm-sidebar-header");
 P icon=before?find(before,"GtkImage",NULL):NULL;
 const char*name=icon?gtk_image_get_icon_name(icon):NULL;
 if(!sidebar||!name||strcmp(name,"org.gnome.Settings-appearance-symbolic"))return;
 P old=gtk_list_box_row_get_header(row);if(old)g_object_ref(old);
 gtk_list_box_row_set_header(row,NULL);
 P box=g_object_get_data(h->list,"fm-header-box");
 if(!box){box=gtk_box_new(1,0);gtk_widget_set_name(box,"fm-dock-header");g_object_set_data_full(h->list,"fm-header-box",g_object_ref(box),g_object_unref);}
 P child=gtk_widget_get_first_child(box);
 while(child){P next=gtk_widget_get_next_sibling(child);gtk_box_remove(box,child);child=next;}
 gtk_box_append(box,sidebar);
 if(old){gtk_box_append(box,old);g_object_unref(old);}
 gtk_list_box_row_set_header(row,box);
}
void gtk_list_box_set_header_func(P list,void(*func)(P,P,P),P data,void(*destroy)(P)){
 static void(*original)(P,void(*)(P,P,P),P,void(*)(P));
 if(!original)original=dlsym(RTLD_NEXT,"gtk_list_box_set_header_func");
 if(!func){original(list,func,data,destroy);return;}
 Header*h=calloc(1,sizeof(*h));h->list=list;h->func=func;h->data=data;h->destroy=destroy;
 original(list,header_dispatch,h,header_free);
}
static void content_changed(P obj,P spec,State *s) {
 (void)obj;(void)spec;
 if(s->changing||adw_navigation_split_view_get_content(s->split)==s->page)return;
 gtk_list_box_unselect_all(s->list);
 if(s->previous){g_object_unref(s->previous);s->previous=NULL;}
}
static int open_requested(P window);
static void check_updates(P row);
static void show_native(P list,const char *id,const char *parent,State *s) {
 (void)list;(void)id;(void)parent;
 if(s->startup){s->startup=0;g_idle_add(open_requested,g_object_ref(s->window));return;}
 /* CcWindow's same-panel fast path doesn't replace split-view content. */
 if(adw_navigation_split_view_get_content(s->split)==s->page&&s->previous){
  P previous=g_object_ref(s->previous);adw_navigation_split_view_set_content(s->split,previous);g_object_unref(previous);
 }
}
static void show_dock(P list,P row,State *s) {
 (void)list;if(row!=s->row)return;
 check_updates(s->window);
 P current=adw_navigation_split_view_get_content(s->split);
 if(current!=s->page){
  if(s->previous)g_object_unref(s->previous);
  s->previous=current?g_object_ref(current):NULL;
  s->changing=1;adw_navigation_split_view_set_content(s->split,s->page);s->changing=0;
 }
 gtk_list_box_unselect_all(s->native_list);gtk_list_box_select_row(s->list,s->row);
 adw_navigation_split_view_set_show_content(s->split,1);
}
static void activate_dock(P action,P parameter,State*s){(void)action;(void)parameter;show_dock(s->list,s->row,s);gtk_window_present(s->window);}
static void first_map(P widget,State*s){(void)widget;activate_dock(NULL,NULL,s);}
static int open_requested(P window){State*s=g_object_get_data(window,"familiarmac-dock-panel");if(s)activate_dock(NULL,NULL,s);g_object_unref(window);return 0;}
static int closing(P window,State *s){(void)window;show_native(NULL,NULL,NULL,s);return 0;}
static void free_state(P ptr){State*s=ptr;g_action_map_remove_action(s->app,"familiarmac-dock");g_object_unref(s->app);if(s->previous)g_object_unref(s->previous);gtk_window_destroy(s->dialog);g_object_unref(s->dialog);g_object_unref(s->page);g_object_unref(s->genie);g_object_unref(s->desktop);if(s->dock)g_object_unref(s->dock);free(s);}
static void configure_apps(P button,P unused){
 (void)button;(void)unused;
 const char*worker=getenv("FAMILIARMAC_APP_RECHECK");if(!worker)return;
 const char*argv[]={"/usr/bin/python3",worker,"--configure",NULL};P error=NULL;
 P process=g_subprocess_newv(argv,0,&error);
 if(process)g_object_unref(process);
 if(error)g_error_free(error);
}
static void configure_mission(P button,P unused){
 (void)button;(void)unused;
 const char*worker=getenv("FAMILIARMAC_APP_RECHECK");if(!worker)return;
 const char*argv[]={"/usr/bin/python3",worker,"--mission-control",NULL};P error=NULL;
 P process=g_subprocess_newv(argv,0,&error);
 if(process)g_object_unref(process);
 if(error)g_error_free(error);
}
#include "settings-updates.h"
extern int g_settings_get_int(P,const char*),g_settings_set_int(P,const char*,int);
static void dock_size_sync(P settings,const char*key,State*s){
 (void)settings;(void)key;s->syncing=1;
 g_object_set(s->dock_size,"value",(g_settings_get_int(s->dock,"dash-max-icon-size")-24)*100.0/48,NULL);s->syncing=0;
}
static void dock_size_changed(P adjustment,P spec,State*s){
 (void)spec;if(s->syncing)return;double value=0;g_object_get(adjustment,"value",&value,NULL);
 g_settings_set_int(s->dock,"dash-max-icon-size",24+(int)(value*48/100+0.5));
}
extern double g_settings_get_double(P,const char*);
extern int g_settings_set_double(P,const char*,double);
extern void gtk_scale_add_mark(P,double,int,const char*);
static void dock_zoom_sync(P settings,const char*key,State*s){
 (void)settings;(void)key;if(s->syncing)return;
 double value=g_settings_get_boolean(s->genie,"dock-magnification")?
  20+(g_settings_get_double(s->genie,"dock-magnification-scale")-1.1)*80/0.9:0;
 s->syncing=1;g_object_set(s->dock_zoom,"value",value,NULL);s->syncing=0;
}
static void dock_zoom_changed(P adjustment,P spec,State*s){
 (void)spec;if(s->syncing)return;double value=0;g_object_get(adjustment,"value",&value,NULL);
 s->syncing=1;
 if(value>0)g_settings_set_double(s->genie,"dock-magnification-scale",1.1+(value<20?0:(value-20))*0.9/80);
 g_settings_set_boolean(s->genie,"dock-magnification",value>0);
 s->syncing=0;
}
static void dock_hide_changed(P row,P spec,State*s){
 (void)spec;int active=0;g_object_get(row,"active",&active,NULL);
 if(active){
  g_settings_set_boolean(s->dock,"require-pressure-to-show",0);
  g_settings_set_double(s->dock,"show-delay",0.0);
  g_settings_set_double(s->dock,"hide-delay",0.15);
  g_settings_set_double(s->dock,"animation-time",0.28);
 }
 g_settings_set_boolean(s->dock,"intellihide",0);
 g_settings_set_boolean(s->dock,"autohide",active);
 g_settings_set_boolean(s->dock,"dock-fixed",!active);
}
static void motion_changed(P settings,const char*key,State*s){
 (void)settings;(void)key;
 int enabled=g_settings_get_boolean(s->desktop,"enable-animations");
 s->syncing=1;g_object_set(s->toggle,"active",enabled&&g_settings_get_boolean(s->genie,"animate"),NULL);s->syncing=0;
 adw_action_row_set_subtitle(s->motion,enabled?"System animations are enabled.":"System animations are disabled. Enabling Genie will ask for confirmation.");
}
static void motion_response(P dialog,const char*response,State*s){
 (void)dialog;
 if(!strcmp(response,"enable")){
  g_settings_set_boolean(s->desktop,"enable-animations",1);
  g_settings_set_boolean(s->genie,"animate",1);
 }
 motion_changed(NULL,NULL,s);
}
static void toggle_changed(P toggle,P spec,State*s){
 (void)spec;if(s->syncing)return;
 int enabled=0;g_object_get(toggle,"active",&enabled,NULL);
 if(enabled&&!g_settings_get_boolean(s->desktop,"enable-animations")){
  motion_changed(NULL,NULL,s);gtk_window_present(s->dialog);return;
 }
 g_settings_set_boolean(s->genie,"animate",enabled);
}
static int attach(P window){
 P sidebar=find(window,"GtkListBox","fm-dock-list"),row=find(window,NULL,"fm-dock-row"),split=find(window,"AdwNavigationSplitView",NULL),panel=find(window,"CcPanelList",NULL);
 P native=panel?find(panel,"GtkListBox",NULL):NULL;
 const char*file=getenv("FAMILIARMAC_DOCK_UI"),*schema_dir=getenv("FAMILIARMAC_GENIE_SCHEMAS");
 if(!sidebar||!row||!split||!native||!file||!schema_dir)goto done;
 P error=NULL,source=g_settings_schema_source_new_from_directory(schema_dir,g_settings_schema_source_get_default(),0,&error);
 if(!source){if(error)g_error_free(error);goto done;}
 P schema=g_settings_schema_source_lookup(source,"org.gnome.shell.extensions.familiarmac-genie",0);g_settings_schema_source_unref(source);
 if(!schema)goto done;
 P builder=gtk_builder_new();
 if(!gtk_builder_add_from_file(builder,file,&error)){if(error)g_error_free(error);g_object_unref(builder);g_settings_schema_unref(schema);goto done;}
 P dialog=gtk_builder_get_object(builder,"motion_confirmation");
 P page=gtk_builder_get_object(builder,"dock_page"),toggle=gtk_builder_get_object(builder,"genie_switch"),reduce=gtk_builder_get_object(builder,"reduce_motion");
 if(!page||!toggle||!reduce||!dialog){g_object_unref(builder);g_settings_schema_unref(schema);goto done;}
 State*s=calloc(1,sizeof(*s));s->window=window;s->app=g_object_ref(gtk_window_get_application(window));s->split=split;s->list=sidebar;s->row=row;s->native_list=native;s->page=g_object_ref(page);
 s->genie=g_settings_new_full(schema,NULL,NULL);g_settings_schema_unref(schema);s->desktop=g_settings_new("org.gnome.desktop.interface");
 P launch_animation=gtk_builder_get_object(builder,"dock_launch_animation");
 if(launch_animation)g_settings_bind(s->genie,"dock-launch-animation",launch_animation,"active",0);
 s->toggle=toggle;s->motion=reduce;s->dialog=g_object_ref(dialog);
 P dock_schema=g_settings_schema_source_lookup(g_settings_schema_source_get_default(),"org.gnome.shell.extensions.zorin-dash",1);
 if(dock_schema){
  s->dock=g_settings_new_full(dock_schema,NULL,NULL);g_settings_schema_unref(dock_schema);
  P hide=gtk_builder_get_object(builder,"dock_autohide");
  s->dock_size=gtk_builder_get_object(builder,"dock_size");
  dock_size_sync(NULL,NULL,s);
  g_signal_connect_data(s->dock,"changed::dash-max-icon-size",dock_size_sync,s,NULL,0);
  g_signal_connect_data(s->dock_size,"notify::value",dock_size_changed,s,NULL,0);
  g_object_set(hide,"active",g_settings_get_boolean(s->dock,"autohide")&&!g_settings_get_boolean(s->dock,"dock-fixed"),NULL);
  g_signal_connect_data(hide,"notify::active",dock_hide_changed,s,NULL,0);
 }
 /* GtkScale marks are native stop values: pointer drags gently snap at them. */
 P size_scale=gtk_builder_get_object(builder,"dock_size_scale");
 gtk_scale_add_mark(size_scale,0,3,"Small");
 gtk_scale_add_mark(size_scale,50,3,"<span alpha='55%'>•</span>");
 gtk_scale_add_mark(size_scale,100,3,"Large");
 P zoom_scale=gtk_builder_get_object(builder,"dock_zoom_scale");
 gtk_scale_add_mark(zoom_scale,0,3,"Off");
 gtk_scale_add_mark(zoom_scale,20,3,"Small");
 gtk_scale_add_mark(zoom_scale,100,3,"Large");
 s->dock_zoom=gtk_builder_get_object(builder,"dock_zoom");dock_zoom_sync(NULL,NULL,s);
 g_signal_connect_data(s->dock_zoom,"notify::value",dock_zoom_changed,s,NULL,0);
 g_signal_connect_data(s->genie,"changed::dock-magnification",dock_zoom_sync,s,NULL,0);
 g_signal_connect_data(s->genie,"changed::dock-magnification-scale",dock_zoom_sync,s,NULL,0);
 gtk_window_set_transient_for(dialog,window);
 motion_changed(NULL,NULL,s);
 g_signal_connect_data(s->desktop,"changed::enable-animations",motion_changed,s,NULL,0);
 g_signal_connect_data(s->genie,"changed::animate",motion_changed,s,NULL,0);
 g_signal_connect_data(toggle,"notify::active",toggle_changed,s,NULL,0);
 g_signal_connect_data(dialog,"response",motion_response,s,NULL,0);
 g_signal_connect_data(sidebar,"row-activated",show_dock,s,NULL,0);
 g_signal_connect_data(split,"notify::content",content_changed,s,NULL,0);
 g_signal_connect_data(panel,"show-panel",show_native,s,NULL,1); /* after native handler */
 g_signal_connect_data(window,"close-request",closing,s,NULL,0);
 P action=g_simple_action_new("familiarmac-dock",(P)"s");
 g_signal_connect_data(action,"activate",activate_dock,s,NULL,0);g_action_map_add_action(s->app,action);g_object_unref(action);
 P css=gtk_css_provider_new();
 gtk_css_provider_load_from_data(css,"#fm-dock-header, #fm-dock-list { padding: 0; margin: 0; background: transparent; }",-1);
 gtk_style_context_add_provider_for_display(gdk_display_get_default(),css,800);g_object_unref(css);
 g_object_set_data_full(native,"fm-sidebar-header",g_object_ref(sidebar),g_object_unref);
 P sidebar_parent=gtk_widget_get_parent(sidebar);
 if(sidebar_parent&&!strcmp(g_type_name_from_instance(sidebar_parent),"GtkBox"))gtk_box_remove(sidebar_parent,sidebar);
 gtk_list_box_invalidate_headers(native);
 gtk_widget_set_visible(sidebar,1);
 if(getenv("FAMILIARMAC_OPEN_DOCK")){
  s->startup=1;
  if(gtk_widget_get_mapped(window))activate_dock(NULL,NULL,s);
  else g_signal_connect_data(window,"map",first_map,s,NULL,1);
 }
 updates_attach(window,builder,page);
 P mission=find(page,"GtkButton","fm-configure-mission");
 if(mission)g_signal_connect_data(mission,"clicked",configure_mission,NULL,NULL,0);
 P configure=find(page,"GtkButton","fm-configure-apps");
 if(configure)g_signal_connect_data(configure,"clicked",configure_apps,NULL,NULL,0);
g_object_set_data_full(window,"familiarmac-dock-panel",s,free_state);g_object_unref(builder);
 fprintf(stderr,"FamiliarMac Dock & Window sidebar attached\n");
 done:g_object_unref(window);return 0;
}
/* Radio visibility belongs to its native Settings panel, even when powered off. */
extern P adw_preferences_group_new(void),adw_switch_row_new(void),adw_clamp_new(void);
extern void adw_preferences_group_add(P,P),adw_clamp_set_child(P,P),adw_clamp_set_maximum_size(P,int),adw_toolbar_view_add_bottom_bar(P,P);
static int attach_radio_visibility(P panel){
 const char*type=g_type_name_from_instance(panel);
 const int bluetooth=!strcmp(type,"CcBluetoothPanel");
 P toolbar=find(panel,"AdwToolbarView",NULL);
 const char*directory=getenv("FAMILIARMAC_GENIE_SCHEMAS");
 if(!toolbar||!directory||g_object_get_data(panel,"fm-radio-visibility"))goto done;
 P error=NULL,source=g_settings_schema_source_new_from_directory(directory,g_settings_schema_source_get_default(),0,&error);
 if(!source){if(error)g_error_free(error);goto done;}
 P schema=g_settings_schema_source_lookup(source,"org.gnome.shell.extensions.familiarmac-genie",0);
 g_settings_schema_source_unref(source);if(!schema)goto done;
 P settings=g_settings_new_full(schema,NULL,NULL);g_settings_schema_unref(schema);
 P group=adw_preferences_group_new(),row=adw_switch_row_new(),clamp=adw_clamp_new();
 adw_preferences_row_set_title(row,bluetooth?"Always show Bluetooth icon":"Show Wi-Fi icon in menu bar");
 adw_action_row_set_subtitle(row,"Show the connection control in the top panel.");
 adw_preferences_group_add(group,row);adw_clamp_set_child(clamp,group);adw_clamp_set_maximum_size(clamp,600);
 g_object_set(clamp,"margin-start",24,"margin-end",24,"margin-top",12,"margin-bottom",18,NULL);
 adw_toolbar_view_add_bottom_bar(toolbar,clamp);
 g_settings_bind(settings,bluetooth?"bluetooth-panel-icon":"wifi-panel-icon",row,"active",0);
 g_object_unref(settings);g_object_set_data_full(panel,"fm-radio-visibility",(P)1,NULL);
 done:g_object_unref(panel);return 0;
}
#include "settings-magic-mouse.h"
void gtk_widget_init_template(P widget){
 static void(*original)(P);if(!original)original=dlsym(RTLD_NEXT,"gtk_widget_init_template");
 if(!original)return;
 original(widget);
 const char*kind=g_type_name_from_instance(widget);
 if(getenv("FAMILIARMAC_GENIE_SCHEMAS")&&(!strcmp(kind,"CcBluetoothPanel")||!strcmp(kind,"CcWifiPanel")))
  g_idle_add(attach_radio_visibility,g_object_ref(widget));
 if(getenv("FAMILIARMAC_GENIE_SCHEMAS")&&!strcmp(kind,"CcMousePanel"))
  g_idle_add(attach_magic_mouse,g_object_ref(widget));
 /* Do not inject this Settings-only helper into child applications. */
 const char *preload=getenv("LD_PRELOAD");
 if(preload&&strstr(preload,"/settings-panel.so")){
  const char *rest=strchr(preload,':');
  if(rest)setenv("LD_PRELOAD",rest+1,1);else unsetenv("LD_PRELOAD");
 }
 if(!strcmp(g_type_name_from_instance(widget),"CcWindow")&&getenv("FAMILIARMAC_DOCK_UI")&&!g_object_get_data(widget,"fm-attach-pending")){
  g_object_set_data_full(widget,"fm-attach-pending",(P)1,NULL);
  g_idle_add(attach,g_object_ref(widget));
 }
}
