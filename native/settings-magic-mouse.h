/* Conditional native Mouse panel. Recognition lives in familiarmac-magic-mouse;
 * this UI only writes explicit preferences. No input device is opened here. */
#include <glob.h>
#include "settings-magic-demo.h"
extern P adw_view_stack_get_pages(P),adw_view_stack_get_visible_child(P),adw_view_stack_page_get_child(P),adw_view_stack_get_page(P,P);
extern P adw_view_stack_add_titled(P,P,const char*,const char*),g_list_model_get_item(P,unsigned);
extern void adw_view_stack_set_visible_child(P,P),adw_view_stack_page_set_visible(P,int);
extern unsigned g_timeout_add_seconds(unsigned,int(*)(P),P);
extern int g_source_remove(unsigned),g_settings_get_enum(P,const char*),g_settings_set_enum(P,const char*,int);
extern unsigned adw_combo_row_get_selected(P);
extern void adw_view_stack_page_set_icon_name(P,const char*);
extern int adw_view_stack_page_get_visible(P);
extern void adw_preferences_group_set_description(P,const char*);
extern void gtk_menu_button_set_popover(P,P),g_signal_handler_disconnect(P,UL);
extern P gtk_popover_new(void),adw_combo_row_new(void),gtk_string_list_new(const char*const*);
extern void gtk_popover_set_child(P,P),gtk_popover_popup(P),gtk_widget_set_parent(P,P),gtk_widget_unparent(P);
typedef struct {P summary,panel,stack,native,native_page,page,magic_page,mouse,genie,secondary,advanced,accel;unsigned timer;UL mouse_changed;int present,syncing,native_was_visible,battery;} MagicPanel;
static int magic_connected(int*battery){
 *battery=-1;
 glob_t paths={0};int found=0;
 if(glob("/sys/class/hidraw/hidraw*/device/uevent",0,NULL,&paths))return 0;
 for(size_t i=0;i<paths.gl_pathc&&!found;i++){
  FILE*f=fopen(paths.gl_pathv[i],"r");if(!f)continue;
  char line[512];unsigned bus,vendor,product;
  while(fgets(line,sizeof(line),f))if(sscanf(line,"HID_ID=%x:%x:%x",&bus,&vendor,&product)==3&&
   (bus==3||bus==5)&&(vendor==0x05ac||vendor==0x004c)&&
   (product==0x030d||product==0x0269||product==0x0323)){found=1;break;}
  fclose(f);
  if(found){
   char node[4096];snprintf(node,sizeof(node),"%s",paths.gl_pathv[i]);char*end=strrchr(node,'/');if(end)*end=0;
   char*device=realpath(node,NULL);glob_t supplies={0};
   if(device&&!glob("/sys/class/power_supply/*/device",0,NULL,&supplies)){
    for(size_t j=0;j<supplies.gl_pathc;j++){
     char*parent=realpath(supplies.gl_pathv[j],NULL);
     if(parent&&!strcmp(device,parent)){
      char capacity[4096];snprintf(capacity,sizeof(capacity),"%s",supplies.gl_pathv[j]);char*tail=strrchr(capacity,'/');
      if(tail){snprintf(tail+1,sizeof(capacity)-(tail+1-capacity),"capacity");FILE*c=fopen(capacity,"r");int value;
       if(c){if(fscanf(c,"%d",&value)==1&&value>=0&&value<=100)*battery=value;fclose(c);}}
     }
     free(parent);
    }
   }
   globfree(&supplies);free(device);
  }
 }
 globfree(&paths);return found;
}
static int magic_refresh(P ptr){
 MagicPanel*s=ptr;int battery=-1,present=magic_connected(&battery);
 if(battery!=s->battery){
  s->battery=battery;char text[100];
  if(battery>=0)snprintf(text,sizeof(text),"Battery: %d%%",battery);
  else snprintf(text,sizeof(text),"Point, click and use gestures on the Multi-Touch surface.");
  adw_preferences_group_set_description(s->summary,text);
 }
 if(present!=s->present){
  int previous=s->present;s->present=present;
  if(present)s->native_was_visible=adw_view_stack_page_get_visible(s->native_page);
  P current=adw_view_stack_get_visible_child(s->stack);
  adw_view_stack_page_set_visible(s->magic_page,present);
  /* Restore the mouse page before moving away from a disconnected Magic Mouse. */
  if(!present&&previous==1)adw_view_stack_page_set_visible(s->native_page,s->native_was_visible);
  if(present&&current==s->native)adw_view_stack_set_visible_child(s->stack,s->page);
  if(!present&&current==s->page)adw_view_stack_set_visible_child(s->stack,s->native);
  if(present)adw_view_stack_page_set_visible(s->native_page,0);
 }
 return 1;
}
static void magic_secondary_changed(P row,P spec,MagicPanel*s){
 (void)spec;if(!s->syncing)g_settings_set_boolean(s->mouse,"left-handed",adw_combo_row_get_selected(row)==1);
}
static void magic_mouse_sync(P obj,const char*key,MagicPanel*s){
 (void)obj;(void)key;s->syncing=1;
 g_object_set(s->secondary,"selected",g_settings_get_boolean(s->mouse,"left-handed")?1u:0u,NULL);
 if(s->accel)g_object_set(s->accel,"selected",(unsigned)g_settings_get_enum(s->mouse,"accel-profile"),NULL);
 s->syncing=0;
}
static void magic_accel_changed(P row,P spec,MagicPanel*s){
 (void)spec;if(!s->syncing)g_settings_set_enum(s->mouse,"accel-profile",adw_combo_row_get_selected(row));
}
static void magic_advanced(P button,MagicPanel*s){
 if(!s->advanced){
  s->advanced=gtk_popover_new();gtk_menu_button_set_popover(button,s->advanced);
  P group=adw_preferences_group_new();s->accel=adw_combo_row_new();
  const char*labels[]={"System default","Flat","Adaptive",NULL};P model=gtk_string_list_new(labels);
  adw_preferences_row_set_title(s->accel,"Pointer acceleration");g_object_set(s->accel,"model",model,NULL);g_object_unref(model);
  adw_preferences_group_add(group,s->accel);g_object_set(group,"margin-start",12,"margin-end",12,"margin-top",12,"margin-bottom",12,"width-request",300,NULL);
  gtk_popover_set_child(s->advanced,group);magic_mouse_sync(NULL,NULL,s);
  g_signal_connect_data(s->accel,"notify::selected",magic_accel_changed,s,NULL,0);
 }

}
static void magic_bluetooth(P button,P unused){
 (void)button;(void)unused;const char*argv[]={"gnome-control-center","bluetooth",NULL};P error=NULL;
 P process=g_subprocess_newv(argv,0,&error);if(process)g_object_unref(process);if(error)g_error_free(error);
}
static void magic_free(P ptr){
 MagicPanel*s=ptr;if(s->timer)g_source_remove(s->timer);
 if(s->mouse_changed)g_signal_handler_disconnect(s->mouse,s->mouse_changed);
 g_object_unref(s->native_page);g_object_unref(s->mouse);g_object_unref(s->genie);free(s);
}
static int attach_magic_mouse(P panel){
 const char*base=getenv("FAMILIARMAC_DOCK_UI"),*schemas=getenv("FAMILIARMAC_GENIE_SCHEMAS");
 P stack=find(panel,"AdwViewStack",NULL);
 if(!base||!schemas||!stack||g_object_get_data(panel,"fm-magic-mouse"))goto done;
 char file[4096];snprintf(file,sizeof(file),"%s",base);char*slash=strrchr(file,'/');if(!slash)goto done;
 snprintf(slash+1,sizeof(file)-(slash+1-file),"magic-mouse.ui");
 P error=NULL,builder=gtk_builder_new();
 if(!gtk_builder_add_from_file(builder,file,&error)){if(error)g_error_free(error);g_object_unref(builder);goto done;}
 P page=gtk_builder_get_object(builder,"fm_magic_page");
 P pages=adw_view_stack_get_pages(stack),native_page=g_list_model_get_item(pages,0);g_object_unref(pages);
 if(!page||!native_page){if(native_page)g_object_unref(native_page);g_object_unref(builder);goto done;}
 P source=g_settings_schema_source_new_from_directory(schemas,g_settings_schema_source_get_default(),0,&error);
 if(!source){if(error)g_error_free(error);g_object_unref(native_page);g_object_unref(builder);goto done;}
 P schema=g_settings_schema_source_lookup(source,"org.gnome.shell.extensions.familiarmac-genie",0);g_settings_schema_source_unref(source);
 if(!schema){g_object_unref(native_page);g_object_unref(builder);goto done;}
 MagicPanel*s=calloc(1,sizeof(*s));s->panel=panel;s->stack=stack;s->native_page=native_page;s->native=adw_view_stack_page_get_child(native_page);s->page=page;
 s->mouse=g_settings_new("org.gnome.desktop.peripherals.mouse");s->genie=g_settings_new_full(schema,NULL,NULL);g_settings_schema_unref(schema);
 s->magic_page=adw_view_stack_add_titled(stack,page,"familiarmac-magic-mouse","Mouse");s->summary=gtk_builder_get_object(builder,"fm_magic_summary");s->battery=-2;s->present=-1;adw_view_stack_page_set_icon_name(s->magic_page,"input-mouse-symbolic");
 s->secondary=gtk_builder_get_object(builder,"fm_magic_secondary");
 g_settings_bind(s->mouse,"speed",gtk_builder_get_object(builder,"fm_magic_speed"),"value",0);
 g_settings_bind(s->mouse,"natural-scroll",gtk_builder_get_object(builder,"fm_magic_natural"),"active",0);
 g_settings_bind(s->genie,"mission-control-magic-mouse",gtk_builder_get_object(builder,"fm_magic_mission"),"active",0);
 g_settings_bind(s->genie,"magic-mouse-pages",gtk_builder_get_object(builder,"fm_magic_pages"),"active",0);
 g_settings_bind(s->genie,"magic-mouse-spaces",gtk_builder_get_object(builder,"fm_magic_spaces"),"active",0);
 g_settings_bind(s->genie,"magic-mouse-smart-zoom",gtk_builder_get_object(builder,"fm_magic_zoom"),"active",0);
 magic_mouse_sync(NULL,NULL,s);
 g_signal_connect_data(s->secondary,"notify::selected",magic_secondary_changed,s,NULL,0);
 s->mouse_changed=g_signal_connect_data(s->mouse,"changed",magic_mouse_sync,s,NULL,0);
 magic_advanced(gtk_builder_get_object(builder,"fm_magic_advanced"),s);
 g_signal_connect_data(gtk_builder_get_object(builder,"fm_magic_bluetooth"),"clicked",magic_bluetooth,NULL,NULL,0);
 attach_magic_demo(builder);
 magic_refresh(s);s->timer=g_timeout_add_seconds(2,magic_refresh,s);
 g_object_set_data_full(panel,"fm-magic-mouse",s,magic_free);g_object_unref(builder);
 done:g_object_unref(panel);return 0;
}
