/* Native GTK side of the optional fullscreen reveal capability. The Shell
 * discovers this only for processes launched with the matching helper. */
#include <unistd.h>
extern void gtk_widget_set_margin_top(P,int),gtk_widget_add_css_class(P,const char*),gtk_widget_remove_css_class(P,const char*);
extern P gtk_css_provider_new(void),gdk_display_get_default(void);
extern void gtk_css_provider_load_from_data(P,const char*,long),gtk_style_context_add_provider_for_display(P,P,unsigned);
extern void g_signal_handler_disconnect(P,unsigned long);
static P fullscreen_settings(void){
 static P s;if(s)return s;const char *dir=getenv("FAMILIARMAC_FULLSCREEN_SCHEMAS");if(!dir)return NULL;
 P source=g_settings_schema_source_new_from_directory(dir,g_settings_schema_source_get_default(),0,NULL);if(!source)return NULL;
 P schema=g_settings_schema_source_lookup(source,"org.familiarmac.fullscreen",0);if(schema){s=g_settings_new_full(schema,NULL,NULL);g_settings_schema_unref(schema);}g_settings_schema_source_unref(source);return s;
}
extern unsigned g_signal_lookup(const char*,unsigned long);
extern unsigned long gtk_widget_get_type(void),gtk_popover_get_type(void),g_signal_add_emission_hook(unsigned,unsigned long,P,P,P);
extern int g_type_check_instance_is_a(P,unsigned long);
extern P g_value_get_object(P);
static int popup_count;
static int popup_emission(P hint,unsigned count,P values,P mapped){
 (void)hint;if(!count)return 1;P widget=g_value_get_object(values);
 if(g_type_check_instance_is_a(widget,gtk_popover_get_type())){
  popup_count+=mapped?1:-1;if(popup_count<0)popup_count=0;
  P settings=fullscreen_settings();if(settings)g_settings_set_uint(settings,"popup-pid",popup_count?(unsigned)getpid():0);
 }return 1;
}
typedef struct{P window,content,settings;unsigned long changed;} Fullscreen;
static void fullscreen_sync(P object,P spec,Fullscreen*s){
 (void)object;(void)spec;
 int show=gtk_window_is_fullscreen(s->window)&&g_settings_get_uint(s->settings,"reveal-pid")== (unsigned)getpid();
 gtk_widget_set_margin_top(s->content,show?(int)g_settings_get_uint(s->settings,"panel-height"):0);
 if(show)gtk_widget_add_css_class(s->window,"fm-fullscreen-reveal");else gtk_widget_remove_css_class(s->window,"fm-fullscreen-reveal");
}
static void fullscreen_free(P data){Fullscreen*s=data;g_signal_handler_disconnect(s->settings,s->changed);free(s);}
static void fullscreen_attach(P window){
 P settings=fullscreen_settings(),content=find(window,"AdwToastOverlay");if(!settings||!content)return;
 Fullscreen*s=calloc(1,sizeof(*s));s->window=window;s->content=content;s->settings=settings;
 s->changed=g_signal_connect_data(settings,"changed",fullscreen_sync,s,NULL,0);
 g_signal_connect_data(window,"notify::fullscreened",fullscreen_sync,s,NULL,0);
 g_object_set_data_full(window,"fm-fullscreen-native",s,fullscreen_free);
 static int styled;if(!styled){styled=1;g_settings_set_uint(settings,"popup-pid",0);
 g_signal_add_emission_hook(g_signal_lookup("map",gtk_widget_get_type()),0,popup_emission,(P)1,NULL);g_signal_add_emission_hook(g_signal_lookup("unmap",gtk_widget_get_type()),0,popup_emission,NULL,NULL);P css=gtk_css_provider_new();gtk_css_provider_load_from_data(css,"window.fullscreen.fm-fullscreen-reveal headerbar button.titlebutton, window.fullscreen.fm-fullscreen-reveal headerbar windowcontrols { opacity: 1; }",-1);gtk_style_context_add_provider_for_display(gdk_display_get_default(),css,801);g_object_unref(css);}
 fullscreen_sync(NULL,NULL,s);
}
/* Claim a native green-button click before GtkWindowControls can request
 * maximize. Alt-click is intentionally left to GTK's original zoom action. */
extern P gtk_event_controller_legacy_new(void),gtk_widget_pick(P,double,double,int);
extern int gtk_widget_has_css_class(P,const char*),gdk_event_get_event_type(P),gdk_event_get_position(P,double*,double*);
extern unsigned gdk_button_event_get_button(P),gdk_event_get_modifier_state(P);
extern void gtk_window_fullscreen(P);
static int green_button_at(P window,P event){
 double x=0,y=0;if(!gdk_event_get_position(event,&x,&y))return 0;
 for(P w=gtk_widget_pick(window,x,y,0);w&&w!=window;w=gtk_widget_get_parent(w))if(gtk_widget_has_css_class(w,"maximize")){for(P parent=gtk_widget_get_parent(w);parent&&parent!=window;parent=gtk_widget_get_parent(parent))if(!strcmp(g_type_name_from_instance(parent),"GtkWindowControls"))return 1;}
 return 0;
}
static int green_event(P controller,P event,P unused){
 (void)unused;P window=gtk_event_controller_get_widget(controller);int type=gdk_event_get_event_type(event);
 if(type!=2&&type!=3)return 0;
 if(gdk_button_event_get_button(event)!=1)return 0;
 if(type==2){
  if((gdk_event_get_modifier_state(event)&8)||!green_button_at(window,event))return 0;
  g_object_set_data_full(window,"fm-green-pressed",(P)1,NULL);return 1;
 }
 if(!g_object_get_data(window,"fm-green-pressed"))return 0;
 g_object_set_data_full(window,"fm-green-pressed",NULL,NULL);
 if(green_button_at(window,event)){if(gtk_window_is_fullscreen(window))gtk_window_unfullscreen(window);else gtk_window_fullscreen(window);}
 return 1;
}
static void green_button_attach(P window){P c=gtk_event_controller_legacy_new();gtk_event_controller_set_propagation_phase(c,1);g_signal_connect_data(c,"event",green_event,NULL,NULL,0);gtk_widget_add_controller(window,c);}
