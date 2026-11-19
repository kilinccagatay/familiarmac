/* Controlled animated client for comparing compositor paths. No media/network. */
#include <gtk/gtk.h>
#include <epoxy/gl.h>
#include <math.h>
static guint draws;
static gint64 started, last_report;
static gboolean render(GtkGLArea *area,GdkGLContext *context,gpointer data){
  int scale=gtk_widget_get_scale_factor(GTK_WIDGET(area));
  int w=gtk_widget_get_allocated_width(GTK_WIDGET(area))*scale;
  int h=gtk_widget_get_allocated_height(GTK_WIDGET(area))*scale;
  double seconds=(g_get_monotonic_time()-started)/1000000.0;
  glViewport(0,0,w,h);glDisable(GL_SCISSOR_TEST);
  glClearColor(.08,.18,.32,1);glClear(GL_COLOR_BUFFER_BIT);
  glEnable(GL_SCISSOR_TEST);
  for(int i=0;i<12;i++){
    int x=(int)((sin(seconds*1.3+i*.4)+1)*.5*(w-w/8));
    glScissor(x,i*h/12,w/8,MAX(1,h/14));
    glClearColor(.2+.06*i,.7-.03*i,.35+.04*i,1);glClear(GL_COLOR_BUFFER_BIT);
  }
  glDisable(GL_SCISSOR_TEST);draws++;
  gint64 now=g_get_monotonic_time();
  if(now-last_report>5000000){g_print("draws=%u elapsed=%.3f width=%d height=%d\n",draws,(now-started)/1000000.0,w,h);last_report=now;}
  return TRUE;
}
static gboolean tick(GtkWidget *w,GdkFrameClock *clock,gpointer data){gtk_gl_area_queue_render(GTK_GL_AREA(w));return G_SOURCE_CONTINUE;}
int main(int argc,char **argv){
 gtk_init(&argc,&argv);g_set_prgname("fm-native-rounding-test");
 GtkWidget *window=gtk_window_new(GTK_WINDOW_TOPLEVEL);
 gtk_window_set_title(GTK_WINDOW(window),"FamiliarMac — Native Rounding Test");
 gtk_window_set_default_size(GTK_WINDOW(window),820,500);
 GtkWidget *area=gtk_gl_area_new();gtk_gl_area_set_auto_render(GTK_GL_AREA(area),FALSE);
 gtk_container_add(GTK_CONTAINER(window),area);g_signal_connect(area,"render",G_CALLBACK(render),NULL);
 g_signal_connect(window,"destroy",G_CALLBACK(gtk_main_quit),NULL);
 started=last_report=g_get_monotonic_time();gtk_widget_add_tick_callback(area,tick,NULL,NULL);
 gtk_widget_show_all(window);gtk_main();return 0;
}
