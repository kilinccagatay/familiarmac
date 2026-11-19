#include <assert.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
typedef void *P;
typedef struct Node {const char*type;struct Node*parent;int editable;} Node;
static Node view={"NautilusGridView",NULL,0},cell={"GtkGridView",&view,0},entry={"GtkText",&view,1},search={"NautilusQueryEditor",&view,0},popover={"GtkPopover",&view,0};
static int text_deleted;
int gtk_editable_get_position(P p){(void)p;return 3;}
int gtk_editable_get_selection_bounds(P p,int*a,int*b){(void)p;*a=3;*b=3;return 0;}
void gtk_editable_delete_text(P p,int a,int b){(void)p;assert(a==0&&b==3);text_deleted++;}
static P focus;static const char*action;static int calls;
const char*g_type_name_from_instance(P p){return ((Node*)p)->type;}
P gtk_widget_get_parent(P p){return ((Node*)p)->parent;}
unsigned long gtk_editable_get_type(void){return 42;}
int g_type_check_instance_is_a(P p,unsigned long t){(void)t;return ((Node*)p)->editable;}
P gtk_event_controller_get_widget(P p){return p;}
P gtk_window_get_focus(P p){(void)p;return focus;}
int gtk_widget_activate_action(P p,const char*a,const char*f,...){(void)p;(void)f;action=a;calls++;return 1;}
static P find(P p,const char*t){(void)p;(void)t;return NULL;}
extern P g_object_ref(P);extern void g_object_unref(P),g_object_get(P,const char*,...);extern void g_free(P);extern char*g_file_get_uri(P);
#include "../native/finder-shortcuts.h"
int main(void){
 focus=&cell;
 assert(fm_finder_key(NULL,0xff08,0,13,NULL));assert(!strcmp(action,"view.move-to-trash"));
 assert(fm_finder_key(NULL,'I',0,15,NULL));assert(!strcmp(action,"view.properties"));
 assert(fm_finder_key(NULL,'y',0,13,NULL));assert(!strcmp(action,"view.preview-selection"));
 int before=calls;
 for(unsigned m=0;m<13;m++)assert(!fm_finder_key(NULL,0xff08,0,m,NULL));
 focus=&entry;assert(fm_finder_key(NULL,0xff08,0,13,NULL));assert(text_deleted==1);
 focus=&search;assert(!fm_finder_key(NULL,0xff08,0,13,NULL));
 focus=&popover;assert(!fm_finder_key(NULL,0xff08,0,13,NULL));
 focus=NULL;assert(!fm_finder_key(NULL,0xff08,0,13,NULL));assert(calls==before);
 focus=&cell;assert(!fm_finder_key(NULL,'v',0,13,NULL));assert(!fm_finder_key(NULL,'d',0,13,NULL));
 puts("Finder shortcuts: exact modifiers, Caps Lock, file focus, editable/search/popover guards, absent destination PASS");
}
