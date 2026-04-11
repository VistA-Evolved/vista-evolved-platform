ZVEADMIN ; VE — Admin User Management RPCs (list, detail, edit, terminate, audit) ; Apr 2026
 ;;1.0;VISTA EVOLVED;**1**;Apr 2026;Build 1
 ;
 ; RPCs in this routine:
 ;   ZVE USER LIST    - List users from NEW PERSON #200
 ;   ZVE USER DETAIL  - Get full user record
 ;   ZVE USER EDIT    - Edit user fields
 ;   ZVE USER TERM    - Terminate user (DISUSER + clear access)
 ;   ZVE ADMIN AUDIT  - Read aggregated audit trail
 ;   ZVE USER RENAME  - Rename user .01 field
 ;
 ; Output convention: S R(n)="1^..." for success, S R(0)="0^error" for failure
 ; Matches callZveRpc() in vista-adapter.mjs — RPC broker type=2 ARRAY
 ;
 Q  ; No direct entry
 ;
 ; ============================================================
 ; INSTALL — Register RPCs in File #8994 (idempotent)
 ; ============================================================
INSTALL ;
 W !,"=== Installing ZVEADMIN RPCs ==="
 D REGONE("ZVE USER LIST","LIST2","ZVEADMIN","List users from NEW PERSON #200")
 D REGONE("ZVE USER DETAIL","DETAIL","ZVEADMIN","Full user detail from #200")
 D REGONE("ZVE USER EDIT","EDIT","ZVEADMIN","Edit user fields in #200")
 D REGONE("ZVE USER TERM","TERM","ZVEADMIN","Terminate user account")
 D REGONE("ZVE ADMIN AUDIT","AUDIT","ZVEADMIN","Aggregated audit trail")
 D REGONE("ZVE USER RENAME","RENAME","ZVEADMIN","Rename user .01 field")
 W !,"=== ZVEADMIN install complete ==="
 Q
 ;
 ; ============================================================
 ; ZVE USER LIST — List users from NEW PERSON file (#200)
 ; ============================================================
 ; Params: SEARCH (text filter), STATUS (active/inactive/all),
 ;         DIVISION (IEN), MAX (limit, default 200)
 ; Output: multi-line, 1 header + N data rows
 ;   Line 1: "1^COUNT^OK"
 ;   Line 2+: "IEN^NAME^STATUS^TITLE^SERVICE^DIVISION^LASTLOGIN^KEYCOUNT"
 ; ============================================================
LIST2(R,SEARCH,STATUS,DIVISION,MAX) ;
 ; List users from NEW PERSON #200 — collects into array, writes header first
 N IEN,NM,CNT,MAXR,DISUSER,TITLE,SVC,LASTLOG,KCNT,DIVNM,DIVMATCH,DIEN,OUT,ISPROV
 S CNT=0
 S MAXR=+$G(MAX) I MAXR<1 S MAXR=200
 S SEARCH=$$UP^XLFSTR($G(SEARCH))
 S STATUS=$G(STATUS,"all")
 S DIVISION=$G(DIVISION)
 ;
 S NM="" F  S NM=$O(^VA(200,"B",NM)) Q:NM=""  Q:CNT'<MAXR  D
 . I SEARCH]"",$$UP^XLFSTR(NM)'[SEARCH Q
 . S IEN=0 F  S IEN=$O(^VA(200,"B",NM,IEN)) Q:'IEN  Q:CNT'<MAXR  D
 . . I IEN<1 Q
 . . I NM="POSTMASTER" Q
 . . S DISUSER=$P($G(^VA(200,IEN,7)),U,1)
 . . N TERMDT S TERMDT=$P($G(^VA(200,IEN,"TERM")),U,1)
 . . I TERMDT="" S TERMDT=$P($G(^VA(200,IEN,0)),U,11)
 . . ; C008: Check locked status from ^XUSEC
 . . N ISLOCKED S ISLOCKED=$D(^XUSEC("LOCKED",IEN))
 . . N STAT S STAT=$S(ISLOCKED:"LOCKED",DISUSER]""&(TERMDT]""):"TERMINATED",DISUSER]"":"INACTIVE",TERMDT]"":"TERMINATED",1:"ACTIVE")
 . . I STATUS="active",STAT'="ACTIVE" Q
 . . I STATUS="inactive",STAT="ACTIVE" Q
 . . I DIVISION]"" D  Q:'DIVMATCH
 . . . S DIVMATCH=0,DIEN=0
 . . . F  S DIEN=$O(^VA(200,IEN,2,DIEN)) Q:'DIEN  D  Q:DIVMATCH
 . . . . I $P($G(^VA(200,IEN,2,DIEN,0)),U,1)=DIVISION S DIVMATCH=1
 . . S TITLE=$P($G(^VA(200,IEN,0)),U,9)
 . . I TITLE="" S TITLE=$$GET1^DIQ(200,IEN_",",8,"E")
 . . S SVC=$$GET1^DIQ(200,IEN_",",29,"E")
 . . S LASTLOG=$$GET1^DIQ(200,IEN_",",.101,"E")
 . . S KCNT=0 N KI S KI=0
 . . F  S KI=$O(^VA(200,IEN,51,KI)) Q:'KI  S KCNT=KCNT+1
 . . S DIVNM="" S DIEN=$O(^VA(200,IEN,2,0))
 . . I DIEN>0 D
 . . . N DIVIEN S DIVIEN=$P($G(^VA(200,IEN,2,DIEN,0)),U,1)
 . . . I DIVIEN>0 S DIVNM=$$GET1^DIQ(40.8,DIVIEN_",",1,"E")
 . . S CNT=CNT+1
 . . S ISPROV=$S($D(^XUSEC("PROVIDER",IEN)):1,$$GET1^DIQ(200,IEN_",",41.99,"I")]"":1,1:0)
 . . S OUT(CNT)=IEN_U_NM_U_STAT_U_TITLE_U_SVC_U_DIVNM_U_LASTLOG_U_KCNT_U_ISPROV
 ;
 ; Output results to R array (RPC broker type=2 ARRAY)
 S R(0)="1^"_CNT_"^OK"
 N I F I=1:1:CNT S R(I)=OUT(I)
 Q
 ;
 ; ============================================================
 ; ZVE USER DETAIL — Full user detail from #200
 ; ============================================================
 ; Params: TARGETDUZ
 ; Output:
 ;   Line 1: "1^1^OK"
 ;   Line 2: IEN^NAME^DOB^SEX^SSN^STATUS^TITLE^SERVICE^EMAIL^PHONE^
 ;           LASTLOGIN^NPI^DEA^TAXONOMY^PROVIDERCLASS^ESIGSTATUS
 ;   Line 3+: "KEY^keyIEN^keyNAME"
 ;   Line N+: "DIV^divIEN^divNAME^station"
 ; ============================================================
DETAIL(R,TARGETDUZ) ;
 S TARGETDUZ=+$G(TARGETDUZ)
 I 'TARGETDUZ S R(0)="0^DUZ parameter required" Q
 I '$D(^VA(200,TARGETDUZ,0)) S R(0)="0^User not found: "_TARGETDUZ Q
 ;
 N NM,DOB,SEX,SSN,DISUSER,TITLE,SVC,EMAIL,PHONE,LASTLOG
 N NPI,DEA,TAXON,PCLASS,ESIG,STAT
 ;
 S NM=$P($G(^VA(200,TARGETDUZ,0)),U,1)
 S DOB=$$GET1^DIQ(200,TARGETDUZ_",",5,"E")
 S SEX=$$GET1^DIQ(200,TARGETDUZ_",",4,"E")
 S SSN=$$GET1^DIQ(200,TARGETDUZ_",",9,"E")
 ; G003: Mask SSN to last 4 digits — never expose full SSN via API
 I $L(SSN)>4 S SSN="***-**-"_$E(SSN,$L(SSN)-3,$L(SSN))
 S DISUSER=$P($G(^VA(200,TARGETDUZ,7)),U,1)
 ; C007: Check TERMDT and LOCKED for consistent status across LIST2/DETAIL
 N TERMDT2 S TERMDT2=$P($G(^VA(200,TARGETDUZ,"TERM")),U,1)
 I TERMDT2="" S TERMDT2=$P($G(^VA(200,TARGETDUZ,0)),U,11)
 N ISLOCKED S ISLOCKED=$D(^XUSEC("LOCKED",TARGETDUZ))
 S STAT=$S(ISLOCKED:"LOCKED",DISUSER]""&(TERMDT2]""):"TERMINATED",DISUSER]"":"INACTIVE",TERMDT2]"":"TERMINATED",1:"ACTIVE")
 S TITLE=$$GET1^DIQ(200,TARGETDUZ_",",8,"E")
 S SVC=$$GET1^DIQ(200,TARGETDUZ_",",29,"E")
 S EMAIL=$$GET1^DIQ(200,TARGETDUZ_",",.151,"E")
 S PHONE=$$GET1^DIQ(200,TARGETDUZ_",",.132,"E")
 S LASTLOG=$$GET1^DIQ(200,TARGETDUZ_",",.101,"E")
 S NPI=$$GET1^DIQ(200,TARGETDUZ_",",41.99,"E")
 S DEA=$$GET1^DIQ(200,TARGETDUZ_",",53.2,"E")
 S TAXON=$$GET1^DIQ(200,TARGETDUZ_",",53.5,"E")
 S PCLASS=$$GET1^DIQ(200,TARGETDUZ_",",53.1,"E")
 ;
 ; E-sig status (never reveal the hash)
 S ESIG=$S($D(^VA(200,TARGETDUZ,20)):"SET",1:"NONE")
 ;
 ; Additional fields for detail panel
 N PMENU S PMENU=$$GET1^DIQ(200,TARGETDUZ_",",201,"E")
 N DEGREE S DEGREE=$$GET1^DIQ(200,TARGETDUZ_",",10.6)
 N TDATE S TDATE=$$GET1^DIQ(200,TARGETDUZ_",",9.2,"E")
 N TREASON S TREASON=$$GET1^DIQ(200,TARGETDUZ_",",9.4)
 N PCLASS2 S PCLASS2=$$GET1^DIQ(200,TARGETDUZ_",",8932.1,"E")
 N TAXID S TAXID=$$GET1^DIQ(200,TARGETDUZ_",",53.3)
 N AUTHMEDS S AUTHMEDS=$$GET1^DIQ(200,TARGETDUZ_",",53.11,"I")
 N COSIGNER S COSIGNER=$$GET1^DIQ(200,TARGETDUZ_",",53.42,"E")
 ;
 ; Chapter-1 expansion — six additional fields for admin detail panel
 N RESTRICT S RESTRICT=$$GET1^DIQ(200,TARGETDUZ_",",101.01,"E")
 N VCNOEXP S VCNOEXP=$$GET1^DIQ(200,TARGETDUZ_",",9.5,"I")
 N LANG S LANG=$$GET1^DIQ(200,TARGETDUZ_",",200.07,"E")
 N FMAC S FMAC=$$GET1^DIQ(200,TARGETDUZ_",",3,"E")
 N OERR S OERR=$$GET1^DIQ(200,TARGETDUZ_",",200.0001,"E")
 N PROXY S PROXY=$$GET1^DIQ(200,TARGETDUZ_",",203.1,"E")
 ;
 ; Output into R array (RPC broker type=2 ARRAY)
 N LN S LN=0
 S R(LN)="1^1^OK"
 S LN=LN+1,R(LN)=TARGETDUZ_U_NM_U_DOB_U_SEX_U_SSN_U_STAT_U_TITLE_U_SVC_U_EMAIL_U_PHONE_U_LASTLOG_U_NPI_U_DEA_U_TAXON_U_PCLASS_U_ESIG
 S R(LN)=R(LN)_U_PMENU_U_DEGREE_U_TDATE_U_TREASON_U_PCLASS2_U_TAXID_U_AUTHMEDS_U_COSIGNER
 S R(LN)=R(LN)_U_RESTRICT_U_VCNOEXP_U_LANG_U_FMAC_U_OERR_U_PROXY
 ;
 ; Keys — field 51 (KEYS) stores a POINTER to SECURITY KEY #19.1 when
 ; populated through the standard Kernel KEYS option. Our in-house ZVE
 ; USMG KEYS RPC writes the key NAME as a raw string instead. DETAIL
 ; handles both formats: first try the DIQ pointer resolution (external
 ; value); if that comes back empty, fall back to piece 1 of the zero
 ; node (which is the raw name under the ZVE USMG convention).
 N KIEN,KNAME,KKIEN,KIENS,RAW
 S KIEN=0 F  S KIEN=$O(^VA(200,TARGETDUZ,51,KIEN)) Q:'KIEN  D
 . S KIENS=KIEN_","_TARGETDUZ_","
 . S KKIEN=$$GET1^DIQ(200.051,KIENS,.01,"I")
 . S KNAME=$$GET1^DIQ(200.051,KIENS,.01,"E")
 . I KNAME="" D
 . . S RAW=$P($G(^VA(200,TARGETDUZ,51,KIEN,0)),U,1)
 . . I RAW="" Q
 . . S KNAME=RAW
 . . S KKIEN=$O(^DIC(19.1,"B",RAW,0))
 . I KNAME="" Q
 . S LN=LN+1,R(LN)="KEY"_U_$G(KKIEN)_U_KNAME
 ;
 ; Divisions
 N DI,DIVIEN,DIVNM,STATION
 S DI=0 F  S DI=$O(^VA(200,TARGETDUZ,2,DI)) Q:'DI  D
 . S DIVIEN=$P($G(^VA(200,TARGETDUZ,2,DI,0)),U,1)
 . I 'DIVIEN Q
 . S DIVNM=$$GET1^DIQ(40.8,DIVIEN_",",1,"E")
 . S STATION=$$GET1^DIQ(40.8,DIVIEN_",",.01,"E")
 . S LN=LN+1,R(LN)="DIV"_U_DIVIEN_U_DIVNM_U_STATION
 ;
 Q
 ;
 ; ============================================================
 ; ZVE USER EDIT — Edit user fields in #200
 ; ============================================================
 ; Params: TARGETDUZ, FIELD, VALUE
 ;   FIELD = "TITLE"|"SERVICE"|"PHONE"|"EMAIL"|"PROVIDER_CLASS"
 ; Output: "1^OK^fieldName" or "0^error"
 ; ============================================================
EDIT(R,TARGETDUZ,FIELD,VALUE) ;
 S TARGETDUZ=+$G(TARGETDUZ)
 I 'TARGETDUZ S R(0)="0^DUZ required" Q
 I '$D(^VA(200,TARGETDUZ,0)) S R(0)="0^User not found" Q
 S FIELD=$G(FIELD)
 I FIELD="" S R(0)="0^FIELD required" Q
 ;
 N FDA,DIERR,IENS,FNUM
 S IENS=TARGETDUZ_","
 ;
 ; Map friendly field names to File 200 field numbers
 I FIELD="TITLE" S FNUM=8
 E  I FIELD="SERVICE" S FNUM=29
 E  I FIELD="PHONE" S FNUM=.132
 E  I FIELD="EMAIL" S FNUM=.151
 E  I FIELD="PROVIDER_CLASS" S FNUM=53.5
 E  I FIELD="SEX" S FNUM=4
 E  I FIELD="DOB" S FNUM=5
 E  I FIELD="SSN" S FNUM=9
 E  I FIELD="NPI" S FNUM=41.99
 E  I FIELD="DEA" S FNUM=53.2
 E  D  Q
 . S R(0)="0^Unknown field: "_FIELD Q
 ;
 ; SSN uniqueness check
 I FIELD="SSN",$G(VALUE)]"" D  Q:$D(DIERR)
 . N DSSN S DSSN=$O(^VA(200,"SSN",$G(VALUE),0))
 . I DSSN,DSSN'=TARGETDUZ S DIERR=1 S R(0)="0^SSN already assigned to user "_DSSN Q
 ;
 S FDA(200,IENS,FNUM)=$G(VALUE)
 D FILE^DIE("E","FDA","DIERR")
 I $D(DIERR) S R(0)="0^Edit failed: "_$G(DIERR("DIERR",1,"TEXT",1)) Q
 ;
 ; Audit
 D AUDITLOG("USER-EDIT",TARGETDUZ,FIELD_"="_$G(VALUE))
 ;
 S R(0)="1^OK^"_FIELD Q
 ;
 ; ============================================================
 ; ZVE USER TERM — Terminate user
 ; ============================================================
 ; Sets DISUSER flag, TERMINATION DATE, clears access/verify codes
 ; Params: TARGETDUZ, REASON
 ; Output: "1^OK" or "0^error"
 ; ============================================================
TERM(R,TARGETDUZ,REASON) ;
 S TARGETDUZ=+$G(TARGETDUZ)
 I 'TARGETDUZ S R(0)="0^DUZ required" Q
 I '$D(^VA(200,TARGETDUZ,0)) S R(0)="0^User not found" Q
 ;
 ; Cannot terminate yourself
 I TARGETDUZ=$G(DUZ) S R(0)="0^Cannot terminate your own account" Q
 ;
 N FDA,DIERR,IENS
 S IENS=TARGETDUZ_","
 ;
 ; Set DISUSER (#7) — internal code is 1 for YES
 S FDA(200,IENS,7)=1
 ;
 ; Set TERMINATION DATE (#9.2) to now (internal FM format)
 S FDA(200,IENS,9.2)=$$NOW^XLFDT
 ;
 ; Clear ACCESS CODE (#2) and VERIFY CODE (#11)
 S FDA(200,IENS,2)="@"
 S FDA(200,IENS,11)="@"
 ;
 D FILE^DIE("K","FDA","DIERR")
 I $D(DIERR) S R(0)="0^Terminate failed: "_$G(DIERR("DIERR",1,"TEXT",1)) Q
 ;
 ; Clear e-signature
 K ^VA(200,TARGETDUZ,20)
 ;
 ; Remove from ^XUSEC AND clear ^VA(200,x,51) to stay in sync
 N KEY S KEY="" F  S KEY=$O(^XUSEC(KEY)) Q:KEY=""  K ^XUSEC(KEY,TARGETDUZ)
 K ^VA(200,TARGETDUZ,51)
 ;
 ; Audit
 D AUDITLOG("USER-TERM",TARGETDUZ,$G(REASON,"No reason provided"))
 ;
 S R(0)="1^OK" Q
 ;
 ; ============================================================
 ; ZVE USER RENAME — Rename user .01 field
 ; ============================================================
 ; Params: TARGETDUZ, NEWNAME
 ; Output: "1^OK^newname" or "0^error"
 ; ============================================================
RENAME(R,TARGETDUZ,NEWNAME) ;
 S TARGETDUZ=+$G(TARGETDUZ)
 I 'TARGETDUZ S R(0)="0^DUZ required" Q
 I '$D(^VA(200,TARGETDUZ,0)) S R(0)="0^User not found" Q
 S NEWNAME=$G(NEWNAME)
 I NEWNAME="" S R(0)="0^New name required" Q
 ;
 ; Enforce LAST,FIRST format (uppercase, comma required)
 S NEWNAME=$$UP^XLFSTR(NEWNAME)
 I NEWNAME'?1.ANP1","1.ANP S R(0)="0^Name must be LAST,FIRST format" Q
 ;
 ; Check for duplicate name
 I $D(^VA(200,"B",NEWNAME)) S R(0)="0^Name already exists in File 200" Q
 ;
 N FDA,DIERR,IENS
 S IENS=TARGETDUZ_","
 S FDA(200,IENS,.01)=NEWNAME
 D FILE^DIE("E","FDA","DIERR")
 I $D(DIERR) S R(0)="0^Rename failed: "_$G(DIERR("DIERR",1,"TEXT",1)) Q
 ;
 D AUDITLOG("USER-RENAME",TARGETDUZ,NEWNAME)
 ;
 S R(0)="1^OK^"_NEWNAME Q
 ;
 ; ============================================================
 ; ZVE ADMIN AUDIT — Aggregated audit trail
 ; ============================================================
 ; Params: SOURCE (fileman/signon/error/zve/all), USERDUZ, MAX
 ; Output:
 ;   Line 1: "1^COUNT^OK"
 ;   Lines 2+: "DATETIME^USERNAME^ACTION^SOURCE^DETAIL"
 ; ============================================================
AUDIT(R,SOURCE,USERDUZ,MAX) ;
 N CNT,MAXR,OUT
 S CNT=0,MAXR=+$G(MAX) I MAXR<1 S MAXR=100
 S SOURCE=$G(SOURCE,"all")
 S USERDUZ=$G(USERDUZ)
 ;
 ; FileMan audit from ^DIA
 I SOURCE="fileman"!(SOURCE="all") D AUDFIA(.OUT,.CNT,USERDUZ,MAXR)
 ;
 ; Sign-on log
 I SOURCE="signon"!(SOURCE="all") D AUDSIG(.OUT,.CNT,USERDUZ,MAXR)
 ;
 ; Error trap
 I SOURCE="error"!(SOURCE="all") D AUDERR(.OUT,.CNT,MAXR)
 ;
 ; ZVE custom audit (^XTMP("ZVE-AUDIT"))
 I SOURCE="zve"!(SOURCE="all") D AUDZVE(.OUT,.CNT,USERDUZ,MAXR)
 ;
 ; Output
 S R(0)="1^"_CNT_"^OK"
 N I F I=1:1:CNT S R(I)=OUT(I)
 Q
 ;
 ; --- Audit: FileMan ^DIA ---
AUDFIA(OUT,CNT,USERDUZ,MAXR) ;
 N FILE,IEN,DT,USR,FLD,USRNM
 S FILE=0 F  S FILE=$O(^DIA(FILE)) Q:'FILE  Q:CNT'<MAXR  D
 . S IEN=0 F  S IEN=$O(^DIA(FILE,IEN)) Q:'IEN  Q:CNT'<MAXR  D
 . . S DT=$P($G(^DIA(FILE,IEN,0)),U,1) Q:DT=""
 . . S USR=$P($G(^DIA(FILE,IEN,0)),U,2)
 . . I USERDUZ]"",USR'=USERDUZ Q
 . . S USRNM=$S(USR>0:$$GET1^DIQ(200,USR_",",.01,"E"),1:"SYSTEM")
 . . S FLD=$P($G(^DIA(FILE,IEN,0)),U,3)
 . . S CNT=CNT+1
 . . S OUT(CNT)=$$FMTE^XLFDT(DT)_U_USRNM_U_"DATA-EDIT"_U_"DATA-AUDIT"_U_"File "_FILE_" Field "_FLD
 Q
 ;
 ; --- Audit: Sign-on log ---
AUDSIG(OUT,CNT,USERDUZ,MAXR) ;
 N IEN,DT,USR,IP,USRNM
 ; SIGN-ON LOG file #3.081 (^%ZUA(3.081))
 ; Some systems use ^XUSEC(0) but that's SECURITY KEY xref; use ^%ZUA
 I '$D(^%ZUA(3.081)) Q  ; No sign-on log available
 S IEN="" F  S IEN=$O(^%ZUA(3.081,IEN),-1) Q:IEN=""  Q:CNT'<MAXR  D
 . S DT=$P($G(^%ZUA(3.081,IEN,0)),U,1) Q:DT=""
 . S USR=$P($G(^%ZUA(3.081,IEN,0)),U,2)
 . I USERDUZ]"",USR'=USERDUZ Q
 . S USRNM=$S(USR>0:$$GET1^DIQ(200,USR_",",.01,"E"),1:"UNKNOWN")
 . S IP=$P($G(^%ZUA(3.081,IEN,4)),U,1)
 . S CNT=CNT+1
 . S OUT(CNT)=$$FMTE^XLFDT(DT)_U_USRNM_U_"SIGNON"_U_"SIGN-ON"_U_"IP: "_IP
 Q
 ;
 ; --- Audit: Error trap ---
AUDERR(OUT,CNT,MAXR) ;
 N IEN,DT,ERR
 S IEN="" F  S IEN=$O(^%ZTER(1,IEN),-1) Q:IEN=""  Q:CNT'<MAXR  D
 . S DT=$P($G(^%ZTER(1,IEN,0)),U,1) Q:DT=""
 . S ERR=$G(^%ZTER(1,IEN,"ZE"))
 . I ERR="" S ERR=$P($G(^%ZTER(1,IEN,0)),U,2)
 . S CNT=CNT+1
 . S OUT(CNT)=$$FMTE^XLFDT(DT)_U_"SYSTEM"_U_"ERROR"_U_"ERROR-TRAP"_U_ERR
 Q
 ;
 ; --- Audit: ZVE custom audit ---
AUDZVE(OUT,CNT,USERDUZ,MAXR) ;
 N SEQ,DT,USR,ACT,DETAIL,USRNM
 S SEQ="" F  S SEQ=$O(^XTMP("ZVE-AUDIT",SEQ),-1) Q:SEQ=""  Q:SEQ=0  Q:CNT'<MAXR  D
 . S DT=$P($G(^XTMP("ZVE-AUDIT",SEQ)),U,1) Q:DT=""
 . S USR=$P($G(^XTMP("ZVE-AUDIT",SEQ)),U,2)
 . I USERDUZ]"",USR'=USERDUZ Q
 . S ACT=$P($G(^XTMP("ZVE-AUDIT",SEQ)),U,3)
 . S DETAIL=$P($G(^XTMP("ZVE-AUDIT",SEQ)),U,4,99)
 . S USRNM=$S(USR>0:$$GET1^DIQ(200,USR_",",.01,"E"),1:"SYSTEM")
 . S CNT=CNT+1
 . S OUT(CNT)=$$FMTE^XLFDT(DT)_U_USRNM_U_ACT_U_"ZVE-AUDIT"_U_DETAIL
 Q
 ;
 ; ============================================================
 ; Internal: Create audit log entry in ^XTMP("ZVE-AUDIT")
 ; ============================================================
AUDITLOG(ACTION,IEN,DETAIL) ;
 N DT,SEQ
 S DT=$$NOW^XLFDT
 ; Use $INCREMENT for atomic sequence generation (prevents race condition)
 S SEQ=$I(^XTMP("ZVE-AUDIT"))
 S ^XTMP("ZVE-AUDIT",SEQ)=DT_U_$G(DUZ)_U_ACTION_U_$G(DETAIL)
 ; Set purge header ONLY if not already present (prevents perpetual rollforward)
 I '$D(^XTMP("ZVE-AUDIT",0)) D
 . S ^XTMP("ZVE-AUDIT",0)=$$FMADD^XLFDT(DT,1095)_U_DT_U_"VistA Evolved Audit Trail"
 Q
 ;
 ; ============================================================
 ; Reusable: Register one RPC in File #8994
 ; ============================================================
REGONE(NAME,TAG,RTN,DESC) ;
 N IEN S IEN=$$FIND1^DIC(8994,,"BX",NAME)
 I IEN>0 W !,"  ",NAME," already registered (IEN ",IEN,")" Q
 N FDA,ERR
 S FDA(8994,"+1,",.01)=NAME
 S FDA(8994,"+1,",.02)=TAG
 S FDA(8994,"+1,",.03)=RTN
 S FDA(8994,"+1,",.04)=2 ; Type 2 = Broker
 D UPDATE^DIE("E","FDA","","ERR")
 I $D(ERR) W !,"  ERROR registering ",NAME,": ",$G(ERR("DIERR",1,"TEXT",1)) Q
 W !,"  Registered: ",NAME
 Q
