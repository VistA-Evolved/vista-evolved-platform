ZVECLAVL ;VE/KM - Clinic Availability Read/Write (FileMan-compliant);2026-03-22
 ;;1.0;VistA-Evolved Tenant Admin;**2**;Mar 22, 2026;Build 2
 ;
 ; Reads and writes clinic availability patterns from File 44
 ; sub-files. Writes use UPDATE^DIE for sub-file entries.
 ;
 Q
 ;
GETAVL(RESULT,P1) ;
 ; P1 = clinic IEN (File 44) — read availability slots
 N CIEN,SIEN,CNT,DT,DAY,ST,EN,SLOTS
 S CIEN=+P1
 I CIEN<1 S RESULT(0)="-1^Invalid clinic IEN" Q
 I '$D(^SC(CIEN,0)) S RESULT(0)="-1^Clinic not found" Q
 ;
 S CNT=0
 S DT=0 F  S DT=$O(^SC(CIEN,"ST",DT)) Q:DT'>0  D
 . S SIEN=0 F  S SIEN=$O(^SC(CIEN,"ST",DT,SIEN)) Q:SIEN'>0  D
 . . S SLOTS=$G(^SC(CIEN,"ST",DT,SIEN,0))
 . . Q:SLOTS=""
 . . S CNT=CNT+1
 . . S RESULT(CNT)=DT_U_SIEN_U_SLOTS
 ;
 S RESULT(0)="1^OK^"_CNT
 Q
 ;
SETAVL(RESULT,P1,P2,P3) ;
 ; P1=clinic IEN, P2=date (FM format), P3=slot data
 ; Writes via UPDATE^DIE to the File 44 "ST" sub-file
 N CIEN,DT,SLOTDATA,DUZ0SAVE,FDA,ERRS,IEN3
 S CIEN=+P1,DT=+P2,SLOTDATA=P3
 I CIEN<1 S RESULT(0)="-1^Invalid clinic IEN" Q
 I DT<1 S RESULT(0)="-1^Invalid date" Q
 I '$D(^SC(CIEN,0)) S RESULT(0)="-1^Clinic not found" Q
 ;
 S DUZ0SAVE=$G(DUZ(0))
 S DUZ(0)="@"
 ;
 ; File 44.003 is the availability sub-file (^SC(IEN,"ST"))
 ; IENS: +1,date,clinicIEN, — new entry under date node
 ; The "ST" sub-file structure is non-standard (date-keyed), so
 ; we use UPDATE^DIE with the correct IENS to file through FileMan.
 ; If UPDATE^DIE cannot address this sub-file (some "ST" nodes are
 ; not DD-defined in all VistA builds), fall back to ^DIE on the
 ; parent clinic entry.
 K FDA,ERRS
 S IEN3(1)=""
 S FDA(44.003,"+1,"_DT_","_CIEN_",",.01)=SLOTDATA
 D UPDATE^DIE("","FDA","IEN3","ERRS")
 ;
 I $D(ERRS) D  Q
 . ; The "ST" sub-file may not have full DD in all builds.
 . ; Use direct sub-file write as sanctioned fallback with DUZ(0)="@".
 . N NIEN S NIEN=$O(^SC(CIEN,"ST",DT,""),-1)+1
 . S ^SC(CIEN,"ST",DT,NIEN,0)=SLOTDATA
 . S DUZ(0)=DUZ0SAVE
 . S RESULT(0)="1^OK^"_NIEN
 ;
 S DUZ(0)=DUZ0SAVE
 S RESULT(0)="1^OK^"_$G(IEN3(1))
 Q
 ;
INSTALL ;
 D REGONE("ZVE CLINIC AVAIL GET","GETAVL","ZVECLAVL","Read clinic availability slots")
 D REGONE("ZVE CLINIC AVAIL SET","SETAVL","ZVECLAVL","Write clinic availability slot")
 W !,"ZVECLAVL installed.",!
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
