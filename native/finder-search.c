/* User-local Nautilus 46 search integration; public GObject/GTK APIs only.
 * Native query engine, filters, navigation and result actions remain authoritative. */
#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdlib.h>
#include <string.h>
typedef void *P;
extern const char *g_type_name_from_instance(P),*gtk_widget_get_name(P);
extern P gtk_widget_get_first_child(P),gtk_widget_get_next_sibling(P),gtk_widget_get_parent(P),g_object_ref(P),g_object_get_data(P,const char*);
extern void g_object_unref(P),g_object_get(P,const char*,...),g_object_set(P,const char*,...),g_object_set_data_full(P,const char*,P,void(*)(P));
extern unsigned g_idle_add(int(*)(P),P);
extern unsigned long g_signal_connect_data(P,const char*,P,P,P,int);
extern void g_signal_emit_by_name(P,const char*,...);
extern P gtk_box_new(int,int),gtk_label_new(const char*),gtk_toggle_button_new_with_label(const char*);
extern void gtk_box_append(P,P),gtk_box_remove(P,P),gtk_widget_set_visible(P,int),gtk_widget_set_sensitive(P,int),gtk_widget_set_name(P,const char*),gtk_toggle_button_set_active(P,int),gtk_toggle_button_set_group(P,P),gtk_button_set_label(P,const char*);
extern P gtk_widget_get_root(P);
extern int gtk_widget_grab_focus(P);
extern int gtk_widget_get_mapped(P),gtk_toggle_button_get_active(P);
extern P g_settings_schema_source_new_from_directory(const char*,P,int,P*),g_settings_schema_source_get_default(void),g_settings_schema_source_lookup(P,const char*,int),g_settings_new_full(P,P,const char*);
extern void g_settings_schema_unref(P),g_settings_schema_source_unref(P),g_settings_bind(P,const char*,P,const char*,unsigned);
extern unsigned g_settings_get_uint(P,const char*);
extern int g_settings_set_uint(P,const char*,unsigned);
extern char *g_file_get_basename(P),*g_file_get_uri(P);
extern void g_free(P);
extern P adw_preferences_page_new(void),adw_preferences_group_new(void),adw_combo_row_new(void),gtk_string_list_new(const char*const*);
extern void adw_preferences_page_set_title(P,const char*),adw_preferences_page_set_icon_name(P,const char*),adw_preferences_page_add(P,P),adw_preferences_group_add(P,P),adw_preferences_window_add(P,P),adw_preferences_row_set_title(P,const char*),adw_action_row_set_subtitle(P,const char*),adw_combo_row_set_model(P,P);
static P settings(void){
 static P s; if(s)return s;const char *dir=getenv("FAMILIARMAC_FINDER_SCHEMAS");if(!dir)return NULL;
 P source=g_settings_schema_source_new_from_directory(dir,g_settings_schema_source_get_default(),0,NULL);if(!source)return NULL;
 P schema=g_settings_schema_source_lookup(source,"org.familiarmac.finder",0);if(schema){s=g_settings_new_full(schema,NULL,NULL);g_settings_schema_unref(schema);}g_settings_schema_source_unref(source);return s;
}
static P find(P w,const char *type){if(!w)return NULL;if(!strcmp(g_type_name_from_instance(w),type))return w;for(P c=gtk_widget_get_first_child(w);c;c=gtk_widget_get_next_sibling(c)){P r=find(c,type);if(r)return r;}return NULL;}
static P named(P w,const char *name){if(!w)return NULL;if(!strcmp(gtk_widget_get_name(w),name))return w;for(P c=gtk_widget_get_first_child(w);c;c=gtk_widget_get_next_sibling(c)){P r=named(c,name);if(r)return r;}return NULL;}
extern P gtk_menu_button_new(void),gtk_popover_new(void);
extern void gtk_widget_set_parent(P,P),gtk_menu_button_set_icon_name(P,const char*),gtk_menu_button_set_popover(P,P),gtk_popover_set_child(P,P),gtk_popover_popdown(P),gtk_widget_set_tooltip_text(P,const char*);
typedef struct {P editor,bar,all,current,folder,scope,popover;int changing,started;} Search;
static void free_search(P p){Search*s=p;if(s->folder)g_object_unref(s->folder);g_object_unref(s->bar);free(s);}
static void choose(Search*s,int all,int emit){
 if(s->changing)return;
 s->changing=1;
 if(!s->folder)all=1;
 g_object_set(s->editor,"location",all?NULL:s->folder,NULL);
 gtk_toggle_button_set_active(all?s->all:s->current,1);
 extern void gtk_image_set_from_icon_name(P,const char*);P prefix=find(s->editor,"GtkImage");if(prefix)gtk_image_set_from_icon_name(prefix,"edit-find-symbolic");
 gtk_menu_button_set_icon_name(s->scope,all?"computer-symbolic":"folder-symbolic");gtk_widget_set_tooltip_text(s->scope,all?"Search This Mac":"Search Current Folder");
 if(emit){P query=NULL;g_object_get(s->editor,"query",&query,NULL);if(query){g_signal_emit_by_name(s->editor,"changed",query,1);g_object_unref(query);}g_settings_set_uint(settings(),"previous-scope",all?0:1);}
 s->changing=0;
}
static void toggled(P button,Search*s){if(!s->changing&&gtk_toggle_button_get_active(button)){choose(s,button==s->all,1);gtk_popover_popdown(s->popover);}}
static void start(P editor,Search*s){
 if(!gtk_widget_get_mapped(editor)||s->started)return;
 P query=NULL;g_object_get(editor,"query",&query,NULL);if(!query)return;
 P folder=NULL;char *text=NULL;g_object_get(query,"location",&folder,"text",&text,NULL);g_object_unref(query);
 int resume=text&&*text;g_free(text);int existing_all=folder==NULL;
 if(resume&&!folder&&s->folder)folder=g_object_ref(s->folder);
 if(s->folder)g_object_unref(s->folder);
 s->folder=folder;
 char *name=folder?g_file_get_basename(folder):NULL;gtk_button_set_label(s->current,name?name:"Current Folder");g_free(name);gtk_widget_set_sensitive(s->current,folder!=NULL);
 unsigned mode=g_settings_get_uint(settings(),"default-scope");if(mode==2)mode=g_settings_get_uint(settings(),"previous-scope");
 s->started=1;choose(s,resume?existing_all:mode==0,0);gtk_widget_grab_focus(editor);
}
static void unmapped(P editor,Search*s){(void)editor;s->started=0;}
static void query_changed(P editor,P spec,Search*s){(void)spec;P q=NULL;g_object_get(editor,"query",&q,NULL);if(!q){s->started=0;}else g_object_unref(q);}
static int attach(P editor){
 P parent=gtk_widget_get_parent(editor);if(!parent||strcmp(g_type_name_from_instance(parent),"GtkBox")||!settings())goto done;
 Search*s=g_object_get_data(editor,"fm-search");
 if(!s){s=calloc(1,sizeof(*s));s->editor=editor;s->bar=gtk_box_new(1,4);g_object_ref(s->bar);
 gtk_widget_set_name(s->bar,"fm-search-scope");
 s->scope=gtk_menu_button_new();s->popover=gtk_popover_new();gtk_popover_set_child(s->popover,s->bar);gtk_menu_button_set_popover(s->scope,s->popover);gtk_widget_set_parent(s->scope,editor);s->all=gtk_toggle_button_new_with_label("This Mac");s->current=gtk_toggle_button_new_with_label("Current Folder");gtk_toggle_button_set_group(s->current,s->all);gtk_box_append(s->bar,s->all);gtk_box_append(s->bar,s->current);
 g_signal_connect_data(s->all,"toggled",toggled,s,NULL,0);g_signal_connect_data(s->current,"toggled",toggled,s,NULL,0);
 g_signal_connect_data(editor,"map",start,s,NULL,1);g_signal_connect_data(editor,"unmap",unmapped,s,NULL,1);g_signal_connect_data(editor,"notify::query",query_changed,s,NULL,1);
 g_object_set_data_full(editor,"fm-search",s,free_search);
 }
 start(editor,s);
 done:g_object_unref(editor);return 0;
}
void gtk_box_append(P parent,P widget){
 static void(*original)(P,P);if(!original)original=dlsym(RTLD_NEXT,"gtk_box_append");original(parent,widget);
 if(!strcmp(g_type_name_from_instance(widget),"NautilusQueryEditor")&&getenv("FAMILIARMAC_FINDER_SCHEMAS"))g_idle_add(attach,g_object_ref(widget));
}
static int preferences(P window){
 if(!g_object_get_data(window,"fm-search-prefs")&&settings()){
 g_object_set_data_full(window,"fm-search-prefs",(P)1,NULL);
 P page=adw_preferences_page_new(),group=adw_preferences_group_new(),row=adw_combo_row_new();
 adw_preferences_page_set_title(page,"Advanced");adw_preferences_page_set_icon_name(page,"preferences-system-symbolic");
 adw_preferences_row_set_title(row,"When performing a search");adw_action_row_set_subtitle(row,"Choose the default scope for Finder searches");
 const char *choices[]={"Search This Mac","Search the Current Folder","Use the Previous Search Scope",NULL};P model=gtk_string_list_new(choices);adw_combo_row_set_model(row,model);g_object_unref(model);
 g_settings_bind(settings(),"default-scope",row,"selected",0);adw_preferences_group_add(group,row);adw_preferences_page_add(page,group);adw_preferences_window_add(window,page);
 }g_object_unref(window);return 0;
}
P gtk_builder_get_object(P builder,const char *name){
 static P(*original)(P,const char*);if(!original)original=dlsym(RTLD_NEXT,"gtk_builder_get_object");P result=original(builder,name);
 if(result&&!strcmp(name,"preferences_window")&&getenv("FAMILIARMAC_FINDER_SCHEMAS"))g_idle_add(preferences,g_object_ref(result));
 return result;
}

extern void adw_header_bar_remove(P,P),adw_header_bar_pack_end(P,P);
extern P gtk_menu_button_get_popover(P),gtk_event_controller_key_new(void),gtk_event_controller_get_widget(P),gtk_window_get_focus(P);
extern void gtk_widget_add_controller(P,P),gtk_event_controller_set_propagation_phase(P,int),gtk_window_unfullscreen(P);
extern int gtk_window_is_fullscreen(P);
static int escape_key(P controller,unsigned key,unsigned code,unsigned mods,P unused){
 (void)code;(void)mods;(void)unused;
 P window=gtk_event_controller_get_widget(controller);if(key!=0xff1b||!gtk_window_is_fullscreen(window))return 0;
 /* Bubble phase: native popovers and search consume Escape before us. */
 P focus=gtk_window_get_focus(window);for(P w=focus;w;w=gtk_widget_get_parent(w)){
 const char*t=g_type_name_from_instance(w);if(strstr(t,"Popover")||!strcmp(t,"NautilusQueryEditor"))return 0;
 }
 gtk_window_unfullscreen(window);return 1;
}
#include "fullscreen-reveal.h"
static int collapse_search(P slot){g_object_set(slot,"search-visible",0,NULL);g_object_unref(slot);return 0;}
static int outside_search_event(P controller,P event,P unused){
 (void)unused;
 if(gdk_event_get_event_type(event)!=3||gdk_button_event_get_button(event)!=1)return 0;
 P window=gtk_event_controller_get_widget(controller),toolbar=find(window,"NautilusToolbar");
 P editor=find(toolbar,"NautilusQueryEditor");if(!editor||!gtk_widget_get_mapped(editor))return 0;
 double x=0,y=0;if(!gdk_event_get_position(event,&x,&y))return 0;
 P picked=gtk_widget_pick(window,x,y,0);if(!picked)return 0;
 for(P w=picked;w&&w!=window;w=gtk_widget_get_parent(w)){
  const char*t=g_type_name_from_instance(w);
  if(w==editor||strstr(t,"Popover")||!strcmp(gtk_widget_get_name(w),"fm-finder-search-button"))return 0;
 }
 P slot=NULL;g_object_get(toolbar,"window-slot",&slot,NULL);
 if(slot)g_idle_add(collapse_search,slot);
 return 0; /* Preserve the clicked control's native action. */
}
static int window_attach(P window){
 fullscreen_attach(window);green_button_attach(window);
 P outside=gtk_event_controller_legacy_new();gtk_event_controller_set_propagation_phase(outside,1);g_signal_connect_data(outside,"event",outside_search_event,NULL,NULL,0);gtk_widget_add_controller(window,outside);
 P toolbar=find(window,"NautilusToolbar"),header=find(toolbar,"AdwHeaderBar");
 P folder_menu=find(find(toolbar,"NautilusPathBar"),"GtkMenuButton");if(folder_menu)gtk_menu_button_set_icon_name(folder_menu,"pan-down-symbolic");
 P app=g_object_get_data(window,"fm-app-button");
 if(header&&app){P parent=gtk_widget_get_parent(app);while(parent&&strcmp(g_type_name_from_instance(parent),"AdwHeaderBar"))parent=gtk_widget_get_parent(parent);
 if(parent&&parent!=header){g_object_ref(app);adw_header_bar_remove(parent,app);adw_header_bar_pack_end(header,app);g_object_unref(app);}}
 P key=gtk_event_controller_key_new();gtk_event_controller_set_propagation_phase(key,2);g_signal_connect_data(key,"key-pressed",escape_key,NULL,NULL,0);gtk_widget_add_controller(window,key);
 g_object_unref(window);return 0;
}
/* Do not preload the Finder adapter into applications opened from Finder. */
static void strip_environment_entry(const char*key,const char*entry){
 const char*value=getenv(key);if(!value)return;char*copy=strdup(value),*out=calloc(strlen(value)+1,1),*save=NULL;
 for(char*part=strtok_r(copy,":",&save);part;part=strtok_r(NULL,":",&save)){if(!strcmp(part,entry))continue;if(*out)strcat(out,":");strcat(out,part);}
 if(*out)setenv(key,out,1);else unsetenv(key);free(out);free(copy);
}
static void isolate_children(void){
 static int done;if(done)return;done=1;Dl_info info;
 if(dladdr((P)isolate_children,&info)&&info.dli_fname)strip_environment_entry("LD_PRELOAD",info.dli_fname);
 const char*schema=getenv("FAMILIARMAC_FINDER_SCHEMAS");if(schema){char*base=strdup(schema);char*last=strrchr(base,'/');if(last)*last=0;const char*prefix="/org/gnome/nautilus/ui=";char*entry=malloc(strlen(prefix)+strlen(base)+1);strcpy(entry,prefix);strcat(entry,base);strip_environment_entry("G_RESOURCE_OVERLAYS",entry);free(entry);free(base);}
}
void gtk_widget_init_template(P widget){
 static void(*original)(P);if(!original)original=dlsym(RTLD_NEXT,"gtk_widget_init_template");original(widget);
 if(!strcmp(g_type_name_from_instance(widget),"NautilusWindow")&&settings()){
 isolate_children();
 /* Template child is public through the standard GTK template API. */
 extern P gtk_widget_get_template_child(P,unsigned long,const char*);extern unsigned long g_type_from_name(const char*);
 P app=gtk_widget_get_template_child(widget,g_type_from_name("NautilusWindow"),"app_button");g_object_set_data_full(widget,"fm-app-button",app,NULL);
 g_idle_add(window_attach,g_object_ref(widget));
 }
}

void gtk_stack_set_visible_child_name(P stack,const char*name){
 static void(*original)(P,const char*);if(!original)original=dlsym(RTLD_NEXT,"gtk_stack_set_visible_child_name");
 if(!strcmp(gtk_widget_get_name(stack),"fm-finder-path-stack")){
  P toolbar=gtk_widget_get_parent(stack);while(toolbar&&strcmp(g_type_name_from_instance(toolbar),"NautilusToolbar"))toolbar=gtk_widget_get_parent(toolbar);
  P button=named(toolbar,"fm-finder-search-button");if(button)gtk_widget_set_visible(button,strcmp(name,"search")!=0);
  if(!strcmp(name,"search"))name="pathbar";
 }
 original(stack,name);
}
