ZVEWRDM ;VE/KM - Ward Management RPCs (FileMan-compliant);2026-03-22
 ;;1.0;VistA-Evolved Tenant Admin;**2**;Mar 22, 2026;Build 2
 ;
 ; RPC for ward rename in File 42 (WARD LOCATION).
 ; Uses ^DIE (classic FileMan editor) for editing.
 ;
 Q
 ;
EDIT(RESULT,P1,P2) ;
 ; P1=ward IEN, P2=new name — renames via ^DIE
 N WIEN,NEWNAME,OLDNAME,DIE,DA,DR,DUZ0SAVE
 S WIEN=+$G(P1)
 S NEWNAME=$G(P2)
 I WIEN<1 S RESULT(0)="-1^Ward IEN required" Q
 I NEWNAME="" S RESULT(0)="-1^New name required" Q
 I '$D(^DIC(42,WIEN,0)) S RESULT(0)="-1^Ward IEN "_WIEN_" not found" Q
 I $D(^DIC(42,"B",NEWNAME)) S RESULT(0)="-1^Ward name already in use" Q
 ;
 S OLDNAME=$P(^DIC(42,WIEN,0),U,1)
 S DUZ0SAVE=$G(DUZ(0))
 S DUZ(0)="@"
 S DIE="^DIC(42,",DA=WIEN,DR=".01///"_NEWNAME
 D ^DIE
 S DUZ(0)=DUZ0SAVE
 ;
 N CURNAME S CURNAME=$P($G(^DIC(42,WIEN,0)),U,1)
 I CURNAME=NEWNAME S RESULT(0)="1^Ward "_WIEN_" renamed to "_NEWNAME Q
 S RESULT(0)="-1^FileMan ^DIE failed to rename ward"
 Q
 ;
INSTALL ;
 D REGONE("ZVE WRDM EDIT","EDIT","ZVEWRDM","Rename ward in File 42")
 W !,"ZVEWRDM installed.",!
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
