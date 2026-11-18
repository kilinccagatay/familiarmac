/* Original vector gesture demonstrations. No input injection or preference writes.
 * Cairo draws at the widget's native scale; GTK's frame clock pauses when unmapped. */
/* ABI declarations keep the helper build independent of development headers,
 * like settings-panel.c. GTK already depends on the Cairo runtime. */
typedef struct _cairo cairo_t;
typedef struct _cairo_pattern cairo_pattern_t;
extern void cairo_set_source_rgba(cairo_t*,double,double,double,double),cairo_new_sub_path(cairo_t*);
extern void cairo_move_to(cairo_t*,double,double),cairo_line_to(cairo_t*,double,double);
extern void cairo_curve_to(cairo_t*,double,double,double,double,double,double),cairo_close_path(cairo_t*);
extern void cairo_fill(cairo_t*),cairo_fill_preserve(cairo_t*),cairo_stroke(cairo_t*),cairo_stroke_preserve(cairo_t*);
extern void cairo_set_line_width(cairo_t*,double),cairo_arc(cairo_t*,double,double,double,double,double);
extern void cairo_save(cairo_t*),cairo_restore(cairo_t*),cairo_clip(cairo_t*),cairo_paint(cairo_t*);
extern void cairo_translate(cairo_t*,double,double),cairo_scale(cairo_t*,double,double);
extern cairo_pattern_t*cairo_pattern_create_linear(double,double,double,double);
extern void cairo_pattern_add_color_stop_rgb(cairo_pattern_t*,double,double,double,double);
extern void cairo_set_source(cairo_t*,cairo_pattern_t*),cairo_pattern_destroy(cairo_pattern_t*);
extern void gtk_drawing_area_set_draw_func(P,void(*)(P,cairo_t*,int,int,P),P,void(*)(P));
extern unsigned gtk_widget_add_tick_callback(P,int(*)(P,P,P),P,void(*)(P));
extern long long gdk_frame_clock_get_frame_time(P);
extern P gtk_event_controller_motion_new(void),gtk_event_controller_focus_new(void),gtk_settings_get_default(void);
extern void gtk_widget_add_controller(P,P),gtk_widget_queue_draw(P),gtk_label_set_text(P,const char*);
extern const char*gtk_stack_get_visible_child_name(P);
extern unsigned adw_combo_row_get_selected(P);
enum {FM_TRACK,FM_SCROLL,FM_SECONDARY,FM_ZOOM,FM_PAGES,FM_SPACES,FM_MISSION};
typedef struct {P canvas,caption,tabs,secondary;int refs,kind,still;long long start,last;double phase;} MagicDemo;
typedef struct {MagicDemo*demo;int kind;} MagicDemoTarget;
static void md_unref(P data){MagicDemo*d=data;if(!--d->refs)free(d);}
static P md_ref(MagicDemo*d){d->refs++;return d;}
static void md_target_free(P data,P closure){(void)closure;MagicDemoTarget*t=data;md_unref(t->demo);free(t);}
static void md_closure_free(P data,P closure){(void)closure;md_unref(data);}
static const char*md_captions[]={
 "Tracking speed — move the mouse to move the pointer",
 "Natural scrolling — slide one finger up and down",
 "Secondary click — press the selected side",
 "Smart zoom — double-tap with one finger to zoom in and back out",
 "Swipe between pages — slide one finger left or right",
 "Full-screen apps — slide two fingers left or right",
 "Mission Control — double-tap with two fingers to see open windows"};
static void md_select(MagicDemo*d,int kind){
 if(d->kind==kind)return;
 d->kind=kind;d->start=0;d->phase=0;
 gtk_label_set_text(d->caption,md_captions[kind]);gtk_widget_queue_draw(d->canvas);
}
static void md_enter(P controller,double x,double y,P data){(void)controller;(void)x;(void)y;MagicDemoTarget*t=data;md_select(t->demo,t->kind);}
static void md_focus(P controller,P data){(void)controller;MagicDemoTarget*t=data;md_select(t->demo,t->kind);}
static void md_tab(P stack,P spec,P data){(void)spec;const char*name=gtk_stack_get_visible_child_name(stack);md_select(data,name&&!strcmp(name,"gestures")?FM_PAGES:FM_TRACK);}
static double md_ease(double x){if(x<0)return 0;if(x>1)return 1;return x*x*(3-2*x);}
static void md_color(cairo_t*c,unsigned rgb,double alpha){cairo_set_source_rgba(c,((rgb>>16)&255)/255.,((rgb>>8)&255)/255.,(rgb&255)/255.,alpha);}
static void md_round(cairo_t*c,double x,double y,double w,double h,double r){
 const double k=.55228475;
 cairo_new_sub_path(c);cairo_move_to(c,x+r,y);cairo_line_to(c,x+w-r,y);
 cairo_curve_to(c,x+w-r+k*r,y,x+w,y+r-k*r,x+w,y+r);cairo_line_to(c,x+w,y+h-r);
 cairo_curve_to(c,x+w,y+h-r+k*r,x+w-r+k*r,y+h,x+w-r,y+h);cairo_line_to(c,x+r,y+h);
 cairo_curve_to(c,x+r-k*r,y+h,x,y+h-r+k*r,x,y+h-r);cairo_line_to(c,x,y+r);
 cairo_curve_to(c,x,y+r-k*r,x+r-k*r,y,x+r,y);cairo_close_path(c);
}
static void md_rect(cairo_t*c,double x,double y,double w,double h,double r,unsigned col,double a){md_round(c,x,y,w,h,r);md_color(c,col,a);cairo_fill(c);}
static void md_dot(cairo_t*c,double x,double y,double r,unsigned col,double a){cairo_arc(c,x,y,r,0,6.2831853);md_color(c,col,a);cairo_fill(c);}
static void md_cursor(cairo_t*c,double x,double y){
 cairo_move_to(c,x,y);cairo_line_to(c,x+3,y+15);cairo_line_to(c,x+7,y+11);cairo_line_to(c,x+12,y+11);cairo_close_path(c);
 md_color(c,0xffffff,1);cairo_set_line_width(c,2);cairo_stroke_preserve(c);md_color(c,0x173253,1);cairo_fill(c);
}
static void md_page_content(cairo_t*c,double x,double y,int variant){
 md_rect(c,x+20,y+23,133,4,2,0xe4efff,.8);md_rect(c,x+20,y+32,208,3,1.5,0xe4efff,.4);
 const unsigned colors[]={0xa9a6ff,0x52d5eb,0xffbe4b};
 for(int i=0;i<3;i++){
  double cx=x+20+i*75;md_rect(c,cx,y+47,67,54,5,0x0b294c,1);
  int shape=(i+variant)%3;
  if(shape==0)md_dot(c,cx+33,y+74,17,colors[shape],1);
  else if(shape==1)md_rect(c,cx+17,y+58,32,32,5,colors[shape],1);
  else {cairo_move_to(c,cx+33,y+57);cairo_line_to(c,cx+14,y+90);cairo_line_to(c,cx+52,y+90);cairo_close_path(c);md_color(c,colors[shape],1);cairo_fill(c);}
  md_rect(c,cx,y+108,62,3,1.5,0xe4efff,.55);md_rect(c,cx,y+115,49,3,1.5,0xe4efff,.3);
 }
}
static void md_page(cairo_t*c,double x,double y,int variant){
 md_rect(c,x,y,260,128,6,0x12355f,1);md_rect(c,x,y,260,13,6,0x46678a,1);
 for(int i=0;i<3;i++)md_dot(c,x+8+i*7,y+6,1.8,0xe9f4ff,.65);
 md_page_content(c,x,y,variant);
}
static void md_draw(P area,cairo_t*c,int width,int height,P data){
 (void)area;MagicDemo*d=data;double p=d->phase;
 double scale=width/640.;if(height/180.<scale)scale=height/180.;
 cairo_translate(c,(width-640*scale)/2,(height-180*scale)/2);cairo_scale(c,scale,scale);
 double t=p*4.8,move=md_ease((t-.65)/1.1)-md_ease((t-2.85)/1.1);
 if(d->kind==FM_ZOOM||d->kind==FM_MISSION)move=md_ease((t-.95)/.65)-md_ease((t-3.15)/.65);
 md_rect(c,0,0,314,180,16,0xffffff,.055);
 double mx=d->kind==FM_TRACK?move*18:0;
 cairo_save(c);cairo_translate(c,mx,-mx*.3);
 md_round(c,124,23,66,135,32);md_color(c,0x30363b,1);cairo_fill_preserve(c);md_color(c,0xd9e0e6,1);cairo_set_line_width(c,2.5);cairo_stroke(c);
 md_rect(c,156,29,1,26,.5,0xffffff,.25);
 int fingers=d->kind==FM_SPACES||d->kind==FM_MISSION?2:1;
 double dx=0,dy=0,pulse=0;
 if(d->kind==FM_SCROLL)dy=12-move*38;
 if(d->kind==FM_PAGES||d->kind==FM_SPACES)dx=22-44*move;
 if(d->kind==FM_ZOOM||d->kind==FM_MISSION){
  for(int i=0;i<4;i++){double a=t-(i<2?.40+i*.33:2.60+(i-2)*.33);if(a>=0&&a<.25)pulse=1-a/.25;}
 }
 if(d->kind==FM_SECONDARY){dx=adw_combo_row_get_selected(d->secondary)==1?-15:15;pulse=move;}
 if(d->still&&(d->kind==FM_ZOOM||d->kind==FM_MISSION))pulse=.7;
 if(d->kind!=FM_TRACK)for(int i=0;i<fingers;i++){
  double x=157+dx+(fingers==2?(i?10:-10):0),y=67+dy;
  double alpha=(d->kind==FM_ZOOM||d->kind==FM_MISSION)?pulse:1;
  md_dot(c,x,y,13+5*pulse,0x0a84ff,(.13+.15*pulse)*alpha);md_dot(c,x,y,7.5,0x0a84ff,.9*alpha);
 }
 cairo_restore(c);
 /* Right: a miniature desktop, clipped independently from the mouse. */
 cairo_save(c);md_round(c,326,0,314,180,16);cairo_clip(c);
 cairo_pattern_t*g=cairo_pattern_create_linear(326,0,640,180);
 cairo_pattern_add_color_stop_rgb(g,0,.04,.51,1);cairo_pattern_add_color_stop_rgb(g,1,.06,.24,.55);cairo_set_source(c,g);cairo_paint(c);cairo_pattern_destroy(g);
 for(int i=0;i<7;i++)md_rect(c,338+i*15,7,i?10:6,2,1,0xffffff,.7);
 double z=d->kind==FM_ZOOM?1+.25*move:1;
 if(d->kind==FM_MISSION){
  /* Window previews spread out after the two taps; return after the next pair. */
  cairo_save(c);cairo_translate(c,353-8*move,26+22*move);cairo_scale(c,1-.54*move,1-.54*move);md_page(c,0,0,0);cairo_restore(c);
  cairo_save(c);cairo_translate(c,367+132*move,36+22*move);cairo_scale(c,.88-.44*move,.88-.44*move);md_page(c,0,0,1);cairo_restore(c);
  if(move>.02){md_rect(c,457,19,24,14,2,0xdceaff,move*.8);md_rect(c,486,19,24,14,2,0xdceaff,move*.4);}
 }else if(d->kind==FM_PAGES){
  /* Navigate inside one stationary browser: chrome, wallpaper and Dock stay put. */
  md_page(c,353,26,0);
  cairo_save(c);md_round(c,353,40,260,114,0);cairo_clip(c);
  md_color(c,0x12355f,1);cairo_paint(c);
  md_page_content(c,353-260*move,26,0);
  md_page_content(c,613-260*move,26,1);
  cairo_restore(c);
 }else if(d->kind==FM_SPACES){
  double distance=314;
  cairo_save(c);cairo_translate(c,353-distance*move,26);md_page(c,0,0,0);md_page(c,distance,0,1);cairo_restore(c);
 }else{
  cairo_save(c);md_round(c,353,26,260,128,6);cairo_clip(c);
  cairo_translate(c,483,90);cairo_scale(c,z,z);cairo_translate(c,-483,-90);
  md_page(c,353,26-(d->kind==FM_SCROLL?move*40:0),0);
  if(d->kind==FM_SCROLL)for(int i=0;i<4;i++)md_rect(c,373,155+i*9-move*40,190-i*15,3,1,0xe4efff,.5);
  cairo_restore(c);
 }
 if(d->kind==FM_SECONDARY&&move>.03){
  md_rect(c,482,72,100,65,6,0x263444,move*.98);
  for(int i=0;i<4;i++)md_rect(c,492,82+i*12,65-i*5,3,1,0xffffff,move*.75);
 }
 unsigned dock[]={0x49cafa,0xffcf43,0xfb6180,0x66dc8b,0xe7f0ff,0xa591eb,0x55c3ed};
 for(int i=0;i<7;i++)md_rect(c,427+i*17,163,13,12,3,dock[i],.95);
 if(d->kind==FM_TRACK)md_cursor(c,410+move*130,95-move*40);
 else if(d->kind==FM_SECONDARY)md_cursor(c,477,69);
 cairo_restore(c);
}
static int md_tick(P widget,P clock,P data){
 MagicDemo*d=data;long long now=gdk_frame_clock_get_frame_time(clock);
 if(now-d->last<33333)return 1;
 d->last=now;int animations=1;g_object_get(gtk_settings_get_default(),"gtk-enable-animations",&animations,NULL);
 d->still=!animations;
 if(!d->start)d->start=now;
 long long elapsed=(now-d->start)%4800000;
 double phase=animations?elapsed/4800000.:.42;
 if(d->phase!=phase){d->phase=phase;gtk_widget_queue_draw(widget);}
 return 1;
}
static void attach_magic_demo(P builder){
 P canvas=gtk_builder_get_object(builder,"fm_magic_demo");if(!canvas)return;
 MagicDemo*d=calloc(1,sizeof(*d));d->refs=1;d->kind=-1;d->canvas=canvas;
 d->caption=gtk_builder_get_object(builder,"fm_magic_demo_caption");d->tabs=gtk_builder_get_object(builder,"fm_magic_tabs");d->secondary=gtk_builder_get_object(builder,"fm_magic_secondary");
 gtk_drawing_area_set_draw_func(canvas,md_draw,d,md_unref);
 gtk_widget_add_tick_callback(canvas,md_tick,md_ref(d),md_unref);
 const char*rows[]={"fm_magic_speed_row","fm_magic_natural","fm_magic_secondary","fm_magic_zoom","fm_magic_pages","fm_magic_spaces","fm_magic_mission"};
 for(int i=0;i<7;i++){
  P row=gtk_builder_get_object(builder,rows[i]);if(!row)continue;
  P motion=gtk_event_controller_motion_new(),focus=gtk_event_controller_focus_new();
  MagicDemoTarget*a=calloc(1,sizeof(*a)),*b=calloc(1,sizeof(*b));a->demo=md_ref(d);b->demo=md_ref(d);a->kind=b->kind=i;
  g_signal_connect_data(motion,"enter",md_enter,a,md_target_free,0);
  g_signal_connect_data(focus,"enter",md_focus,b,md_target_free,0);
  gtk_widget_add_controller(row,motion);gtk_widget_add_controller(row,focus);
 }
 g_signal_connect_data(d->tabs,"notify::visible-child-name",md_tab,md_ref(d),md_closure_free,0);
 md_tab(d->tabs,NULL,d);
}
