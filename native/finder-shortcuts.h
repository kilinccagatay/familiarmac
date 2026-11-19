/* Public GTK/GIO APIs. Never interpret file shortcuts inside an editable,
 * rename dialog, search entry or popover. Normal app key bindings remain intact. */
extern int gtk_widget_activate_action(P,const char*,const char*,...);
extern unsigned long gtk_editable_get_type(void);
extern int gtk_editable_get_position(P),gtk_editable_get_selection_bounds(P,int*,int*);
extern void gtk_editable_delete_text(P,int,int);
extern int g_type_check_instance_is_a(P,unsigned long);
extern P gtk_widget_get_clipboard(P),gdk_clipboard_get_content(P);
extern void gdk_clipboard_read_async(P,const char**,int,P,P,P);
extern P gdk_clipboard_read_finish(P,P,const char**,P*);
extern void g_input_stream_read_all_async(P,P,unsigned long,int,P,P,P);
extern int g_input_stream_read_all_finish(P,P,unsigned long*,P*);
extern P g_bus_get_sync(int,P,P*),g_variant_new(const char*,...);
extern void g_dbus_connection_call(P,const char*,const char*,const char*,const char*,P,P,int,int,P,P,P);
extern char **g_strsplit(const char*,const char*,int);
extern void g_strfreev(char**);
extern int gdk_clipboard_set_content(P,P);
static int fm_file_focus(P focus){
 int view=0;
 for(P w=focus;w;w=gtk_widget_get_parent(w)){
  const char*t=g_type_name_from_instance(w);
  if(g_type_check_instance_is_a(w,gtk_editable_get_type())||strstr(t,"TextView")||strstr(t,"Popover")||strstr(t,"QueryEditor"))return 0;
  if(strstr(t,"Nautilus")&&strstr(t,"View"))view=1;
 }
 return view;
}
static void fm_file_call(const char*method,P args){
 P bus=g_bus_get_sync(2,NULL,NULL);if(!bus)return;
 g_dbus_connection_call(bus,"org.gnome.Nautilus","/org/gnome/Nautilus/FileOperations2","org.gnome.Nautilus.FileOperations2",method,args,NULL,0,-1,NULL,NULL,NULL);
 g_object_unref(bus);
}
typedef struct {P clipboard,old,provider,stream;char*destination;char data[1048577];int duplicate;} FmPaste;
static void fm_paste_free(FmPaste*p){
 if(p->stream)g_object_unref(p->stream);
 if(p->old)g_object_unref(p->old);
 if(p->provider)g_object_unref(p->provider);
 g_object_unref(p->clipboard);g_free(p->destination);free(p);
}
static void fm_paste_read(P stream,P result,FmPaste*p){
 unsigned long size=0;
 if(g_input_stream_read_all_finish(stream,result,&size,NULL)&&size<sizeof(p->data)){
  p->data[size]=0;
  char*lines=NULL;
  if(!strncmp(p->data,"copy\n",5))lines=p->data+5;
  else if(!strncmp(p->data,"cut\n",4))lines=p->data+4;
  if(lines&&*lines){
   char**uris=g_strsplit(lines,"\n",-1);int n=0;while(uris[n]&&*uris[n])n++;
   if(uris[n]){for(int j=n;uris[j];j++)g_free(uris[j]);uris[n]=NULL;}
   int valid=n>0;for(int i=0;i<n;i++)if(!strstr(uris[i],"://"))valid=0;
   if(valid)fm_file_call(p->duplicate?"CopyURIs":"MoveURIs",g_variant_new("(^ass@a{sv})",uris,p->destination,g_variant_new("a{sv}",NULL)));
   g_strfreev(uris);
  }
 }
 /* Do not overwrite clipboard changes made while the asynchronous read ran. */
 if(p->duplicate&&p->old&&gdk_clipboard_get_content(p->clipboard)==p->provider)gdk_clipboard_set_content(p->clipboard,p->old);
 fm_paste_free(p);
}
static void fm_paste_open(P clipboard,P result,FmPaste*p){
 const char*mime=NULL;p->stream=gdk_clipboard_read_finish(clipboard,result,&mime,NULL);
 if(!p->stream){fm_paste_free(p);return;}
 g_input_stream_read_all_async(p->stream,p->data,sizeof(p->data),0,NULL,fm_paste_read,p);
}
static int fm_paste(P window,P focus,int duplicate){
 P toolbar=find(window,"NautilusToolbar"),slot=NULL,location=NULL;
 if(toolbar)g_object_get(toolbar,"window-slot",&slot,NULL);
 if(!slot)return 0;
 g_object_get(slot,"location",&location,NULL);g_object_unref(slot);if(!location)return 0;
 FmPaste*p=calloc(1,sizeof(*p));p->destination=g_file_get_uri(location);g_object_unref(location);p->duplicate=duplicate;
 p->clipboard=g_object_ref(gtk_widget_get_clipboard(window));
 if(duplicate){
  P old=gdk_clipboard_get_content(p->clipboard);if(old)p->old=g_object_ref(old);
  if(!gtk_widget_activate_action(focus,"view.copy",NULL)){fm_paste_free(p);return 0;}
  P provider=gdk_clipboard_get_content(p->clipboard);if(provider)p->provider=g_object_ref(provider);
 }
 static const char*mimes[]={"x-special/gnome-copied-files",NULL};
 gdk_clipboard_read_async(p->clipboard,mimes,0,NULL,fm_paste_open,p);return 1;
}
static int fm_finder_key(P controller,unsigned key,unsigned code,unsigned mods,P unused){
 (void)code;(void)unused;
 /* Reserved app-specific keyd translation: Ctrl+Alt+Shift. Ignore Caps Lock. */
 if((mods&~2u)!=13u)return 0;
 P window=gtk_event_controller_get_widget(controller),focus=gtk_window_get_focus(window);
 if(!focus)return 0;
 if(key==0xff08&&g_type_check_instance_is_a(focus,gtk_editable_get_type())){
  int start=0,end=gtk_editable_get_position(focus);
  if(!gtk_editable_get_selection_bounds(focus,&start,&end)){start=0;end=gtk_editable_get_position(focus);}
  if(start>end){int t=start;start=end;end=t;}
  gtk_editable_delete_text(focus,start,end);return 1;
 }
 if(!fm_file_focus(focus))return 0;
 if(key>='A'&&key<='Z')key+=32;
 switch(key){
 case 0xff08:return gtk_widget_activate_action(focus,"view.move-to-trash",NULL);
 case 'i':return gtk_widget_activate_action(focus,"view.properties",NULL);
 case 'y':return gtk_widget_activate_action(focus,"view.preview-selection",NULL);
 case 'd':return fm_paste(window,focus,1);
 case 'v':return fm_paste(window,focus,0);
 case 'e':fm_file_call("EmptyTrash",g_variant_new("(b@a{sv})",1,g_variant_new("a{sv}",NULL)));return 1;
 default:return 0;
 }
}
