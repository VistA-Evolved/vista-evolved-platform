ZVECLNM ;VE/KM - Clinic Name Management RPCs (FileMan-compliant);2026-03-22
 ;;1.0;VistA-Evolved Tenant Admin;**2**;Mar 22, 2026;Build 2
 ;
 ; RPCs for clinic creation and rename in File 44 (HOSPITAL LOCATION).
 ; Uses UPDATE^DIE for creation and ^DIE for editing — standard FileMan APIs.
 ;
 Q
 ;
ADD(RESULT,P1) ;
 ; P1=clinic name — creates a new clinic via UPDATE^DIE (FileMan DBS API)
 ; File 44 requires .01 (name), 2 (type code), and 2.1 (type extension ptr)
 N CNAME,DUZ0SAVE,FDA,ERRS,IEN3
 S CNAME=$G(P1)
 I CNAME="" S RESULT(0)="-1^Clinic name required" Q
 I $D(^SC("B",CNAME)) S RESULT(0)="-1^Clinic name already exists" Q
 ;
 S DUZ0SAVE=$G(DUZ(0))
 S DUZ(0)="@"
 K FDA,ERRS S IEN3(1)=""
 S FDA(44,"+1,",.01)=CNAME
 S FDA(44,"+1,",2)="C"
 S FDA(44,"+1,",2.1)=1
 D UPDATE^DIE(,"FDA","IEN3","ERRS")
 S DUZ(0)=DUZ0SAVE
 ;
 I $D(ERRS) S RESULT(0)="-1^"_$G(ERRS("DIERR",1,"TEXT",1),"FileMan UPDATE^DIE failed") Q
 S RESULT(0)="1^"_$G(IEN3(1))
 S RESULT(1)="Created clinic '"_CNAME_"' IEN="_$G(IEN3(1))
 Q
 ;
EDIT(RESULT,P1,P2) ;
 ; P1=clinic IEN, P2=new name — renames via ^DIE
 N CIEN,NEWNAME,OLDNAME,DIE,DA,DR,DUZ0SAVE
 S CIEN=+$G(P1)
 S NEWNAME=$G(P2)
 I CIEN<1 S RESULT(0)="-1^Clinic IEN required" Q
 I NEWNAME="" S RESULT(0)="-1^New name required" Q
 I '$D(^SC(CIEN,0)) S RESULT(0)="-1^Clinic IEN "_CIEN_" not found" Q
 I $D(^SC("B",NEWNAME)) S RESULT(0)="-1^Clinic name already in use" Q
 ;
 S OLDNAME=$P(^SC(CIEN,0),U,1)
 S DUZ0SAVE=$G(DUZ(0))
 S DUZ(0)="@"
 S DIE="^SC(",DA=CIEN,DR=".01///"_NEWNAME
 D ^DIE
 S DUZ(0)=DUZ0SAVE
 ;
 N CURNAME S CURNAME=$P($G(^SC(CIEN,0)),U,1)
 I CURNAME=NEWNAME S RESULT(0)="1^Clinic "_CIEN_" renamed to "_NEWNAME Q
 S RESULT(0)="-1^FileMan ^DIE failed to rename clinic"
 Q
 ;
INSTALL ;
 D REGONE("ZVE CLNM ADD","ADD","ZVECLNM","Create clinic in File 44")
 D REGONE("ZVE CLNM EDIT","EDIT","ZVECLNM","Rename clinic in File 44")
 W !,"ZVECLNM installed.",!
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
 Q
