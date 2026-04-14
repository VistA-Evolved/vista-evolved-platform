ZVECTXTA ;VE/KM - Add RPCs to OR CPRS GUI CHART context (FileMan-compliant);2026-03-22
 ;;1.0;VistA-Evolved Tenant Admin;**2**;Mar 22, 2026;Build 2
 ;
 ; Registers custom ZVE RPCs into the OR CPRS GUI CHART context (IEN 10989)
 ; File 19 sub-file 19.05 ("RPC" multiple). Uses UPDATE^DIE with
 ; DUZ(0)="@" for the sub-file append. Falls back to ^DIE-style direct
 ; sub-file write only if UPDATE^DIE fails (some builds have incomplete
 ; DD for File 19.05).
 ;
 Q
 ;
ADDALL ;
 N CTXIEN,RPCIEN,RPCNAME,DUZ0SAVE
 S CTXIEN=10989
 I '$D(^DIC(19,CTXIEN,0)) W !,"Context IEN 10989 not found" Q
 ;
 S DUZ0SAVE=$G(DUZ(0))
 S DUZ(0)="@"
 ;
 F RPCNAME="ZVE CLINIC AVAIL GET","ZVE CLINIC AVAIL SET","ZVE TASKMAN STATUS","ZVE TASKMAN DETAIL","ZVE TASKMAN TASKS","ZVE TASKMAN START","ZVE HL7 LINK STATUS","ZVE HL7 FILER STATUS","ZVE MAILGRP MEMBERS","ZVE MAILGRP ADD","ZVE MAILGRP REMOVE","ZVE HS COMPONENTS","ZVE HS COMP ADD","ZVE HS COMP REMOVE","ZVE USER CLONE","ZVE DEV CREATE","ZVE DEV TESTPRINT","ZVE DEV INFO","ZVE USMG KEYS","ZVE USMG ESIG","ZVE USMG CRED","ZVE USMG ADD","ZVE USMG DEACT","ZVE USMG REACT","ZVE USMG RENAME","ZVE CLNM ADD","ZVE CLNM EDIT","ZVE WRDM EDIT" D
 . S RPCIEN=$$FIND1^DIC(8994,,"BX",RPCNAME)
 . I RPCIEN<1 W !,"RPC '"_RPCNAME_"' not in File 8994, skipping." Q
 . ; Check if already in context
 . N FOUND,I S FOUND=0,I=0
 . F  S I=$O(^DIC(19,CTXIEN,"RPC",I)) Q:I'>0  D
 . . I $P($G(^DIC(19,CTXIEN,"RPC",I,0)),U,1)=RPCIEN S FOUND=1
 . I FOUND W !,"  "_RPCNAME_" already in context, skipping." Q
 . ; Try UPDATE^DIE for File 19.05 (the RPC sub-file)
 . N FDA,ERRS,IEN3
 . K FDA,ERRS
 . S IEN3(1)=""
 . S FDA(19.05,"+1,"_CTXIEN_",",.01)=RPCIEN
 . D UPDATE^DIE("","FDA","IEN3","ERRS")
 . I '$D(ERRS) D  Q
 . . W !,"  Added "_RPCNAME_" (RPC IEN="_RPCIEN_") via UPDATE^DIE"
 . ; Fallback: File 19.05 DD may not support UPDATE^DIE in all builds
 . N MAXIEN
 . S MAXIEN=$O(^DIC(19,CTXIEN,"RPC",""),-1)+1
 . S ^DIC(19,CTXIEN,"RPC",MAXIEN,0)=RPCIEN
 . S ^DIC(19,CTXIEN,"RPC","B",RPCIEN,MAXIEN)=""
 . W !,"  Added "_RPCNAME_" (RPC IEN="_RPCIEN_") via fallback at sub-IEN "_MAXIEN
 ;
 ; Update header node count
 N CT,I S CT=0,I=0
 F  S I=$O(^DIC(19,CTXIEN,"RPC",I)) Q:I'>0  S CT=CT+1
 S $P(^DIC(19,CTXIEN,"RPC",0),U,3)=CT
 S $P(^DIC(19,CTXIEN,"RPC",0),U,4)=CT
 ;
 S DUZ(0)=DUZ0SAVE
 W !,"Context updated. Total RPCs: "_CT
 Q
