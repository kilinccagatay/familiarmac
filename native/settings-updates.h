/* Inline release controls. Each async operation owns its references; closing
 * Settings neither dereferences freed State nor interrupts an installation. */
extern P g_subprocess_get_stdout_pipe(P),g_data_input_stream_new(P);
extern void g_data_input_stream_read_line_async(P,int,P,P,P),g_subprocess_wait_async(P,P,P,P);
extern char*g_data_input_stream_read_line_finish(P,P,size_t*,P*);
extern int g_subprocess_wait_finish(P,P,P*),gtk_widget_get_visible(P);
extern void gtk_progress_bar_set_fraction(P,double),gtk_progress_bar_set_text(P,const char*),gtk_button_set_label(P,const char*);
extern void g_object_add_weak_pointer(P,P*),g_object_remove_weak_pointer(P,P*);
extern P adw_message_dialog_new(P,const char*,const char*);
extern void adw_message_dialog_add_response(P,const char*,const char*),adw_message_dialog_set_response_appearance(P,const char*,int),adw_message_dialog_set_default_response(P,const char*),adw_message_dialog_set_close_response(P,const char*);
enum { FM_STDOUT_PIPE=4, FM_STDERR_PIPE=16, FM_STDERR_MERGE=64 };
typedef struct {int refs,busy,ask;P window,row,button,progress,process,stream;char*version;} Updates;
static Updates*updates_ref(Updates*u){u->refs++;return u;}
static void updates_unref(P data){
 Updates*u=data;if(--u->refs)return;
 if(u->window)g_object_remove_weak_pointer(u->window,&u->window);
 g_object_unref(u->row);g_object_unref(u->button);g_object_unref(u->progress);free(u->version);free(u);
}
static void updates_closure_free(P data,P closure){(void)closure;updates_unref(data);}
static void updates_ready(Updates*u){u->busy=0;gtk_widget_set_sensitive(u->button,1);gtk_button_set_label(u->button,u->version?"Download Update…":"Check for Updates");}
static void updates_logout(P dialog,const char*response,Updates*u){
 (void)u;
 if(!strcmp(response,"logout")){
  const char*argv[]={"gnome-session-quit","--logout",NULL};P error=NULL;
  P p=g_subprocess_newv(argv,0,&error);if(p)g_object_unref(p);if(error)g_error_free(error);
 }
 (void)dialog; /* AdwMessageDialog closes itself after response. */
}
static void updates_installed(P process,P result,Updates*u){
 P error=NULL;int ok=g_subprocess_wait_finish(process,result,&error)&&g_subprocess_get_successful(process);
 if(error)g_error_free(error);
 g_object_unref(u->stream);u->stream=NULL;g_object_unref(u->process);u->process=NULL;
 if(ok){
  char title[128];snprintf(title,sizeof(title),"FamiliarMac %s",u->version);adw_preferences_row_set_title(u->row,title);
  free(u->version);u->version=NULL;gtk_progress_bar_set_fraction(u->progress,1);
  gtk_progress_bar_set_text(u->progress,"Installed");adw_action_row_set_subtitle(u->row,"Update installed. Log out and back in when ready.");
  if(u->window&&gtk_widget_get_visible(u->window)){
   P dialog=adw_message_dialog_new(u->window,"Update installed","Save your work, then log out and back in to load the new desktop code.");
   adw_message_dialog_add_response(dialog,"later","Later");adw_message_dialog_add_response(dialog,"logout","Log Out…");
   adw_message_dialog_set_default_response(dialog,"later");adw_message_dialog_set_close_response(dialog,"later");
   g_signal_connect_data(dialog,"response",updates_logout,updates_ref(u),updates_closure_free,0);gtk_window_present(dialog);
  }
 }else{gtk_progress_bar_set_text(u->progress,"Update incomplete — retry when ready");}
 updates_ready(u);updates_unref(u);
}
static void updates_line(P stream,P result,Updates*u){
 P error=NULL;size_t size=0;char*line=g_data_input_stream_read_line_finish(stream,result,&size,&error);
 if(error)g_error_free(error);
 if(line){
  char*message=strchr(line,'\t');
  if(message){*message++=0;double fraction=strtod(line,NULL);if(fraction>=0&&fraction<=1)gtk_progress_bar_set_fraction(u->progress,fraction);gtk_progress_bar_set_text(u->progress,message);adw_action_row_set_subtitle(u->row,message);}
  g_free(line);g_data_input_stream_read_line_async(stream,0,NULL,updates_line,u);
 }else g_subprocess_wait_async(u->process,NULL,updates_installed,u);
}
static void updates_download_response(P dialog,const char*response,Updates*u){
 (void)dialog; /* AdwMessageDialog closes itself after response. */
 if(strcmp(response,"install"))return;
 const char*worker=getenv("FAMILIARMAC_UPDATER");if(!worker||u->busy||!u->version)return;
 const char*argv[]={"/usr/bin/python3",worker,"--install",u->version,"--progress",NULL};P error=NULL;
 u->process=g_subprocess_newv(argv,FM_STDOUT_PIPE|FM_STDERR_MERGE,&error); /* stdout pipe, stderr merged */
 if(!u->process){adw_action_row_set_subtitle(u->row,"Could not start the update.");if(error)g_error_free(error);return;}
 u->busy=1;gtk_widget_set_sensitive(u->button,0);gtk_widget_set_visible(u->progress,1);
 gtk_progress_bar_set_fraction(u->progress,0);gtk_progress_bar_set_text(u->progress,"Preparing download…");
 u->stream=g_data_input_stream_new(g_subprocess_get_stdout_pipe(u->process));
 g_data_input_stream_read_line_async(u->stream,0,NULL,updates_line,updates_ref(u));
}
static void updates_confirm(Updates*u){
 if(!u->window||!gtk_widget_get_visible(u->window)||!u->version)return;
 char title[128];snprintf(title,sizeof(title),"Download FamiliarMac %s?",u->version);
 P dialog=adw_message_dialog_new(u->window,title,"The update will install automatically after downloading. Administrator authentication is needed for shared themes. Your desktop preferences are preserved; hardware repairs are excluded.");
 adw_message_dialog_add_response(dialog,"cancel","Not Now");adw_message_dialog_add_response(dialog,"install","Download & Install");
 adw_message_dialog_set_response_appearance(dialog,"install",1);adw_message_dialog_set_default_response(dialog,"install");adw_message_dialog_set_close_response(dialog,"cancel");
 g_signal_connect_data(dialog,"response",updates_download_response,updates_ref(u),updates_closure_free,0);gtk_window_present(dialog);
}
static void updates_checked(P process,P result,Updates*u){
 char*out=NULL,*err=NULL;P error=NULL;
 int ok=g_subprocess_communicate_utf8_finish(process,result,&out,&err,&error);
 ok=ok&&g_subprocess_get_successful(process);
 if(ok&&g_subprocess_get_successful(process)&&out){
  char*message=strchr(out,'\n');
  if(message){
   *message++=0;adw_preferences_row_set_title(u->row,out);
   char*offered=strchr(message,'\n');if(offered){*offered++=0;offered[strcspn(offered,"\r\n")]=0;}
   adw_action_row_set_subtitle(u->row,message);free(u->version);u->version=offered&&*offered?strdup(offered):NULL;
  }
 }else adw_action_row_set_subtitle(u->row,"Unable to check. Try again when connected.");
 if(out)g_free(out);
 if(err)g_free(err);
 if(error)g_error_free(error);
 g_object_unref(process);updates_ready(u);
 if(ok&&u->ask&&u->version)updates_confirm(u);
 updates_unref(u);
}
static void updates_check(Updates*u,int force,int ask){
 const char*worker=getenv("FAMILIARMAC_UPDATER");if(!worker||u->busy)return;
 const char*argv[]={"/usr/bin/python3",worker,"--check","--panel",force?"--force":NULL,NULL};P error=NULL;
 P process=g_subprocess_newv(argv,FM_STDOUT_PIPE|FM_STDERR_PIPE,&error);
 if(process){u->busy=1;u->ask=ask;gtk_widget_set_sensitive(u->button,0);adw_action_row_set_subtitle(u->row,"Checking for updates…");g_subprocess_communicate_utf8_async(process,NULL,NULL,updates_checked,updates_ref(u));}
 else adw_action_row_set_subtitle(u->row,"Update checker unavailable.");
 if(error)g_error_free(error);
}
static void updates_clicked(P button,Updates*u){(void)button;if(u->version)updates_confirm(u);else updates_check(u,1,1);}
static void check_updates(P window){Updates*u=g_object_get_data(window,"fm-updates");if(u)updates_check(u,0,0);}
static void updates_attach(P window,P builder,P page){
 P row=gtk_builder_get_object(builder,"release_status"),progress=gtk_builder_get_object(builder,"release_progress"),button=find(page,"GtkButton","fm-check-updates");
 if(!row||!progress||!button)return;
 Updates*u=calloc(1,sizeof(*u));u->refs=1;u->window=window;u->row=g_object_ref(row);u->button=g_object_ref(button);u->progress=g_object_ref(progress);
 g_object_add_weak_pointer(window,&u->window);g_object_set_data_full(window,"fm-updates",u,updates_unref);
 g_signal_connect_data(button,"clicked",updates_clicked,u,NULL,0);updates_check(u,0,0);
}
