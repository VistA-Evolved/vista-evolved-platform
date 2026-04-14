ZVEPAT1 ; VE — Patient Flags, Search, Duplicate, Recent, Deceased RPCs ; Apr 2026
 ;;1.0;VISTA EVOLVED;**1**;Apr 2026;Build 1
 ;
 ; RPCs in this routine:
 ;   ZVE PATIENT FLAGS     - List/assign/inactivate patient record flags
 ;   ZVE PATIENT DUPLICATE - Duplicate detection
 ;   ZVE PATIENT SEARCH EXTENDED - Multi-mode patient search
 ;   ZVE RECENT PATIENTS   - Recently accessed patients per user
 ;   ZVE PATIENT DECEASED  - Record/verify date of death
 ;   ZVE PAT BRGLSS        - Break-the-glass audit log write (DG SECURITY LOG File 38.11)
 ;   ZVE PAT BGREAD        - Read break-the-glass audit log for a patient
 ;   ZVE PAT RESTRICT      - Set/clear patient record sensitivity (File 38.1 field 2)
 ;
 Q  ; No direct entry
 ;
INSTALL ;
 W !,"=== Installing ZVEPAT1 RPCs ==="
 D REGONE^ZVEADMIN("ZVE PATIENT FLAGS","FLAGS","ZVEPAT1","Patient record flags")
 D REGONE^ZVEADMIN("ZVE PATIENT DUPLICATE","DUPL","ZVEPAT1","Duplicate patient detection")
 D REGONE^ZVEADMIN("ZVE PATIENT SEARCH EXTENDED","SRCH","ZVEPAT1","Extended patient search")
 D REGONE^ZVEADMIN("ZVE RECENT PATIENTS","RECENT","ZVEPAT1","Recently accessed patients")
 D REGONE^ZVEADMIN("ZVE PATIENT DECEASED","DEAD","ZVEPAT1","Record date of death")
 D REGONE^ZVEADMIN("ZVE PAT BRGLSS","BRGLSS","ZVEPAT1","Break-the-glass audit log")
 D REGONE^ZVEADMIN("ZVE PAT BGREAD","BGREAD","ZVEPAT1","Read break-the-glass audit log")
 D REGONE^ZVEADMIN("ZVE PAT RESTRICT","RESTRICT","ZVEPAT1","Set patient record sensitivity")
 W !,"=== ZVEPAT1 install complete ==="
 Q
 ;
 ; ============================================================
 ; ZVE PATIENT FLAGS — Patient record flag management
 ; ============================================================
 ; Params: DFN, ACTION (LIST|ASSIGN|INACTIVATE), FLAGTYPE,
 ;         FLAGNAME, NARRATIVE, REVIEWDT
 ; Output: varies by ACTION
 ; Reads/writes: PRF files #26.13, #26.14, #26.15
 ; ============================================================
FLAGS(R,DFN,ACTION,FLAGTYPE,FLAGNAME,NARRATIVE,REVIEWDT) ;
 S ACTION=$$UP^XLFSTR($G(ACTION,"LIST"))
 ; DEFS does not require a patient DFN
 I ACTION="DEFS" D  Q
 . N CNT,NM S CNT=0
 . I '$D(^DGPF(26.15,0)) S R(0)="1^0^NO_DEFS" Q
 . N I S I=0 F  S I=$O(^DGPF(26.15,I)) Q:I=""!(+I=0)  D
 . . N Z S Z=$G(^DGPF(26.15,I,0)) Q:Z=""
 . . S NM=$P(Z,U,1) Q:NM=""
 . . S CNT=CNT+1,R(CNT)=I_U_NM
 . S R(0)="1^"_CNT_"^OK"
 ;
 S DFN=+$G(DFN)
 I 'DFN S R(0)="0^DFN required" Q
 I '$D(^DPT(DFN,0)) S R(0)="0^Patient not found" Q
 ;
 I ACTION="LIST" D  Q
 . ; List active flags for this patient
 . ; PRF ASSIGNMENT #26.13 — .02 is PATIENT, .01 is FLAG
 . N CNT,OUT S CNT=0
 . ; Check if PRF globals exist
 . I '$D(^DGPF(26.13)) S R(0)="1^0^NO_FLAGS" Q
 . N IEN S IEN=0
 . F  S IEN=$O(^DGPF(26.13,IEN)) Q:'IEN  Q:IEN="B"  D
 . . N Z S Z=$G(^DGPF(26.13,IEN,0)) Q:Z=""
 . . N FDFN S FDFN=$P(Z,U,1) Q:FDFN'=DFN            ; .01=PATIENT (piece 1)
 . . N FREF S FREF=$P(Z,U,2)                       ; .02=FLAG ref (var ptr)
 . . N FIEN S FIEN=$P(FREF,";",1)
 . . N STATUS S STATUS=$P(Z,U,3) Q:STATUS="0"!($E(STATUS,1)="0") ; .03=STATUS (0=inactive)
 . . N FNAME S FNAME=$S(FIEN:$$GET1^DIQ(26.15,FIEN_",",.01,"E"),1:"UNKNOWN")
 . . N FTYPE S FTYPE=""                             ; type not stored in 26.13
 . . N REVDT S REVDT=$P(Z,U,6)                     ; .06=REVIEW DATE (piece 6)
 . . N ASSDT S ASSDT=$G(^DGPF(26.13,IEN,.07))      ; assignment date if present
 . . N ASSBY S ASSBY=$G(^VA(200,DUZ,0)) S ASSBY=$P(ASSBY,U,1)
 . . S CNT=CNT+1,OUT(CNT)=IEN_U_FNAME_U_FTYPE_U_STATUS_U_ASSDT_U_ASSBY_U_REVDT
 . S R(0)="1^"_CNT_"^OK"
 . N I F I=1:1:CNT S R(I)=OUT(I)
 ;
 I ACTION="ASSIGN" D  Q
 . S FLAGTYPE=$$UP^XLFSTR($G(FLAGTYPE))
 . I FLAGTYPE="" S R(0)="0^FLAGTYPE required (NATIONAL, LOCAL, BEHAVIORAL)" Q
 . S FLAGNAME=$G(FLAGNAME)
 . I FLAGNAME="" S R(0)="0^FLAGNAME required" Q
 . S NARRATIVE=$G(NARRATIVE)
 . ;
 . ; Find flag definition IEN in File 26.15 via B cross-ref
 . N FLAGIEN S FLAGIEN=$O(^DGPF(26.15,"B",FLAGNAME,0))
 . I 'FLAGIEN S R(0)="0^Flag not found in PRF: "_FLAGNAME Q
 . ;
 . ; Assign next IEN and write 26.13 record directly
 . ; 0 node: PATIENT^FLAGREF^STATUS^^^REVIEWDATE
 . N ASSIEN S ASSIEN=+$P($G(^DGPF(26.13,0)),U,3)+1
 . N Z0 S Z0=DFN_U_FLAGIEN_";DGPF(26.15,"_U_1_U_U_U
 . I $G(REVIEWDT)]"" S $P(Z0,U,6)=REVIEWDT
 . S ^DGPF(26.13,ASSIEN,0)=Z0
 . S ^DGPF(26.13,"B",DFN,ASSIEN)=""
 . S $P(^DGPF(26.13,0),U,3)=ASSIEN
 . S $P(^DGPF(26.13,0),U,4)=+$P($G(^DGPF(26.13,0)),U,4)+1
 . ;
 . ; Store narrative in WP field 1 (direct global)
 . I NARRATIVE]"" D
 . . N NOWDT S NOWDT=$$DT^XLFDT
 . . S ^DGPF(26.13,ASSIEN,1,0)="^^1^1^"_NOWDT
 . . S ^DGPF(26.13,ASSIEN,1,1,0)=NARRATIVE
 . ;
 . ; Log to PRF HISTORY #26.14
 . N HIEN S HIEN=+$P($G(^DGPF(26.14,0)),U,3)+1
 . N ZH S ZH=ASSIEN_U_$$NOW^XLFDT_U_"ASSIGNED"_U_DUZ
 . S ^DGPF(26.14,HIEN,0)=ZH
 . S $P(^DGPF(26.14,0),U,3)=HIEN
 . S $P(^DGPF(26.14,0),U,4)=+$P($G(^DGPF(26.14,0)),U,4)+1
 . ;
 . D AUDITLOG^ZVEADMIN("FLAG-ASSIGN",DFN,"Flag="_FLAGNAME_" Type="_FLAGTYPE)
 . S R(0)="1^OK^"_ASSIEN_"^ASSIGNED"
 ;
 I ACTION="INACTIVATE" D  Q
 . ; Inactivate a specific flag assignment
 . N ASSIEN S ASSIEN=+$G(FLAGTYPE) ; reuse param for assignment IEN
 . I 'ASSIEN S R(0)="0^Flag assignment IEN required" Q
 . I '$D(^DGPF(26.13,ASSIEN,0)) S R(0)="0^Flag assignment not found" Q
 . ;
 . ; Set STATUS (piece 3) to 0 (INACTIVE)
 . N Z S Z=$G(^DGPF(26.13,ASSIEN,0))
 . S $P(Z,U,3)=0
 . S ^DGPF(26.13,ASSIEN,0)=Z
 . ;
 . ; Log to PRF HISTORY #26.14
 . N HIEN S HIEN=+$P($G(^DGPF(26.14,0)),U,3)+1
 . S ^DGPF(26.14,HIEN,0)=ASSIEN_U_$$NOW^XLFDT_U_"INACTIVATED"_U_DUZ
 . S $P(^DGPF(26.14,0),U,3)=HIEN
 . S $P(^DGPF(26.14,0),U,4)=+$P($G(^DGPF(26.14,0)),U,4)+1
 . ;
 . D AUDITLOG^ZVEADMIN("FLAG-INACT",DFN,"Assignment "_ASSIEN_" inactivated")
 . S R(0)="1^OK^INACTIVATED"
 ;
 S R(0)="0^Invalid ACTION: "_ACTION_" (use LIST, ASSIGN, or INACTIVATE)" Q
 ;
 ; ============================================================
 ; ZVE PATIENT DUPLICATE — Duplicate detection
 ; ============================================================
 ; Params: NAME, DOB, SSN, SEX, MAX
 ; Output:
 ;   "1^COUNT^OK"
 ;   "DFN^NAME^DOB^SSN_LAST4^SCORE" rows
 ; Score: 100=exact SSN, 80=name+DOB, 60=name+SEX
 ; ============================================================
DUPL(R,NAME,DOB,SSN,SEX,MAX) ;
 S NAME=$$UP^XLFSTR($G(NAME))
 S DOB=$G(DOB),SSN=$G(SSN),SEX=$$UP^XLFSTR($G(SEX))
 S MAX=+$G(MAX,20) I MAX<1 S MAX=20
 ;
 I NAME="",(SSN="") S R(0)="0^NAME or SSN required for duplicate search" Q
 ;
 N CNT,OUT S CNT=0
 ;
 ; Strategy 1: Exact SSN match (score 100)
 I SSN]"",SSN?9N D
 . I $D(^DPT("SSN",SSN)) D
 . . N TDFN S TDFN=0
 . . F  S TDFN=$O(^DPT("SSN",SSN,TDFN)) Q:'TDFN  Q:CNT'<MAX  D
 . . . N TNM S TNM=$P($G(^DPT(TDFN,0)),U,1)
 . . . N TDOB S TDOB=$P($G(^DPT(TDFN,0)),U,3)
 . . . N TSSN S TSSN=$P($G(^DPT(TDFN,0)),U,9)
 . . . N TSSN4 S TSSN4=$E(TSSN,$L(TSSN)-3,$L(TSSN))
 . . . S CNT=CNT+1,OUT(CNT)=TDFN_U_TNM_U_$$FMTE^XLFDT(TDOB)_U_TSSN4_U_100
 ;
 ; Strategy 2: Name match with DOB comparison (score 80)
 I NAME]"",CNT<MAX D
 . N SEARCH S SEARCH=NAME
 . N TDFN S TDFN=0
 . I $D(^DPT("B",NAME)) D
 . . F  S TDFN=$O(^DPT("B",NAME,TDFN)) Q:'TDFN  Q:CNT'<MAX  D
 . . . ; Skip if already found by SSN
 . . . N DUPE S DUPE=0 N J F J=1:1:CNT I $P(OUT(J),U,1)=TDFN S DUPE=1 Q
 . . . Q:DUPE
 . . . N TDOB S TDOB=$P($G(^DPT(TDFN,0)),U,3)
 . . . N TSSN S TSSN=$P($G(^DPT(TDFN,0)),U,9)
 . . . N TSSN4 S TSSN4=$E(TSSN,$L(TSSN)-3,$L(TSSN))
 . . . N SCORE S SCORE=60
 . . . I DOB]"",TDOB=DOB S SCORE=80
 . . . S CNT=CNT+1,OUT(CNT)=TDFN_U_$P($G(^DPT(TDFN,0)),U,1)_U_$$FMTE^XLFDT(TDOB)_U_TSSN4_U_SCORE
 ;
 S R(0)="1^"_CNT_"^OK"
 N I F I=1:1:CNT S R(I)=OUT(I)
 Q
 ;
 ; ============================================================
 ; ZVE PATIENT SEARCH EXTENDED — Multi-mode patient search
 ; ============================================================
 ; Params: SEARCH, STYPE (NAME|SSN_LAST4|SSN_FULL|DOB|ID),
 ;         DIVISION, INACTIVE, MAX
 ; Output:
 ;   "1^COUNT^OK"
 ;   "DFN^NAME^DOB^SSN_LAST4^SEX^VETERAN^SC_PCT^LASTVISIT"
 ; ============================================================
SRCH(R,SEARCH,STYPE,DIVISION,INACTIVE,MAX) ;
 S SEARCH=$$UP^XLFSTR($G(SEARCH))
 I SEARCH="" S R(0)="0^SEARCH text required" Q
 S STYPE=$$UP^XLFSTR($G(STYPE,"NAME"))
 S DIVISION=$G(DIVISION),INACTIVE=$G(INACTIVE,"N")
 S MAX=+$G(MAX,50) I MAX<1 S MAX=50
 ;
 N CNT,OUT S CNT=0
 ;
 I STYPE="NAME" D SRCHNAM(.OUT,.CNT,SEARCH,MAX,INACTIVE)
 E  I STYPE="SSN_LAST4" D SRCHSSN(.OUT,.CNT,SEARCH,MAX,0)
 E  I STYPE="SSN_FULL" D SRCHSSN(.OUT,.CNT,SEARCH,MAX,1)
 E  I STYPE="DOB" D SRCHDOB(.OUT,.CNT,SEARCH,MAX)
 E  I STYPE="ID" D SRCHID(.OUT,.CNT,SEARCH)
 E  S R(0)="0^Unknown STYPE: "_STYPE Q
 ;
 S R(0)="1^"_CNT_"^OK"
 N I F I=1:1:CNT S R(I)=OUT(I)
 Q
 ;
SRCHNAM(OUT,CNT,SEARCH,MAX,INACTIVE) ;
 ; Search by name prefix via "B" cross-ref
 N NM S NM=$O(^DPT("B",SEARCH),-1)
 F  S NM=$O(^DPT("B",NM)) Q:NM=""  Q:CNT'<MAX  Q:$E(NM,1,$L(SEARCH))'=SEARCH  D
 . N DFN S DFN=0
 . F  S DFN=$O(^DPT("B",NM,DFN)) Q:'DFN  Q:CNT'<MAX  D
 . . ; Active check — skip deceased unless INACTIVE="Y"
 . . I INACTIVE'="Y",$P($G(^DPT(DFN,.35)),U,1)]"" Q
 . . D SRCHROW(.OUT,.CNT,DFN)
 Q
 ;
SRCHSSN(OUT,CNT,SEARCH,MAX,FULL) ;
 ; Search by SSN
 I FULL D  Q
 . ; Full SSN — direct cross-ref lookup
 . I '$D(^DPT("SSN",SEARCH)) Q
 . N DFN S DFN=0
 . F  S DFN=$O(^DPT("SSN",SEARCH,DFN)) Q:'DFN  Q:CNT'<MAX  D
 . . D SRCHROW(.OUT,.CNT,DFN)
 ;
 ; Last 4 — must scan (no direct cross-ref for last4)
 N NM S NM="" F  S NM=$O(^DPT("B",NM)) Q:NM=""  Q:CNT'<MAX  D
 . N DFN S DFN=0 F  S DFN=$O(^DPT("B",NM,DFN)) Q:'DFN  Q:CNT'<MAX  D
 . . N TSSN S TSSN=$P($G(^DPT(DFN,0)),U,9) Q:TSSN=""
 . . I $E(TSSN,$L(TSSN)-3,$L(TSSN))=SEARCH D SRCHROW(.OUT,.CNT,DFN)
 Q
 ;
SRCHDOB(OUT,CNT,SEARCH,MAX) ;
 ; Search by DOB — traverse "B" looking for matching DOB
 N NM S NM="" F  S NM=$O(^DPT("B",NM)) Q:NM=""  Q:CNT'<MAX  D
 . N DFN S DFN=0 F  S DFN=$O(^DPT("B",NM,DFN)) Q:'DFN  Q:CNT'<MAX  D
 . . N TDOB S TDOB=$P($G(^DPT(DFN,0)),U,3)
 . . I TDOB=SEARCH D SRCHROW(.OUT,.CNT,DFN)
 Q
 ;
SRCHID(OUT,CNT,SEARCH) ;
 ; Search by DFN (direct lookup)
 N DFN S DFN=+SEARCH
 I 'DFN Q
 I '$D(^DPT(DFN,0)) Q
 D SRCHROW(.OUT,.CNT,DFN)
 Q
 ;
SRCHROW(OUT,CNT,DFN) ;
 ; Build output row for a patient
 N Z S Z=$G(^DPT(DFN,0)) Q:Z=""
 N NM S NM=$P(Z,U,1)
 N DOB S DOB=$P(Z,U,3)
 N SSN S SSN=$P(Z,U,9)
 N SSN4 S SSN4=$S(SSN]"":$E(SSN,$L(SSN)-3,$L(SSN)),1:"")
 N SEX S SEX=$P(Z,U,2)
 N VET S VET=$$GET1^DIQ(2,DFN_",",.301,"E")
 N SCP S SCP=$$GET1^DIQ(2,DFN_",",.302,"E")
 ; Last visit — check for most recent outpatient encounter
 N LV S LV=""
 I $D(^AUPNVSIT("C",DFN)) D
 . N VIEN S VIEN=$O(^AUPNVSIT("C",DFN,""),-1)
 . I VIEN S LV=$$GET1^DIQ(9000010,VIEN_",",.01,"E")
 S CNT=CNT+1,OUT(CNT)=DFN_U_NM_U_$$FMTE^XLFDT(DOB)_U_SSN4_U_SEX_U_VET_U_SCP_U_LV
 Q
 ;
 ; ============================================================
 ; ZVE RECENT PATIENTS — Recently accessed patients per user
 ; ============================================================
 ; Params: USERDUZ, COUNT
 ; Output:
 ;   "1^COUNT^OK"
 ;   "DFN^NAME^DOB^SSN_LAST4^LAST_ACCESSED"
 ; Uses ^XTMP("ZVE-RECENT",USERDUZ) for per-user tracking
 ; ============================================================
RECENT(R,USERDUZ,COUNT) ;
 S USERDUZ=+$G(USERDUZ,DUZ)
 S COUNT=+$G(COUNT,10) I COUNT<1 S COUNT=10
 ;
 N CNT,OUT S CNT=0
 ;
 I '$D(^XTMP("ZVE-RECENT",USERDUZ)) S R(0)="1^0^NO_RECENT" Q
 ;
 ; Walk reverse chronological (stored as FM date keys)
 N DT S DT=""
 F  S DT=$O(^XTMP("ZVE-RECENT",USERDUZ,DT),-1) Q:DT=""  Q:CNT'<COUNT  D
 . N DFN S DFN=+$G(^XTMP("ZVE-RECENT",USERDUZ,DT))
 . Q:'DFN  Q:'$D(^DPT(DFN,0))
 . N NM S NM=$P($G(^DPT(DFN,0)),U,1)
 . N DOB S DOB=$P($G(^DPT(DFN,0)),U,3)
 . N SSN S SSN=$P($G(^DPT(DFN,0)),U,9)
 . N SSN4 S SSN4=$S(SSN]"":$E(SSN,$L(SSN)-3,$L(SSN)),1:"")
 . S CNT=CNT+1,OUT(CNT)=DFN_U_NM_U_$$FMTE^XLFDT(DOB)_U_SSN4_U_$$FMTE^XLFDT(DT)
 ;
 S R(0)="1^"_CNT_"^OK"
 N I F I=1:1:CNT S R(I)=OUT(I)
 Q
 ;
RECLOG(DFN) ;
 ; Log a patient access for "recent patients" feature
 ; Called from any patient-accessing RPC
 Q:'DFN
 N NOW S NOW=$$NOW^XLFDT
 S ^XTMP("ZVE-RECENT",$G(DUZ),NOW)=DFN
 ; Set purge date (90 days from now)
 I '$D(^XTMP("ZVE-RECENT",0)) D
 . N PURGE S PURGE=$$FMADD^XLFDT($$DT^XLFDT,90)
 . S ^XTMP("ZVE-RECENT",0)=PURGE_U_$$DT^XLFDT_U_"ZVE Recent Patient Tracking"
 Q
 ;
 ; ============================================================
 ; ZVE PATIENT DECEASED — Record date of death
 ; ============================================================
 ; Params: DFN, DEATHDT, SOURCE, ACTION (RECORD|VERIFY)
 ; Output: "1^OK^DFN^DEATHDT" or "0^error"
 ; Sets PATIENT #2 field .351 (DATE OF DEATH)
 ; ============================================================
DEAD(R,DFN,DEATHDT,SOURCE,ACTION) ;
 S DFN=+$G(DFN)
 I 'DFN S R(0)="0^DFN required" Q
 I '$D(^DPT(DFN,0)) S R(0)="0^Patient not found" Q
 S ACTION=$$UP^XLFSTR($G(ACTION,"RECORD"))
 S DEATHDT=$G(DEATHDT)
 I DEATHDT="" S R(0)="0^DATE OF DEATH required" Q
 S SOURCE=$G(SOURCE,"ADMIN")
 ;
 I ACTION="RECORD" D  Q
 . ; Check if already deceased
 . I $P($G(^DPT(DFN,.35)),U,1)]"" D  Q
 . . S R(0)="0^Patient already marked deceased on "_$P(^DPT(DFN,.35),U,1)
 . ;
 . ; File date of death
 . N FDA,DIERR
 . S FDA(2,DFN_",",.351)=DEATHDT
 . D FILE^DIE("E","FDA","DIERR")
 . I $D(DIERR) S R(0)="0^Failed to record death: "_$G(DIERR("DIERR",1,"TEXT",1)) Q
 . ;
 . D AUDITLOG^ZVEADMIN("DECEASED",DFN,"DOD="_DEATHDT_" Source="_SOURCE)
 . ;
 . ; TODO: Future enhancement — trigger appointment cancellation,
 . ;       pending order cancellation, eligibility update
 . ;
 . S R(0)="1^OK^"_DFN_"^"_DEATHDT
 ;
 I ACTION="VERIFY" D  Q
 . ; Verify existing death record (second confirmation)
 . N EXISTING S EXISTING=$P($G(^DPT(DFN,.35)),U,1)
 . I EXISTING="" S R(0)="0^No death record to verify" Q
 . ;
 . ; Set verification fields
 . N FDA,DIERR
 . S FDA(2,DFN_",",.352)=DUZ ; verified by
 . S FDA(2,DFN_",",.353)=$$NOW^XLFDT ; verified date
 . D FILE^DIE("E","FDA","DIERR")
 . I $D(DIERR) S R(0)="0^Verify failed: "_$G(DIERR("DIERR",1,"TEXT",1)) Q
 . ;
 . D AUDITLOG^ZVEADMIN("DEATH-VERIFY",DFN,"Verified by "_DUZ)
 . S R(0)="1^OK^VERIFIED"
 ;
 S R(0)="0^Invalid ACTION: "_ACTION_" (use RECORD or VERIFY)" Q
 ;
 ; ============================================================
 ; ZVE PAT BRGLSS — Break-the-glass audit (DG SECURITY LOG)
 ; ============================================================
 ; Params: DFN=patient IEN, DUZ=accessing user, REASON=free text
 ; Writes: ^DGSL(38.1,DFN,0) (parent) + ^DGSL(38.1,DFN,"D",AIEN,0)
 ; Returns: 1^OK^<AIEN> or 0^<error>
 ; ============================================================
BRGLSS(R,DFN,DUZ,REASON) ;
 S DFN=+$G(DFN)
 I 'DFN S R(0)="0^DFN required" Q
 S DUZ=+$G(DUZ)
 S REASON=$E($G(REASON),1,65)
 ;
 N U,FNOW,AIEN S U="^"
 S FNOW=$$NOW^XLFDT
 ;
 ; Ensure File 38.1 parent record exists (IEN = DFN per DINUM)
 I '$D(^DGSL(38.1,DFN,0)) D
 . S ^DGSL(38.1,DFN,0)=DFN_U_"1"_U_DUZ_U_FNOW
 . S ^DGSL(38.1,"B",DFN,DFN)=""
 . ; Update file header: increment count
 . S $P(^DGSL(38.1,0),U,4)=$P($G(^DGSL(38.1,0)),U,4)+1
 ;
 ; Add access log entry to subfile 38.11 ("D" subscript, DINUM IEN)
 ; DINUM formula: IEN = 9999999.9999 - FM_datetime
 S AIEN=9999999.9999-FNOW
 S ^DGSL(38.1,DFN,"D",AIEN,0)=FNOW_U_DUZ_U_$E("ZVE:"_REASON,1,65)_U_"n"
 ;
 S R(0)="1^OK^"_DFN_"^"_FNOW_"^"_AIEN
 Q
 ;
 ; ============================================================
 ; ZVE PAT BGREAD — Read break-the-glass audit log for a patient
 ; ============================================================
 ; Params: DFN=patient IEN, MAX=max rows (default 100)
 ; Returns: R(0)="1^count^OK" then R(1..n)="AIEN^FNOW^DUZ^REASON^INPAT"
 ; Reads:  ^DGSL(38.1,DFN,"D",AIEN,0)
 ; ============================================================
BGREAD(R,DFN,MAX) ;
 S DFN=+$G(DFN)
 I 'DFN S R(0)="0^DFN required" Q
 S MAX=+$G(MAX,100)
 I 'MAX S MAX=100
 ;
 N U S U="^"
 N n,cnt,AIEN S n=0,cnt=0
 ; Walk "D" subfile forward (smallest IEN = most recent access due to DINUM)
 S AIEN=0
 F  S AIEN=$O(^DGSL(38.1,DFN,"D",AIEN)) Q:AIEN=""!(cnt>=MAX)  D
 . N ROW S ROW=$G(^DGSL(38.1,DFN,"D",AIEN,0))
 . S cnt=cnt+1
 . S R(cnt)=AIEN_U_$P(ROW,U,1)_U_$P(ROW,U,2)_U_$P(ROW,U,3)_U_$P(ROW,U,4)
 ;
 S R(0)="1^"_cnt_"^OK"
 Q
 ;
 ; ============================================================
 ; ZVE PAT RESTRICT — Set/clear patient record sensitivity
 ; ============================================================
 ; Params: DFN=patient IEN, LEVEL=none|level1|level2, DUZ=user IEN
 ; Writes: ^DGSL(38.1,DFN,0) — updates or creates parent record
 ;         Security level: 0=NON-SENSITIVE, 1=SENSITIVE
 ; Returns: 1^OK^DFN^SEC or 0^error
 ; ============================================================
RESTRICT(R,DFN,LEVEL,DUZ) ;
 S DFN=+$G(DFN)
 I 'DFN S R(0)="0^DFN required" Q
 S DUZ=+$G(DUZ)
 S LEVEL=$G(LEVEL,"none")
 ;
 N U,SEC,FNOW S U="^"
 S FNOW=$$NOW^XLFDT
 ; Map UI level to VistA security code: none->0, level1/level2->1
 S SEC=$S(LEVEL="none":0,1:1)
 ;
 I $D(^DGSL(38.1,DFN,0)) D
 . ; Update existing record pieces 2 (level), 3 (DUZ), 4 (date)
 . S $P(^DGSL(38.1,DFN,0),U,2)=SEC
 . S $P(^DGSL(38.1,DFN,0),U,3)=DUZ
 . S $P(^DGSL(38.1,DFN,0),U,4)=FNOW
 E  D
 . ; Create new record (DINUM: IEN = DFN)
 . S ^DGSL(38.1,DFN,0)=DFN_U_SEC_U_DUZ_U_FNOW
 . S ^DGSL(38.1,"B",DFN,DFN)=""
 . S $P(^DGSL(38.1,0),U,4)=$P($G(^DGSL(38.1,0)),U,4)+1
 ;
 S R(0)="1^OK^"_DFN_"^"_SEC
 Q
