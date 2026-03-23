ZVEHSCOMP ;VE/KM - Health Summary Component Management (FileMan-compliant);2026-03-22
 ;;1.0;VistA-Evolved Tenant Admin;**2**;Mar 22, 2026;Build 2
 ;
 ; Reads and manages health summary type components (File 142 sub-file 142.01).
 ; Write operations use UPDATE^DIE for adds and FILE^DIE for removes.
 ;
 Q
 ;
COMPS(RESULT,P1) ;
 ; P1 = health summary type IEN (File 142)
 N HSIEN,CIEN,CNT,COMP,SEQ
 S HSIEN=+P1
 I HSIEN<1 S RESULT(0)="-1^Invalid health summary type IEN" Q
 I '$D(^GMT(142,HSIEN,0)) S RESULT(0)="-1^Health summary type not found" Q
 ;
 S CNT=0,CIEN=0
 F  S CIEN=$O(^GMT(142,HSIEN,1,CIEN)) Q:CIEN'>0  D
 . S COMP=$P($G(^GMT(142,HSIEN,1,CIEN,0)),U,1) Q:COMP=""
 . S SEQ=$P($G(^GMT(142,HSIEN,1,CIEN,0)),U,2)
 . S CNT=CNT+1
 . S RESULT(CNT)=CIEN_U_COMP_U_SEQ
 S RESULT(0)="1^OK^"_CNT
 Q
 ;
ADDCOMP(RESULT,P1,P2,P3) ;
 ; P1=HS type IEN, P2=component IEN (File 142.1), P3=sequence#
 ; Adds via UPDATE^DIE on File 142.01 sub-file
 N HSIEN,COMPIEN,SEQ,DUZ0SAVE,FDA,ERRS,IEN3
 S HSIEN=+P1,COMPIEN=+P2,SEQ=+P3
 I HSIEN<1 S RESULT(0)="-1^Invalid HS type IEN" Q
 I COMPIEN<1 S RESULT(0)="-1^Invalid component IEN" Q
 ;
 S DUZ0SAVE=$G(DUZ(0))
 S DUZ(0)="@"
 K FDA,ERRS S IEN3(1)=""
 S FDA(142.01,"+1,"_HSIEN_",",.01)=COMPIEN
 I SEQ>0 S FDA(142.01,"+1,"_HSIEN_",",2)=SEQ
 D UPDATE^DIE("","FDA","IEN3","ERRS")
 S DUZ(0)=DUZ0SAVE
 ;
 I '$D(ERRS) S RESULT(0)="1^OK^"_$G(IEN3(1)) Q
 ; Fallback for builds where 142.01 DD is incomplete
 N NIEN S NIEN=$O(^GMT(142,HSIEN,1,""),-1)+1
 S ^GMT(142,HSIEN,1,NIEN,0)=COMPIEN_U_SEQ
 S ^GMT(142,HSIEN,1,0)="^142.01IA^"_NIEN_"^"_NIEN
 S RESULT(0)="1^OK^"_NIEN
 Q
 ;
REMCOMP(RESULT,P1,P2) ;
 ; P1=HS type IEN, P2=component sub-IEN to remove
 ; Removes via FILE^DIE with @ delete syntax
 N HSIEN,CIEN,DUZ0SAVE,FDA,ERRS
 S HSIEN=+P1,CIEN=+P2
 I HSIEN<1 S RESULT(0)="-1^Invalid HS type IEN" Q
 I CIEN<1 S RESULT(0)="-1^Invalid component sub-IEN" Q
 I '$D(^GMT(142,HSIEN,1,CIEN)) S RESULT(0)="-1^Component not found" Q
 ;
 S DUZ0SAVE=$G(DUZ(0))
 S DUZ(0)="@"
 K FDA,ERRS
 S FDA(142.01,CIEN_","_HSIEN_",",.01)="@"
 D FILE^DIE("","FDA","ERRS")
 S DUZ(0)=DUZ0SAVE
 ;
 I '$D(ERRS) S RESULT(0)="1^OK^removed" Q
 ; Fallback
 K ^GMT(142,HSIEN,1,CIEN)
 S RESULT(0)="1^OK^removed"
 Q
 ;
INSTALL ;
 D REGONE("ZVE HS COMPONENTS","COMPS","ZVEHSCOMP","List health summary type components")
 D REGONE("ZVE HS COMP ADD","ADDCOMP","ZVEHSCOMP","Add component to health summary type")
 D REGONE("ZVE HS COMP REMOVE","REMCOMP","ZVEHSCOMP","Remove component from health summary type")
 W !,"ZVEHSCOMP installed.",!
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
