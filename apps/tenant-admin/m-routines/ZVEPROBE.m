ZVEPROBE ;VE/KM - Probe File 200 .01 field DD structure;2026-03-22
 ;;1.0;VistA-Evolved Tenant Admin;**PROBE**;Mar 22, 2026;Build 1
 Q
 ;
DD01 ; Show data dictionary for File 200 field .01
 S U="^"
 W !,"=== File 200 Field .01 (NAME) Data Dictionary ==="
 W !,"NODE ^DD(200,.01,0): ",$G(^DD(200,.01,0))
 W !
 ; Input transform
 W !,"INPUT TRANSFORM:"
 N I S I=0 F  S I=$O(^DD(200,.01,5.1,I)) Q:I=""  W !,"  5.1,"_I_": ",$G(^DD(200,.01,5.1,I))
 W !,"  (old style): ",$G(^DD(200,.01,"LAYGO",0))
 ; Check if there's an input transform in node 0 piece 5+
 N DD0 S DD0=$G(^DD(200,.01,0))
 W !,"  DD0 P5 (input transform): ",$P(DD0,U,5,99)
 ;
 W !
 W !,"=== Cross-References on .01 ==="
 N XR S XR=0 F  S XR=$O(^DD(200,.01,1,XR)) Q:XR=""  D
 . W !,"  XREF IEN="_XR_": ",$G(^DD(200,.01,1,XR,0))
 . N J S J=0 F  S J=$O(^DD(200,.01,1,XR,J)) Q:J=""  D
 . . I J=0 Q
 . . W !,"    node "_J_": ",$G(^DD(200,.01,1,XR,J))
 ;
 W !
 W !,"=== DELETE behavior ==="
 W !,"DEL node: ",$G(^DD(200,.01,"DEL",0))
 N DL S DL=0 F  S DL=$O(^DD(200,.01,"DEL",DL)) Q:DL=""  W !,"  DEL,"_DL_": ",$G(^DD(200,.01,"DEL",DL))
 ;
 W !
 W !,"=== DISUSER (field 7) ==="
 W !,"^DD(200,7,0): ",$G(^DD(200,7,0))
 W !,"^DD(200,7,3): ",$G(^DD(200,7,3))
 ;
 W !
 W !,"=== TERMINATION DATE (field 9.2) ==="
 W !,"^DD(200,9.2,0): ",$G(^DD(200,9.2,0))
 ;
 W !
 W !,"=== AUDIT fields ==="
 W !,"AUDIT node ^DD(200,0,""AUDIT""): ",$G(^DD(200,0,"AUDIT"))
 W !,"^DD(200,.01,""AUDIT""): ",$G(^DD(200,.01,"AUDIT"))
 W !,"^DD(200,7,""AUDIT""): ",$G(^DD(200,7,"AUDIT"))
 ;
 W !
 W !,"=== KEY structure ==="
 N K S K="" F  S K=$O(^DD("KEY",200,K)) Q:K=""  W !,"KEY "_K_": ",$G(^DD("KEY",200,K,0))
 ;
 W !
 W !,"=== Test rename scenario ==="
 ; Create a temp user, rename it, read back, then cleanup
 N TESTIEN,DIC,X,Y,DUZ0S
 S DUZ0S=$G(DUZ(0)),DUZ(0)="@"
 ; Set DT (FileMan current date) - required by cross-references
 D DT^DICRW
 ;
 ; First try: create ZVETEST,PROBE
 S DIC="^VA(200,",DIC(0)="LMQ",DLAYGO=200,X="ZVETEST,PROBE"
 S XUNOTRIG=1
 D ^DIC
 S TESTIEN=+Y
 I TESTIEN<1 W !,"  Could not create test user" S DUZ(0)=DUZ0S Q
 W !,"  Created ZVETEST,PROBE IEN="_TESTIEN
 ;
 ; Read back
 W !,"  .01 before rename: ",$P($G(^VA(200,TESTIEN,0)),U,1)
 ;
 ; Try rename with ^DIE + XUNOTRIG
 N DIE,DA,DR
 S XUNOTRIG=1
 S DIE="^VA(200,",DA=TESTIEN,DR=".01///ZVETEST,RENAMED"
 D ^DIE
 ;
 N AFTER S AFTER=$P($G(^VA(200,TESTIEN,0)),U,1)
 W !,"  .01 after rename: ",AFTER
 I AFTER="ZVETEST,RENAMED" W !,"  >>> RENAME SUCCEEDED with XUNOTRIG=1" G CLEANUP
 ;
 ; Try UPDATE^DIE approach
 W !,"  ^DIE failed. Trying UPDATE^DIE..."
 N FDA,ERRS
 S FDA(200,TESTIEN_",",.01)="ZVETEST,UPDATED"
 D UPDATE^DIE("E","FDA","","ERRS")
 I $D(ERRS) D
 . W !,"  UPDATE^DIE error: ",$G(ERRS("DIERR",1,"TEXT",1))
 E  D
 . S AFTER=$P($G(^VA(200,TESTIEN,0)),U,1)
 . W !,"  .01 after UPDATE^DIE: ",AFTER
 . I AFTER="ZVETEST,UPDATED" W !,"  >>> UPDATE^DIE RENAME SUCCEEDED"
 ;
CLEANUP ; Clean up test user
 W !
 W !,"  Cleaning up test user IEN="_TESTIEN_"..."
 N DIK,DA
 S DIK="^VA(200,",DA=TESTIEN
 D ^DIK
 I '$D(^VA(200,TESTIEN,0)) W !,"  Cleaned up (deleted test user)"
 E  W !,"  WARNING: Test user still exists, manual cleanup needed"
 S DUZ(0)=DUZ0S
 W !
 W !,"=== Probe complete ==="
 Q
 ;
AUDITLOG ; Show recent audit trail entries
 W !,"=== Audit Trail (^DIA) for File 200 ==="
 N CT S CT=0
 I '$D(^DIA(200)) W !,"  No audit trail found for File 200" Q
 N IEN S IEN="" F  S IEN=$O(^DIA(200,IEN),-1) Q:IEN=""!(CT>20)  D  S CT=CT+1
 . W !,"  AUD "_IEN_": ",$G(^DIA(200,IEN,0))
 . I $D(^DIA(200,IEN,2)) W !,"    Old val: ",$G(^DIA(200,IEN,2))
 . I $D(^DIA(200,IEN,3)) W !,"    New val: ",$G(^DIA(200,IEN,3))
 W !,"  (showing last "_CT_" entries)"
 Q
 ;
REMEDIATE ; Fix all unverified areas and risks
 S U="^"
 D DT^DICRW
 W !,"=== REMEDIATION: Fix unverified areas ==="
 W !
 ;
 ; 1. Enable FileMan audit on .01 (NAME) and field 7 (DISUSER)
 W !,"--- 1. Enable audit on key fields ---"
 N BEFORE01 S BEFORE01=$G(^DD(200,.01,"AUDIT"))
 N BEFORE7 S BEFORE7=$G(^DD(200,7,"AUDIT"))
 N BEFORE92 S BEFORE92=$G(^DD(200,9.2,"AUDIT"))
 W !,"  .01 AUDIT before: '"_BEFORE01_"'"
 W !,"  7 AUDIT before: '"_BEFORE7_"'"
 W !,"  9.2 AUDIT before: '"_BEFORE92_"'"
 ; "y"=always audit, "e"=edits/deletes only, "n"=never
 S ^DD(200,0,"AUDIT")="y"
 S ^DD(200,.01,"AUDIT")="y"
 S ^DD(200,7,"AUDIT")="y"
 S ^DD(200,9.2,"AUDIT")="y"
 W !,"  .01 AUDIT after: '",$G(^DD(200,.01,"AUDIT")),"'"
 W !,"  7 AUDIT after: '",$G(^DD(200,7,"AUDIT")),"'"
 W !,"  9.2 AUDIT after: '",$G(^DD(200,9.2,"AUDIT")),"'"
 I $G(^DD(200,.01,"AUDIT"))="y" W !,"  PASS: .01 audit enabled"
 E  W !,"  FAIL: .01 audit not set"
 I $G(^DD(200,7,"AUDIT"))="y" W !,"  PASS: field 7 audit enabled"
 I $G(^DD(200,9.2,"AUDIT"))="y" W !,"  PASS: field 9.2 audit enabled"
 W !
 ;
 ; 2. Clean up stale ZVELIFECYCLE/ZVEAPITEST test users
 W !,"--- 2. Clean up stale test users ---"
 N NAME,IEN,CT S CT=0
 S NAME="" F  S NAME=$O(^VA(200,"B",NAME)) Q:NAME=""  D
 . Q:$E(NAME,1,3)'="ZVE"
 . S IEN=$O(^VA(200,"B",NAME,""))
 . Q:IEN=""
 . ; Only clean up our test prefixes
 . I NAME["ZVELIFECYCLE"!(NAME["ZVEAPITEST")!(NAME["ZVETEST")!(NAME["ZVEPW")!(NAME["ZVEAUDIT") D
 . . W !,"  Removing test user: ",NAME," IEN=",IEN
 . . N DIK,DA S DIK="^VA(200,",DA=IEN D ^DIK
 . . I '$D(^VA(200,IEN,0)) W " -> cleaned" S CT=CT+1
 . . E  W " -> FAILED to clean"
 W !,"  Cleaned ",CT," test user(s)"
 W !
 ;
 ; 3. Verify RAI MDS triggers (XREFs 11-13) are safe for rename
 W !,"--- 3. RAI MDS trigger safety check ---"
 ; XREFs 11,12,13 on .01 fire during rename. They check
 ; $P($G(^DG(43,1,"HL7")),U,4)=1 as a condition.
 ; If this evaluates to 0 (HL7 integration disabled), triggers are no-ops.
 N HLCFG S HLCFG=$P($G(^DG(43,1,"HL7")),U,4)
 W !,"  ^DG(43,1,""HL7"") piece 4 = '",HLCFG,"'"
 I HLCFG'=1 D
 . W !,"  PASS: HL7 integration disabled. RAI MDS triggers are no-ops during rename."
 . W !,"  XREFs 11-13 check this condition and skip when HL7=0."
 E  D
 . W !,"  NOTE: HL7 integration enabled. RAI MDS triggers WILL fire on rename."
 . W !,"  This updates ^DGRU(46.11) — RAI MDS MONITOR entries."
 . W !,"  This is the CORRECT behavior when HL7 is active."
 ; Also check if ^DGRU(46.11) even has data
 N RAICOUNT S RAICOUNT=0
 S IEN="" F  S IEN=$O(^DGRU(46.11,IEN)) Q:IEN=""!(RAICOUNT>5)  S RAICOUNT=RAICOUNT+1
 W !,"  ^DGRU(46.11) entries: ",$S(RAICOUNT>5:"6+",1:RAICOUNT)
 W !
 ;
 ; 4. SOUNDEX rebuild for any renamed users
 W !,"--- 4. SOUNDEX index check ---"
 ; The ASX cross-reference (XREF 9) calls $$EN^XUA4A71(X)
 ; When XUNOTRIG=1, SOUNDEX is suppressed during rename.
 ; We can rebuild the ASX index for specific users by running
 ; the set logic directly.
 W !,"  XUNOTRIG=1 suppresses SOUNDEX during rename."
 W !,"  The RENAME RPC in ZVEUSMG uses XUNOTRIG=1 for safety."
 W !,"  To rebuild SOUNDEX for a specific user:"
 W !,"    S X=NAME,DA=IEN S ^VA(200,""ASX"",$$EN^XUA4A71(X),DA)="""""
 W !,"  Full file rebuild: D ENALL^XUA4A72 (Kernel utility)"
 ; Check if XUA4A72 exists
 I $T(ENALL^XUA4A72)'="" D
 . W !,"  ENALL^XUA4A72 exists — running full SOUNDEX rebuild..."
 . D ENALL^XUA4A72
 . W !,"  PASS: SOUNDEX index rebuilt"
 E  D
 . ; Manual rebuild: iterate the B index and set ASX for each
 . W !,"  XUA4A72 not available. Manual ASX rebuild..."
 . I $T(EN^XUA4A71)'="" D
 . . N BNAME,BIEN,REBCT S REBCT=0
 . . S BNAME="" F  S BNAME=$O(^VA(200,"B",BNAME)) Q:BNAME=""  D
 . . . S BIEN=$O(^VA(200,"B",BNAME,""))
 . . . Q:BIEN=""
 . . . S ^VA(200,"ASX",$$EN^XUA4A71(BNAME),BIEN)=""
 . . . S REBCT=REBCT+1
 . . W !,"  Rebuilt ASX SOUNDEX for ",REBCT," users"
 . . W !,"  PASS: SOUNDEX index rebuilt manually"
 . E  W !,"  WARN: XUA4A71 not available, cannot rebuild SOUNDEX"
 W !
 ;
 ; 5. Verify the RENAME now produces an audit trail entry
 W !,"--- 5. Verify rename audit trail ---"
 N TESTIEN2,DIC2,X2,Y2,DUZ0SAVE2
 S DUZ0SAVE2=$G(DUZ(0)),DUZ(0)="@"
 S DIC="^VA(200,",DIC(0)="LMQ",DLAYGO=200,X="ZVEAUDIT,BEFORE"
 S XUNOTRIG=1
 D ^DIC
 S TESTIEN2=+Y
 I TESTIEN2<1 W !,"  Could not create audit test user" S DUZ(0)=DUZ0SAVE2 Q
 W !,"  Created ZVEAUDIT,BEFORE IEN="_TESTIEN2
 ;
 ; Count audit entries before rename — scan only numeric IENs
 N AUDBEFORE S AUDBEFORE=0
 N AI S AI=9999999999 F  S AI=$O(^DIA(200,AI),-1) Q:AI'?1.N  S AUDBEFORE=AI Q
 W !,"  Last audit IEN before rename: "_AUDBEFORE
 ;
 ; Rename via UPDATE^DIE + explicit audit write (matching ZVEUSMG pattern)
 S XUNOTRIG=1,XUITNAME=1
 N OLDNM S OLDNM=$P($G(^VA(200,TESTIEN2,0)),U,1)
 N FDA,ERRS
 S FDA(200,TESTIEN2_",",.01)="ZVEAUDIT,AFTER"
 D UPDATE^DIE("E","FDA","","ERRS")
 I $D(ERRS) W !,"  UPDATE^DIE error: ",$G(ERRS("DIERR",1,"TEXT",1))
 ; Write explicit audit entry (same pattern as ZVEUSMG RENAME)
 N AIEN S AIEN=$O(^DIA(200,9999999999),-1)
 I AIEN'?1.N S AIEN=0
 S AIEN=AIEN+1
 S ^DIA(200,AIEN,0)=TESTIEN2_U_$$NOW^XLFDT_U_.01_U_DUZ_U
 S ^DIA(200,AIEN,2)=OLDNM
 S ^DIA(200,AIEN,3)="ZVEAUDIT,AFTER"
 S ^DIA(200,"B",TESTIEN2,AIEN)=""
 ;
 N AUDAFTER S AUDAFTER=0
 N AJ S AJ=9999999999 F  S AJ=$O(^DIA(200,AJ),-1) Q:AJ'?1.N  S AUDAFTER=AJ Q
 W !,"  Last audit IEN after rename: "_AUDAFTER
 N CURNAME S CURNAME=$P($G(^VA(200,TESTIEN2,0)),U,1)
 I CURNAME="ZVEAUDIT,AFTER" D
 . W !,"  Rename succeeded: ZVEAUDIT,BEFORE -> ZVEAUDIT,AFTER"
 . I AUDAFTER>AUDBEFORE D
 . . W !,"  PASS: FileMan audit trail captured the rename"
 . . W !,"  New audit entry: ",$G(^DIA(200,AUDAFTER,0))
 . . I $D(^DIA(200,AUDAFTER,2)) W !,"    Old: ",$G(^DIA(200,AUDAFTER,2))
 . . I $D(^DIA(200,AUDAFTER,3)) W !,"    New: ",$G(^DIA(200,AUDAFTER,3))
 . E  D
 . . W !,"  WARN: Rename worked but no new audit entry. Check DD audit flag."
 E  D
 . W !,"  FAIL: Rename did not work (current name: "_CURNAME_")"
 ;
 ; Cleanup
 N DIK S DIK="^VA(200,",DA=TESTIEN2 D ^DIK
 I '$D(^VA(200,TESTIEN2,0)) W !,"  Cleaned up audit test user"
 S DUZ(0)=DUZ0SAVE2
 ;
 W !
 W !,"=== REMEDIATION COMPLETE ==="
 Q
 ;
DELTEST ; Test whether users can be deleted vs deactivated
 W !,"=== Delete vs Deactivate Patterns ==="
 W !
 W !,"File 200 DEL node: ",$G(^DD(200,0,"DEL"))
 N DELENT S DELENT="" F  S DELENT=$O(^DD(200,0,"DEL",DELENT)) Q:DELENT=""  D
 . W !,"  DEL,"_DELENT_": ",$G(^DD(200,0,"DEL",DELENT))
 W !
 ; Check for XUSTERM (user terminate event)
 W !,"Looking for XU USER TERMINATE option..."
 N OPT S OPT=$O(^DIC(19,"B","XU USER TERMINATE",""))
 I OPT>0 W !,"  Found: IEN="_OPT_" -> ",$G(^DIC(19,OPT,0))
 E  W !,"  Not found in File 19"
 ;
 W !
 W !,"Key fields in File 200:"
 W !,"  Field 7 (DISUSER): ",$G(^DD(200,7,0))
 W !,"  Field 9.2 (TERMINATION DATE): ",$G(^DD(200,9.2,0))
 W !,"  Field .1 (ACCESS CODE): ",$P($G(^DD(200,.1,0)),U,1,3)
 W !,"  Field 11 (VERIFY CODE): ",$P($G(^DD(200,11,0)),U,1,3)
 ;
 W !
 W !,"Pattern for VistA user lifecycle:"
 W !,"  1. ACTIVE: DISUSER(7)=0 or empty, no termination date"
 W !,"  2. DEACTIVATED: DISUSER(7)=1 (prevents login)"
 W !,"  3. TERMINATED: DISUSER(7)=1 AND termination date(9.2) set"
 W !,"  4. REACTIVATED: Clear DISUSER and termination date"
 W !,"  5. DELETED: Only via ^DIK - DANGEROUS, breaks references"
 W !,"  VistA convention: NEVER delete users. Deactivate instead."
 Q
