/* Exercise the actual async GTK updater with an isolated fake worker. */
#include "../native/settings-panel.c"
#include <assert.h>
extern void adw_init(void);
extern P adw_action_row_new(void),gtk_button_new(void),gtk_progress_bar_new(void);
extern int g_main_context_iteration(P,int),gtk_widget_get_sensitive(P);
static void finish(Updates*u){while(u->busy)g_main_context_iteration(NULL,1);}
int main(void){
 adw_init();
 Updates*u=calloc(1,sizeof(*u));u->refs=1;
 u->row=g_object_ref(adw_action_row_new());u->button=g_object_ref(gtk_button_new());
 u->refresh=g_object_ref(gtk_button_new());u->progress=g_object_ref(gtk_progress_bar_new());
 u->version=strdup("1.2.6");
 updates_refresh_clicked(NULL,u);
 assert(u->busy&&!u->version&&!gtk_widget_get_sensitive(u->refresh));
 updates_refresh_clicked(NULL,u); /* busy checks cannot overlap */
 finish(u);assert(!strcmp(u->version,"1.2.8")&&gtk_widget_get_sensitive(u->refresh));
 setenv("FM_TEST_CHECK_FAIL","1",1);
 updates_clicked(NULL,u);finish(u);assert(!u->version); /* no stale download after network failure */
 unsetenv("FM_TEST_CHECK_FAIL");
 updates_clicked(NULL,u);finish(u);assert(!strcmp(u->version,"1.2.8"));
 updates_download_response(NULL,"install",u);finish(u);
 assert(!u->version&&gtk_widget_get_sensitive(u->button)&&gtk_widget_get_sensitive(u->refresh));
 updates_refresh_clicked(NULL,u);finish(u);assert(!strcmp(u->version,"1.2.8"));
 updates_unref(u);puts("Native updater: force-refresh, busy guard, stale/network/install failure recovery PASS");
}
