#include "keyd.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
int main(int argc,char**argv){
 assert(argc==3);struct config c;assert(config_parse(&c,argv[1])==0);
 FILE*f=fopen(argv[2],"r");assert(f);char line[1024];int n=0;
 while(fgets(line,sizeof(line),f)){
  if(line[0]=='#'||line[0]=='['||line[0]=='\n')continue;
  line[strcspn(line,"\n")]=0;
  if(config_add_entry(&c,line)<0){fprintf(stderr,"Invalid application mapping: %s\n",line);return 1;}n++;
 }
 fclose(f);printf("All %d application mappings accepted by actual keyd parser PASS\n",n);
}
