ZVEUSMG ;VE/KM - User Management RPCs (FileMan-compliant);2026-03-22
 ;;1.0;VistA-Evolved Tenant Admin;**2**;Mar 22, 2026;Build 2
 ;
 ; RPCs for user key management, creation, deactivation, reactivation,
 ; and name editing. All write operations use sanctioned FileMan APIs
 ; (^DIC LAYGO, ^DIE) and Kernel APIs ($$ADD^XQKEY, $$DEL^XQKEY).
 ;
 Q
 ;
KEYS(RESULT,P1,P2,P3) ;
 ; P1=action (ADD|DEL), P2=target DUZ, P3=key name
 N ACTION,TDUZ,KNAME,KIEN,%
 S ACTION=$P($G(P1),U,1)
 S TDUZ=+$G(P2)
 S KNAME=$G(P3)
 I ACTION=""!(TDUZ<1)!(KNAME="") S RESULT(0)="-1^Missing params: action, DUZ, keyName" Q
 I '$D(^VA(200,TDUZ,0)) S RESULT(0)="-1^User DUZ "_TDUZ_" not found" Q
 ;
 S KIEN=$O(^DIC(19.1,"B",KNAME,""))
 I KIEN<1 S RESULT(0)="-1^Key '"_KNAME_"' not found in File 19.1" Q
 ;
 I ACTION="ADD" D  Q
 . S %=$$ADD^XQKEY(TDUZ,KNAME)
 . I % S RESULT(0)="1^Key "_KNAME_" added to DUZ "_TDUZ Q
 . ; $$ADD^XQKEY returns 0 if key already held or allocation failed
 . I $D(^XUSEC(KNAME,TDUZ)) S RESULT(0)="0^Key "_KNAME_" already assigned to DUZ "_TDUZ Q
 . S RESULT(0)="-1^Failed to allocate key "_KNAME_" to DUZ "_TDUZ
 ;
 I ACTION="DEL" D  Q
 . I '$D(^XUSEC(KNAME,TDUZ)) S RESULT(0)="0^Key "_KNAME_" not assigned to DUZ "_TDUZ Q
 . S %=$$DEL^XQKEY(TDUZ,KNAME)
 . I % S RESULT(0)="1^Key "_KNAME_" removed from DUZ "_TDUZ Q
 . ; $$DEL^XQKEY returns 0 for PROVIDER key (Kernel protection)
 . I KNAME="PROVIDER" S RESULT(0)="-1^PROVIDER key is protected by VistA Kernel and cannot be removed via $$DEL^XQKEY" Q
 . S RESULT(0)="-1^Failed to remove key "_KNAME_" from DUZ "_TDUZ
 ;
 S RESULT(0)="-1^Unknown action: "_ACTION_" (use ADD or DEL)"
 Q
 ;
ESIG(RESULT,P1,P2) ;
 ; P1=DUZ, P2=code (reserved for future verification)
 N TDUZ,ESIG
 S TDUZ=+$G(P1)
 I TDUZ<1 S RESULT(0)="-1^DUZ required" Q
 I '$D(^VA(200,TDUZ,0)) S RESULT(0)="-1^User not found" Q
 S ESIG=$G(^VA(200,TDUZ,20,2))
 S RESULT(0)="1^OK"
 S RESULT(1)="HAS_ESIG^"_$S(ESIG'="":1,1:0)
 Q
 ;
CRED(RESULT,P1) ;
 ; P1=DUZ — returns credential metadata (no secrets)
 N TDUZ,NODE0
 S TDUZ=+$G(P1)
 I TDUZ<1 S RESULT(0)="-1^DUZ required" Q
 I '$D(^VA(200,TDUZ,0)) S RESULT(0)="-1^User not found" Q
 S NODE0=$G(^VA(200,TDUZ,0))
 S RESULT(0)="1^OK"
 S RESULT(1)="NAME^"_$P(NODE0,U,1)
 S RESULT(2)="HAS_ACCESS^"_$S($G(^VA(200,TDUZ,.1))'="":1,1:0)
 S RESULT(3)="HAS_VERIFY^"_$S($G(^VA(200,TDUZ,11,0))'="":1,1:0)
 Q
 ;
ADD(RESULT,P1,P2,P3) ;
 ; P1=name (LAST,FIRST), P2=accessCode(opt), P3=verifyCode(opt)
 ; Uses ^DIC with DIC(0)="LMQ" for non-interactive LAYGO into File 200.
 ; This matches the VA Kernel's own $$CREATE^XUSAP (ICR#4677, XUSAP.m).
 ; No "E" flag — ^XUA4A7 SOUNDEX LAYGO trigger quits when "E" absent,
 ; bypassing the interactive SOUNDEX prompt that defaults NO in RPC.
 ; Pre-check via $$FIND1^DIC (exact "X" match) mirrors XUSAP pattern.
 N NEWNAME,IEN,DUZ0SAVE
 S NEWNAME=$G(P1)
 I NEWNAME="" S RESULT(0)="-1^Name required (LAST,FIRST format)" Q
 I NEWNAME'["," S RESULT(0)="-1^Name must be LAST,FIRST format" Q
 S IEN=$$FIND1^DIC(200,,"X",NEWNAME,"B")
 I IEN S RESULT(0)="-1^Name already exists in File 200 IEN="_IEN Q
 ;
 S DUZ0SAVE=$G(DUZ(0))
 S DUZ(0)="@"
 K ^TMP("DIERR",$J)
 S DIC="^VA(200,",DIC(0)="LMQ",DLAYGO=200,X=NEWNAME
 S XUNOTRIG=1
 D ^DIC
 S IEN=+Y
 S DUZ(0)=DUZ0SAVE
 ;
 I IEN<1 S RESULT(0)="-1^DIC LAYGO failed to create entry in File 200" Q
 I $P(Y,U,3)'=1 S RESULT(0)="-1^Entry already exists IEN="_IEN Q
 S RESULT(0)="1^"_IEN
 S RESULT(1)="Created user "_NEWNAME_" IEN="_IEN
 Q
 ;
DEACT(RESULT,P1) ;
 ; P1=DUZ to deactivate — sets DISUSER field 7 via ^DIE
 ; Field 7 is SET type (0:NO;1:YES) stored at node 0, piece 7
 N TDUZ,DIE,DA,DR,DUZ0SAVE
 S TDUZ=+$G(P1)
 I TDUZ<1 S RESULT(0)="-1^DUZ required" Q
 I '$D(^VA(200,TDUZ,0)) S RESULT(0)="-1^User not found" Q
 I $P($G(^VA(200,TDUZ,0)),U,7)=1 S RESULT(0)="0^User already deactivated" Q
 ;
 S DUZ0SAVE=$G(DUZ(0))
 S DUZ(0)="@"
 D DT^DICRW
 S DIE="^VA(200,",DA=TDUZ,DR="7///YES"
 D ^DIE
 S DUZ(0)=DUZ0SAVE
 ;
 I $P($G(^VA(200,TDUZ,0)),U,7)=1 S RESULT(0)="1^User DUZ "_TDUZ_" deactivated" Q
 S RESULT(0)="-1^FileMan ^DIE failed to deactivate user"
 Q
 ;
REACT(RESULT,P1) ;
 ; P1=DUZ to reactivate — clears DISUSER (field 7) via ^DIE,
 ; clears termination date (field 9.2) via UPDATE^DIE like XUSERNEW.m
 ; Field 7 is SET type (0:NO;1:YES) stored at node 0, piece 7
 N TDUZ,DIE,DA,DR,DUZ0SAVE,FDA,ERRS
 S TDUZ=+$G(P1)
 I TDUZ<1 S RESULT(0)="-1^DUZ required" Q
 I '$D(^VA(200,TDUZ,0)) S RESULT(0)="-1^User not found" Q
 I $P($G(^VA(200,TDUZ,0)),U,7)'=1 S RESULT(0)="0^User already active" Q
 ;
 S DUZ0SAVE=$G(DUZ(0))
 S DUZ(0)="@"
 D DT^DICRW
 ; Clear DISUSER via ^DIE — set to NO (external value for SET type)
 S DIE="^VA(200,",DA=TDUZ,DR="7///NO"
 D ^DIE
 ; Clear termination date (field 9.2) via UPDATE^DIE like XUSERNEW.m
 K FDA S FDA(200,TDUZ_",",9.2)="@"
 D UPDATE^DIE("E","FDA")
 S DUZ(0)=DUZ0SAVE
 ;
 I $P($G(^VA(200,TDUZ,0)),U,7)'=1 S RESULT(0)="1^User DUZ "_TDUZ_" reactivated" Q
 S RESULT(0)="-1^FileMan failed to reactivate user"
 Q
 ;
RENAME(RESULT,P1,P2) ;
 ; P1=DUZ, P2=new name (LAST,FIRST format)
 ; Renames user via ^DIE on field .01
 ; XUNOTRIG=1 suppresses SOUNDEX (ASX xref) interactive prompt.
 ; XUITNAME=1 required by the input transform so $$FORMAT^XLFNAME7
 ; result is kept (otherwise XLFNC is killed). DT^DICRW sets the
 ; FileMan date needed by the AE (creator/date) cross-reference.
 N TDUZ,NEWNAME,DIE,DA,DR,DUZ0SAVE,OLDNAME
 S TDUZ=+$G(P1)
 S NEWNAME=$G(P2)
 I TDUZ<1 S RESULT(0)="-1^DUZ required" Q
 I NEWNAME="" S RESULT(0)="-1^New name required (LAST,FIRST format)" Q
 I NEWNAME'["," S RESULT(0)="-1^Name must be LAST,FIRST format" Q
 I '$D(^VA(200,TDUZ,0)) S RESULT(0)="-1^User not found" Q
 I $D(^VA(200,"B",NEWNAME)) S RESULT(0)="-1^Name already exists in File 200" Q
 ;
 S OLDNAME=$P(^VA(200,TDUZ,0),U,1)
 S DUZ0SAVE=$G(DUZ(0))
 S DUZ(0)="@"
 D DT^DICRW
 S XUNOTRIG=1,XUITNAME=1
 ; UPDATE^DIE with "E" flag: external format, fires input transforms,
 ; triggers auditing, and updates cross-references properly.
 N FDA,ERRS
 S FDA(200,TDUZ_",",.01)=NEWNAME
 D UPDATE^DIE("E","FDA","","ERRS")
 S DUZ(0)=DUZ0SAVE
 ;
 I $D(ERRS) D  Q
 . N EMSG S EMSG=$G(ERRS("DIERR",1,"TEXT",1))
 . S RESULT(0)="-1^FileMan UPDATE^DIE failed: "_EMSG
 N CURNAME S CURNAME=$P($G(^VA(200,TDUZ,0)),U,1)
 I CURNAME=NEWNAME D  Q
 . ; Check if UPDATE^DIE already created an audit entry for this rename.
 . ; If so, skip explicit write to avoid duplicates.
 . N AIEN,FOUND S FOUND=0
 . S AIEN="" F  S AIEN=$O(^DIA(200,"B",TDUZ,AIEN),-1) Q:AIEN=""  D  Q:FOUND
 . . N AD0 S AD0=$G(^DIA(200,AIEN,0))
 . . I $P(AD0,U,3)=.01,$G(^DIA(200,AIEN,3))=CURNAME S FOUND=AIEN
 . I FOUND S RESULT(0)="1^User DUZ "_TDUZ_" renamed from "_OLDNAME_" to "_CURNAME S RESULT(1)="AUDIT^"_FOUND Q
 . ; FileMan's UPDATE^DIE does not auto-audit .01 changes — write explicit entry.
 . N NIEN
 . S NIEN=$O(^DIA(200,9999999999),-1)
 . I NIEN'?1.N S NIEN=0
 . S NIEN=NIEN+1
 . S ^DIA(200,NIEN,0)=TDUZ_U_$$NOW^XLFDT_U_.01_U_DUZ_U
 . S ^DIA(200,NIEN,2)=OLDNAME
 . S ^DIA(200,NIEN,3)=CURNAME
 . S ^DIA(200,"B",TDUZ,NIEN)=""
 . S RESULT(0)="1^User DUZ "_TDUZ_" renamed from "_OLDNAME_" to "_CURNAME
 . S RESULT(1)="AUDIT^"_NIEN
 S RESULT(0)="-1^FileMan UPDATE^DIE failed to rename user"
 Q
 ;
TERM(RESULT,P1) ;
 ; P1=DUZ — Full user termination (DISUSER + termination date + clear access)
 ; Follows the VA Kernel termination pattern: XU USER TERMINATE
 ; 1. Set DISUSER(7)=YES  2. Set termination date(9.2)=today
 ; 3. Clear access code(field .1)  4. Leave verify code for audit
 N TDUZ,DIE,DA,DR,DUZ0SAVE,FDA,ERRS
 S TDUZ=+$G(P1)
 I TDUZ<1 S RESULT(0)="-1^DUZ required" Q
 I '$D(^VA(200,TDUZ,0)) S RESULT(0)="-1^User not found" Q
 ;
 S DUZ0SAVE=$G(DUZ(0))
 S DUZ(0)="@"
 D DT^DICRW
 ; Set DISUSER and termination date together
 S DIE="^VA(200,",DA=TDUZ,DR="7///YES;9.2///TODAY"
 D ^DIE
 ; Clear access code via UPDATE^DIE (prevents login even if DISUSER unset)
 K FDA S FDA(200,TDUZ_",",.1)="@"
 D UPDATE^DIE("E","FDA","","ERRS")
 S DUZ(0)=DUZ0SAVE
 ;
 I $P($G(^VA(200,TDUZ,0)),U,7)=1 D  Q
 . S RESULT(0)="1^User DUZ "_TDUZ_" terminated"
 . S RESULT(1)="DISUSER^1"
 . S RESULT(2)="TERMDATE^"_$P($G(^VA(200,TDUZ,0)),U,11)
 . S RESULT(3)="ACCESSCLEARED^"_$S($G(^VA(200,TDUZ,.1))="":1,1:0)
 S RESULT(0)="-1^FileMan failed to terminate user"
 Q
 ;
AUDLOG(RESULT,P1,P2) ;
 ; P1=target DUZ (or * for all), P2=max entries (default 50)
 ; Returns VistA's native FileMan audit trail (^DIA(200)) entries
 N TDUZ,MAX,CT,IEN,LINE,FLDNUM,FLDNAME,WHO,WHEN,OLDV,NEWV
 S TDUZ=$G(P1),MAX=+$G(P2)
 I MAX<1 S MAX=50
 I TDUZ="" S TDUZ="*"
 ;
 I '$D(^DIA(200)) S RESULT(0)="0^No audit trail for File 200" Q
 ;
 S CT=0,RESULT(0)="1^OK"
 S IEN=9999999999 F  S IEN=$O(^DIA(200,IEN),-1) Q:IEN'?1.N  Q:CT'<MAX  D
 . N D0 S D0=$G(^DIA(200,IEN,0))
 . Q:D0=""
 . N ENTRY S ENTRY=$P(D0,U,1)
 . I TDUZ'="*",ENTRY'=TDUZ Q
 . S CT=CT+1
 . S WHEN=$P(D0,U,2)
 . S FLDNUM=$P(D0,U,3)
 . S WHO=$P(D0,U,4)
 . S OLDV=$G(^DIA(200,IEN,2))
 . S NEWV=$G(^DIA(200,IEN,3))
 . ; Look up field name from DD
 . S FLDNAME=$S(FLDNUM'="":$P($G(^DD(200,FLDNUM,0)),U,1),1:"?")
 . S RESULT(CT)=IEN_U_ENTRY_U_WHEN_U_FLDNAME_U_FLDNUM_U_WHO_U_OLDV_U_NEWV
 Q
 ;
INSTALL ;
 D REGONE("ZVE USMG KEYS","KEYS","ZVEUSMG","Add/remove security keys for a user")
 D REGONE("ZVE USMG ESIG","ESIG","ZVEUSMG","E-signature status check")
 D REGONE("ZVE USMG CRED","CRED","ZVEUSMG","Credential metadata check")
 D REGONE("ZVE USMG ADD","ADD","ZVEUSMG","Create minimal File 200 user")
 D REGONE("ZVE USMG DEACT","DEACT","ZVEUSMG","Deactivate user (DISUSER)")
 D REGONE("ZVE USMG REACT","REACT","ZVEUSMG","Reactivate user")
 D REGONE("ZVE USMG RENAME","RENAME","ZVEUSMG","Rename user (.01 field)")
 D REGONE("ZVE USMG TERM","TERM","ZVEUSMG","Terminate user (DISUSER+date+clear access)")
 D REGONE("ZVE USMG AUDLOG","AUDLOG","ZVEUSMG","Query FileMan audit trail for File 200")
 W !,"ZVEUSMG installed.",!
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
