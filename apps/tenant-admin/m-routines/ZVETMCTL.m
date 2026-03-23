ZVETMCTL ;VE/KM - TaskMan Control;2026-03-22
 ;;1.0;VistA-Evolved Tenant Admin;**1**;Mar 22, 2026;Build 1
 ;
 ; Exposes TaskMan status, task detail, and control as RPCs.
 ;
 ; Entry points:
 ;   D STATUS^ZVETMCTL  - Check if TaskMan is running
 ;   D DETAIL^ZVETMCTL  - Get task detail by IEN
 ;   D TASKS^ZVETMCTL   - List scheduled tasks
 ;
 Q
 ;
STATUS(RESULT) ;
 ; Check TaskMan status via %ZTLOAD globals
 N RUNNING,LASTRUN,TMNODE
 S RUNNING=0
 S TMNODE=$G(^%ZTSCH("TASK MANAGER"))
 I TMNODE'="" S RUNNING=1
 S LASTRUN=$G(^%ZTSCH("LASTRUN"))
 S RESULT(0)="1^"_$S(RUNNING:"RUNNING",1:"STOPPED")_U_LASTRUN
 Q
 ;
DETAIL(RESULT,P1) ;
 ; P1 = task IEN (File 14.4)
 N TIEN,NODE0,NODE2
 S TIEN=+P1
 I TIEN<1 S RESULT(0)="-1^Invalid task IEN" Q
 I '$D(^%ZTSK(TIEN)) S RESULT(0)="-1^Task not found" Q
 ;
 S NODE0=$G(^%ZTSK(TIEN,0))
 S NODE2=$G(^%ZTSK(TIEN,2))
 ; node0: name^startTime^...
 ; node2: status^completionTime^...
 S RESULT(0)="1^OK"
 S RESULT(1)="NAME^"_$P(NODE0,U,1)
 S RESULT(2)="START^"_$P(NODE0,U,2)
 S RESULT(3)="VOLUME^"_$P(NODE0,U,3)
 S RESULT(4)="STATUS^"_$P(NODE2,U,1)
 S RESULT(5)="COMPLETION^"_$P(NODE2,U,2)
 S RESULT(6)="ROUTINE^"_$P(NODE0,U,5)
 Q
 ;
TASKS(RESULT) ;
 ; List scheduled tasks from ^%ZTSK
 N TIEN,CNT,NODE0,NM
 S CNT=0,TIEN=0
 F  S TIEN=$O(^%ZTSK(TIEN)) Q:TIEN'>0!(CNT>500)  D
 . S NODE0=$G(^%ZTSK(TIEN,0)) Q:NODE0=""
 . S NM=$P(NODE0,U,1) Q:NM=""
 . S CNT=CNT+1
 . S RESULT(CNT)=TIEN_U_NM_U_$P(NODE0,U,2)_U_$P(NODE0,U,5)_U_$P($G(^%ZTSK(TIEN,2)),U,1)
 S RESULT(0)="1^OK^"_CNT
 Q
 ;
INSTALL ;
 D REGONE("ZVE TASKMAN STATUS","STATUS","ZVETMCTL","Check if TaskMan is running")
 D REGONE("ZVE TASKMAN DETAIL","DETAIL","ZVETMCTL","Get task detail by IEN")
 D REGONE("ZVE TASKMAN TASKS","TASKS","ZVETMCTL","List scheduled tasks")
 W !,"ZVETMCTL installed.",!
 Q
 ;
REGONE(NAME,TAG,RTN,DESC) ;
 N IEN,FDA,IENS,ERRS
 S IEN=$$FIND1^DIC(8994,,"BX",NAME)
 I IEN>0 W !,"RPC '"_NAME_"' already registered, skipping." Q
 S IENS="+1,"
 S FDA(8994,IENS,.01)=NAME
 S FDA(8994,IENS,.02)=TAG
 S FDA(8994,IENS,.03)=RTN
 S FDA(8994,IENS,.04)=2
 D UPDATE^DIE("E","FDA","","ERRS")
 I $D(ERRS) W !,"ERROR: ",$G(ERRS("DIERR",1,"TEXT",1)) Q
 S IEN=$$FIND1^DIC(8994,,"BX",NAME)
 W !,"Registered "_NAME_" (IEN="_IEN_")"
 I IEN>0 S ^XTV(8994,IEN,1,1,0)=DESC,^XTV(8994,IEN,1,0)="^^1^1^"_$$DT^XLFDT()
 Q
