ZVEUCLONE ;VE/KM - User Profile Clone (FileMan-compliant);2026-03-22
 ;;1.0;VistA-Evolved Tenant Admin;**2**;Mar 22, 2026;Build 2
 ;
 ; Clones security keys and secondary menu options from a source
 ; user (DUZ) to a target user. Uses $$ADD^XQKEY for keys and
 ; UPDATE^DIE for secondary menu options (File 200 sub-file 200.03).
 ;
 Q
 ;
CLONE(RESULT,P1,P2) ;
 ; P1=sourceDuz, P2=targetDuz
 N SDUZ,TDUZ,KEY,KIEN,KNAME,CNT,MCNT,MNU,MIEN,%,DUZ0SAVE
 N FDA,ERRS,NIEN
 S SDUZ=+P1,TDUZ=+P2
 I SDUZ<1!(TDUZ<1) S RESULT(0)="-1^Invalid DUZ values" Q
 I '$D(^VA(200,SDUZ,0)) S RESULT(0)="-1^Source user not found" Q
 I '$D(^VA(200,TDUZ,0)) S RESULT(0)="-1^Target user not found" Q
 ;
 S DUZ0SAVE=$G(DUZ(0))
 S DUZ(0)="@"
 ;
 ; Clone security keys via $$ADD^XQKEY (Kernel API)
 S CNT=0
 S KIEN=0 F  S KIEN=$O(^VA(200,SDUZ,51,KIEN)) Q:KIEN'>0  D
 . S KEY=$P($G(^VA(200,SDUZ,51,KIEN,0)),U,1) Q:KEY=""
 . ; Resolve key name from IEN
 . S KNAME=$P($G(^DIC(19.1,KEY,0)),U,1) Q:KNAME=""
 . ; $$ADD^XQKEY returns 1 on success, 0 if already held
 . S %=$$ADD^XQKEY(TDUZ,KNAME)
 . S:% CNT=CNT+1
 ;
 ; Clone secondary menu options (File 200.03) via FILE^DIE
 S MCNT=0
 S MIEN=0 F  S MIEN=$O(^VA(200,SDUZ,203,MIEN)) Q:MIEN'>0  D
 . S MNU=$P($G(^VA(200,SDUZ,203,MIEN,0)),U,1) Q:MNU=""
 . ; Check if target already has this menu
 . N EXISTS S EXISTS=0
 . N TMNU S TMNU=0 F  S TMNU=$O(^VA(200,TDUZ,203,TMNU)) Q:TMNU'>0  D
 . . I $P($G(^VA(200,TDUZ,203,TMNU,0)),U,1)=MNU S EXISTS=1
 . I EXISTS Q
 . ; Add via FILE^DIE using sub-file 200.03 IENS format
 . K FDA,ERRS
 . S NIEN=$O(^VA(200,TDUZ,203,""),-1)+1
 . S FDA(200.03,"+"_NIEN_","_TDUZ_",",.01)=MNU
 . D UPDATE^DIE("","FDA","","ERRS")
 . I '$D(ERRS) S MCNT=MCNT+1
 ;
 S DUZ(0)=DUZ0SAVE
 S RESULT(0)="1^OK^"_CNT_"^"_MCNT
 Q
 ;
INSTALL ;
 D REGONE("ZVE USER CLONE","CLONE","ZVEUCLONE","Clone keys and menus from source to target user")
 W !,"ZVEUCLONE installed.",!
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
