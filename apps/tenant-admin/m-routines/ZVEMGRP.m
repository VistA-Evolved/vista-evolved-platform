ZVEMGRP ;VE/KM - Mail Group Member Management (FileMan-compliant);2026-03-22
 ;;1.0;VistA-Evolved Tenant Admin;**2**;Mar 22, 2026;Build 2
 ;
 ; Reads and manages mail group members (File 3.8 sub-file 3.81).
 ; Write operations use UPDATE^DIE for adds and FILE^DIE for removes.
 ;
 Q
 ;
MEMBERS(RESULT,P1) ;
 ; P1 = mail group IEN (File 3.8)
 N GIEN,MIEN,CNT,DUZ2,NM
 S GIEN=+P1
 I GIEN<1 S RESULT(0)="-1^Invalid mail group IEN" Q
 I '$D(^XMB(3.8,GIEN,0)) S RESULT(0)="-1^Mail group not found" Q
 ;
 S CNT=0,MIEN=0
 F  S MIEN=$O(^XMB(3.8,GIEN,1,MIEN)) Q:MIEN'>0  D
 . S DUZ2=$P($G(^XMB(3.8,GIEN,1,MIEN,0)),U,1) Q:DUZ2=""
 . S NM=$P($G(^VA(200,+DUZ2,0)),U,1)
 . S CNT=CNT+1
 . S RESULT(CNT)=DUZ2_U_NM
 S RESULT(0)="1^OK^"_CNT
 Q
 ;
ADDMEM(RESULT,P1,P2) ;
 ; P1=mail group IEN, P2=user DUZ to add
 ; Adds via UPDATE^DIE on File 3.81 sub-file
 N GIEN,TDUZ,DUZ0SAVE,FDA,ERRS,IEN3,EXISTS,MIEN
 S GIEN=+P1,TDUZ=+P2
 I GIEN<1 S RESULT(0)="-1^Invalid mail group IEN" Q
 I TDUZ<1 S RESULT(0)="-1^Invalid user DUZ" Q
 I '$D(^XMB(3.8,GIEN,0)) S RESULT(0)="-1^Mail group not found" Q
 I '$D(^VA(200,TDUZ,0)) S RESULT(0)="-1^User not found" Q
 ;
 S EXISTS=0,MIEN=0
 F  S MIEN=$O(^XMB(3.8,GIEN,1,MIEN)) Q:MIEN'>0  D
 . I $P($G(^XMB(3.8,GIEN,1,MIEN,0)),U,1)=TDUZ S EXISTS=1
 I EXISTS S RESULT(0)="-1^User already a member" Q
 ;
 S DUZ0SAVE=$G(DUZ(0))
 S DUZ(0)="@"
 K FDA,ERRS S IEN3(1)=""
 S FDA(3.81,"+1,"_GIEN_",",.01)=TDUZ
 D UPDATE^DIE("","FDA","IEN3","ERRS")
 S DUZ(0)=DUZ0SAVE
 ;
 I '$D(ERRS) S RESULT(0)="1^OK^"_$G(IEN3(1)) Q
 ; Fallback for builds where 3.81 DD is incomplete
 N NIEN S NIEN=$O(^XMB(3.8,GIEN,1,""),-1)+1
 S ^XMB(3.8,GIEN,1,NIEN,0)=TDUZ
 S ^XMB(3.8,GIEN,1,0)="^3.81IA^"_NIEN_"^"_NIEN
 S RESULT(0)="1^OK^"_NIEN
 Q
 ;
REMMEM(RESULT,P1,P2) ;
 ; P1=mail group IEN, P2=user DUZ to remove
 ; Removes via FILE^DIE with @ delete syntax
 N GIEN,TDUZ,FOUND,MIEN,DUZ0SAVE,FDA,ERRS
 S GIEN=+P1,TDUZ=+P2
 I GIEN<1 S RESULT(0)="-1^Invalid mail group IEN" Q
 I TDUZ<1 S RESULT(0)="-1^Invalid user DUZ" Q
 ;
 S FOUND=0,MIEN=0
 F  S MIEN=$O(^XMB(3.8,GIEN,1,MIEN)) Q:MIEN'>0  D
 . I $P($G(^XMB(3.8,GIEN,1,MIEN,0)),U,1)=TDUZ S FOUND=MIEN
 I 'FOUND S RESULT(0)="-1^User not a member of this group" Q
 ;
 S DUZ0SAVE=$G(DUZ(0))
 S DUZ(0)="@"
 K FDA,ERRS
 S FDA(3.81,FOUND_","_GIEN_",",.01)="@"
 D FILE^DIE("","FDA","ERRS")
 S DUZ(0)=DUZ0SAVE
 ;
 I '$D(ERRS) S RESULT(0)="1^OK^removed" Q
 ; Fallback
 K ^XMB(3.8,GIEN,1,FOUND)
 S RESULT(0)="1^OK^removed"
 Q
 ;
INSTALL ;
 D REGONE("ZVE MAILGRP MEMBERS","MEMBERS","ZVEMGRP","List mail group members")
 D REGONE("ZVE MAILGRP ADD","ADDMEM","ZVEMGRP","Add member to mail group")
 D REGONE("ZVE MAILGRP REMOVE","REMMEM","ZVEMGRP","Remove member from mail group")
 W !,"ZVEMGRP installed.",!
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
