/* GTK3 adapter: use Remmina's own fullscreen toggle, never resize its VNC
 * viewport from the compositor. Public GTK/GIO APIs, no Remmina private ABI. */
#include <string.h>
#include <unistd.h>
typedef void *P;
typedef struct List {P data;struct List *next,*prev;} List;
extern const char *g_get_prgname(void),*g_type_name_from_instance(P),*gtk_window_get_title(P),*gtk_tool_button_get_icon_name(P);
extern unsigned long gtk_container_get_type(void),gtk_tool_button_get_type(void);
extern int g_type_check_instance_is_a(P,unsigned long),gtk_widget_get_visible(P),gtk_toggle_tool_button_get_active(P);
extern List *gtk_window_list_toplevels(void),*gtk_container_get_children(P);
extern void g_list_free(List*),gtk_button_clicked(P),g_object_unref(P),g_variant_get(P,const char*,...);
extern P gtk_bin_get_child(P),g_object_ref(P),g_variant_new(const char*,...),g_dbus_node_info_new_for_xml(const char*,P*),g_dbus_node_info_lookup_interface(P,const char*);
extern void g_dbus_method_invocation_return_value(P,P);
extern unsigned g_idle_add(int(*)(P),P),g_bus_own_name(int,const char*,unsigned,P,P,P,P,P),g_dbus_connection_register_object(P,const char*,P,P,P,P,P*);
static P pending;
static P find_toggle(P widget) {
 if(g_type_check_instance_is_a(widget,gtk_tool_button_get_type())) {
  const char *icon=gtk_tool_button_get_icon_name(widget);
  if(icon&&!strcmp(icon,"org.remmina.Remmina-fullscreen-symbolic"))return widget;
 }
 if(!g_type_check_instance_is_a(widget,gtk_container_get_type()))return NULL;
 List *children=gtk_container_get_children(widget);P found=NULL;
 for(List *c=children;c&&!found;c=c->next)found=find_toggle(c->data);
 g_list_free(children);return found;
}
static int click_pending(P ignored) {
 (void)ignored;P button=pending;pending=NULL;
 if(button){gtk_button_clicked(button);g_object_unref(button);}return 0;
}
/* A title must identify exactly one local connection window. Never send keys
 * into a remote desktop or choose a different connection on ambiguity. */
int fm_remmina_set_fullscreen(const char *title,int desired) {
 List *windows=gtk_window_list_toplevels();P target=NULL;int count=0;
 for(List *l=windows;l;l=l->next){P w=l->data;const char *t=gtk_window_get_title(w);
  if(gtk_widget_get_visible(w)&&!strcmp(g_type_name_from_instance(w),"RemminaConnectionWindow")&&t&&!strcmp(t,title)){target=w;count++;}
 }
 g_list_free(windows);if(count!=1||pending)return 0;
 P toggle=find_toggle(target);if(!toggle)return 0;
 if(!!gtk_toggle_tool_button_get_active(toggle)==!!desired)return 1;
 P button=gtk_bin_get_child(toggle);if(!button)return 0;
 pending=g_object_ref(button);g_idle_add(click_pending,NULL);return 1;
}
static void method(P connection,const char *sender,const char *path,const char *iface,const char *name,P params,P invocation,P data) {
 (void)connection;(void)sender;(void)path;(void)iface;(void)data;
 const char *title;int desired;int ok=0;
 if(!strcmp(name,"SetFullscreen")){g_variant_get(params,"(&sb)",&title,&desired);ok=fm_remmina_set_fullscreen(title,desired);}
 g_dbus_method_invocation_return_value(invocation,g_variant_new("(b)",ok));
}
static struct {P method,get,set,padding[8];} vtable={(P)method,NULL,NULL,{NULL}};
static void acquired(P connection,const char *name,P data) {
 (void)name;(void)data;
 P info=g_dbus_node_info_new_for_xml("<node><interface name='org.familiarmac.Remmina'><method name='SetFullscreen'><arg type='s' direction='in'/><arg type='b' direction='in'/><arg type='b' direction='out'/></method></interface></node>",NULL);
 g_dbus_connection_register_object(connection,"/org/familiarmac/Remmina",g_dbus_node_info_lookup_interface(info,"org.familiarmac.Remmina"),&vtable,NULL,NULL,NULL);
}
#include <stdio.h>
void gtk_module_init(int *argc,char ***argv) {
 (void)argc;(void)argv;static int initialized;
 const char *program=g_get_prgname();if(initialized||!program||(strcmp(program,"remmina")&&strcmp(program,"org.remmina.Remmina")))return;
 initialized=1;char name[100];snprintf(name,sizeof name,"org.familiarmac.Remmina.p%ld",(long)getpid());
 g_bus_own_name(2,name,0,(P)acquired,NULL,NULL,NULL,NULL);
}
