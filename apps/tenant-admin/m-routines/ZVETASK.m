ZVETASK ; Local TaskMan helpers
 ; Thin wrappers for deterministic TaskMan startup and status checks.
 ;
START ; Launch TaskMan through the Kernel-supported startup entrypoint.
 D ENSURECFG
 D START^ZTMB
 Q
 ;
STATUS ; Report whether TaskMan advertised itself as running.
 N RUN,Y,PAIR,REC,MODE,BASE,BASEREC,VREC
 S U="^"
 S RUN=$G(^%ZTSCH("RUN"))
 D GETENV^%ZOSV
 S VREC=$G(^%ZIS(14.5,+$O(^%ZIS(14.5,"B",$P(Y,U,2),0)),0))
 S PAIR=$P(Y,U,4)
 S REC=$G(^%ZIS(14.7,+$O(^%ZIS(14.7,"B",PAIR,0)),0))
 S MODE=$P(REC,U,9)
 S BASE=$P(PAIR,":")
 S BASEREC=$G(^%ZIS(14.7,+$O(^%ZIS(14.7,"B",BASE,0)),0))
 W "VOLRECORD^",VREC,!
 W "PAIR^",PAIR,!
 W "MODE^",MODE,!
 W "RECORD^",REC,!
 W "BASEPAIR^",BASE,!
 W "BASERECORD^",BASEREC,!
 I RUN="" W "STOPPED",! Q
 W "RUNNING^",RUN,!
 Q
 ;
ENSURECFG ; Ensure the local runtime has TaskMan site records for the resolved pair.
 N Y,VOL,PAIR
 S U="^"
 D GETENV^%ZOSV
 S VOL=$P(Y,U,2),PAIR=$P(Y,U,4)
 D ENSUREVOL(VOL)
 D ENSUREPAIR(PAIR,VOL)
 Q
 ;
ENSUREVOL(VOL) ; Ensure file 14.5 exists for the active volume set.
 Q:$O(^%ZIS(14.5,"B",VOL,0))>0
 N FDA,ERR
 S FDA(14.5,"+1,",.01)=VOL
 S FDA(14.5,"+1,",.1)="GENERAL PURPOSE VOLUME SET"
 S FDA(14.5,"+1,",1)="NO"
 S FDA(14.5,"+1,",3)="NO"
 S FDA(14.5,"+1,",4)="NO"
 S FDA(14.5,"+1,",5)=$P($G(^%ZOSF("MGR")),U)
 S FDA(14.5,"+1,",8)=0
 S FDA(14.5,"+1,",9)="YES"
 D UPDATE^DIE("E",$NA(FDA),"",$NA(ERR))
 Q
 ;
ENSUREPAIR(PAIR,VOL) ; Ensure file 14.7 exists for the active box-volume pair.
 Q:$O(^%ZIS(14.7,"B",PAIR,0))>0
 N FDA,ERR
 S FDA(14.7,"+1,",.01)=PAIR
 S FDA(14.7,"+1,",5)=0
 S FDA(14.7,"+1,",6)=.80*$$KRNMAXJ^KBANTCLN(VOL)\1
 S FDA(14.7,"+1,",7)=0
 S FDA(14.7,"+1,",8)="G"
 S FDA(14.7,"+1,",11)=0
 S FDA(14.7,"+1,",31)=1
 S FDA(14.7,"+1,",32)=1
 D UPDATE^DIE("",$NA(FDA),"",$NA(ERR))
 Q