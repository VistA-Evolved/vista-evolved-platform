ZVEPAT ; VE — Patient Registration, Demographics, Edit RPCs ; Apr 2026
 ;;1.0;VISTA EVOLVED;**1**;Apr 2026;Build 1
 ;
 ; RPCs in this routine:
 ;   ZVE PATIENT REGISTER     - Register new patient
 ;   ZVE PATIENT EDIT         - Edit patient demographics
 ;   ZVE PATIENT DEMOGRAPHICS - Full demographic read
 ;   ZVE PATIENT INSURANCE    - Insurance list/add/edit
 ;   ZVE PATIENT MEANS        - Means test read/initiate
 ;   ZVE PATIENT ELIG         - Eligibility read
 ;
 Q  ; No direct entry
 ;
INSTALL ;
 W !,"=== Installing ZVEPAT RPCs ==="
 D REGONE^ZVEADMIN("ZVE PATIENT REGISTER","REG","ZVEPAT","Register new patient")
 D REGONE^ZVEADMIN("ZVE PATIENT EDIT","EDIT","ZVEPAT","Edit patient demographics")
 D REGONE^ZVEADMIN("ZVE PATIENT DEMOGRAPHICS","DEMO","ZVEPAT","Read patient demographics")
 D REGONE^ZVEADMIN("ZVE PATIENT INSURANCE","INS","ZVEPAT","Insurance management")
 D REGONE^ZVEADMIN("ZVE PATIENT MEANS","MEANS","ZVEPAT","Means test read/initiate")
 D REGONE^ZVEADMIN("ZVE PATIENT ELIG","ELIG","ZVEPAT","Eligibility read")
 W !,"=== ZVEPAT install complete ==="
 Q
 ;
 ; ============================================================
 ; ZVE PATIENT REGISTER — Register new patient in PATIENT #2
 ; ============================================================
 ; Params: NAME, DOB, SSN, SEX, STREET1, CITY, STATE, ZIP, PHONE,
 ;         MARITAL, VETERAN, SCPCT
 ; Output: "1^DFN^name^ssn_last4" or "0^error"
 ; NAME must be LAST,FIRST format
 ; SSN must be 9 digits and unique
 ; ============================================================
REG(R,NAME,DOB,SSN,SEX,STREET1,CITY,STATE,ZIP,PHONE,MARITAL,VETERAN,SCPCT) ;
 S NAME=$$UP^XLFSTR($G(NAME))
 I NAME="" S R(0)="0^NAME required (LAST,FIRST format)" Q
 I NAME'?1.ANP1","1.ANP S R(0)="0^NAME must be LAST,FIRST format" Q
 ;
 S SSN=$G(SSN)
 I SSN="" S R(0)="0^SSN required" Q
 I SSN'?9N S R(0)="0^SSN must be 9 digits" Q
 I $E(SSN)=9 S R(0)="0^SSN must not begin with 9" Q
 ;
 ; SSN uniqueness check
 I $D(^DPT("SSN",SSN)) S R(0)="0^SSN already exists in patient file" Q
 ;
 S DOB=$G(DOB) I DOB="" S R(0)="0^DOB required" Q
 S SEX=$G(SEX) I SEX="" S R(0)="0^SEX required (M or F)" Q
 ;
 ; Build FDA for PATIENT #2
 N FDA,DFN,DIERR,DLAYGO
 S DLAYGO=2
 S FDA(2,"+1,",.01)=NAME
 S FDA(2,"+1,",.02)=SEX
 S FDA(2,"+1,",.03)=DOB
 S FDA(2,"+1,",.09)=SSN
 ;
 I $G(STREET1)]"" S FDA(2,"+1,",.111)=STREET1
 I $G(CITY)]"" S FDA(2,"+1,",.114)=CITY
 I $G(STATE)]"" S FDA(2,"+1,",.115)=STATE
 I $G(ZIP)]"" S FDA(2,"+1,",.116)=ZIP
 I $G(PHONE)]"" S FDA(2,"+1,",.131)=PHONE
 I $G(MARITAL)]"" S FDA(2,"+1,",.05)=MARITAL
 I $G(VETERAN)]"" S FDA(2,"+1,",.301)=VETERAN
 I $G(SCPCT)]"" S FDA(2,"+1,",.302)=SCPCT
 ;
 ; Required identifier fields for File #2
 S FDA(2,"+1,",1901)=$S($G(VETERAN)="Y":"Y",1:"N")
 S FDA(2,"+1,",391)=$S($G(VETERAN)="Y":"NSC VETERAN",1:"NON-VETERAN (OTHER)")
 ;
 ; Save params before UPDATE^DIE (FileMan may KILL local vars)
 N ZVESSN,ZVENAME S ZVESSN=SSN,ZVENAME=NAME
 N DIEN S DIEN(1)=""
 D UPDATE^DIE("E","FDA","DIEN","DIERR")
 I $D(DIERR) D  Q
 . S R(0)="0^Registration failed: "_$G(DIERR("DIERR",1,"TEXT",1))
 ;
 S DFN=+DIEN(1)
 I 'DFN S DFN=+$O(^DPT("SSN",ZVESSN,""))
 I 'DFN S R(0)="0^Registration failed: no DFN returned" Q
 ;
 D AUDITLOG^ZVEADMIN("PAT-REG",DFN,"Registered: "_ZVENAME)
 ;
 N SSN4 S SSN4=$E(ZVESSN,6,9)
 S R(0)="1^"_DFN_"^"_ZVENAME_"^"_SSN4 Q
 ;
 ; ============================================================
 ; ZVE PATIENT EDIT — Edit patient demographic fields
 ; ============================================================
 ; Params: DFN, FIELD, VALUE
 ; Output: "1^OK^field^value" or "0^error"
 ; ============================================================
EDIT(R,DFN,FIELD,VALUE) ;
 S DFN=+$G(DFN)
 I 'DFN S R(0)="0^DFN required" Q
 I '$D(^DPT(DFN,0)) S R(0)="0^Patient not found" Q
 S FIELD=$$UP^XLFSTR($G(FIELD))
 I FIELD="" S R(0)="0^FIELD required" Q
 S VALUE=$G(VALUE)
 ;
 ; Map friendly field names to PATIENT #2 field numbers
 N FNUM S FNUM=""
 I FIELD="NAME" S FNUM=.01
 E  I FIELD="SEX" S FNUM=.02
 E  I FIELD="DOB" S FNUM=.03
 E  I FIELD="MARITAL STATUS" S FNUM=.05
 E  I FIELD="RACE" S FNUM=.06
 E  I FIELD="OCCUPATION" S FNUM=.07
 E  I FIELD="RELIGION" S FNUM=.08
 E  I FIELD="SSN" S FNUM=.09
 E  I FIELD="STREET" S FNUM=.111
 E  I FIELD="STREET2" S FNUM=.112
 E  I FIELD="CITY" S FNUM=.114
 E  I FIELD="STATE" S FNUM=.115
 E  I FIELD="ZIP" S FNUM=.116
 E  I FIELD="PHONE" S FNUM=.131
 E  I FIELD="WORK PHONE" S FNUM=.132
 E  I FIELD="CELL PHONE" S FNUM=.133
 E  I FIELD="EMAIL" S FNUM=.135
 E  I FIELD="VETERAN" S FNUM=.301
 E  I FIELD="SC PERCENT" S FNUM=.302
 E  D  Q
 . S R(0)="0^Unknown field: "_FIELD
 ;
 ; Edit-specific validations
 I FIELD="NAME" D  Q:$G(BADNAME)
 . I VALUE'?1.ANP1","1.ANP S BADNAME=1 S R(0)="0^NAME must be LAST,FIRST format" Q
 . I $D(^DPT("B",VALUE)) S BADNAME=1 S R(0)="0^Duplicate patient name exists — verify before proceeding" Q
 ;
 I FIELD="SSN" D  Q:$G(BADSSN)
 . I VALUE'?9N S BADSSN=1 S R(0)="0^SSN must be 9 digits" Q
 . N OLDSSN S OLDSSN=$P($G(^DPT(DFN,0)),U,9)
 . I $D(^DPT("SSN",VALUE)),VALUE'=OLDSSN S BADSSN=1 S R(0)="0^SSN already in use by another patient" Q
 ;
 N FDA,DIERR
 S FDA(2,DFN_",",FNUM)=VALUE
 D FILE^DIE("E","FDA","DIERR")
 I $D(DIERR) S R(0)="0^Edit failed: "_$G(DIERR("DIERR",1,"TEXT",1)) Q
 ;
 D AUDITLOG^ZVEADMIN("PAT-EDIT",DFN,FIELD_"="_VALUE)
 ;
 S R(0)="1^OK^"_FIELD_"^"_VALUE Q
 ;
 ; ============================================================
 ; ZVE PATIENT DEMOGRAPHICS — Full demographic read
 ; ============================================================
 ; Params: DFN
 ; Output:
 ;   "1^1^OK"
 ;   "DEM^field^value" rows
 ;   "INS^ien^company^group^subscriber" rows
 ;   "NOK^name^relationship^phone" rows
 ;   "EMRG^name^relationship^phone" rows
 ; ============================================================
DEMO(R,DFN) ;
 S DFN=+$G(DFN)
 I 'DFN S R(0)="0^DFN required" Q
 I '$D(^DPT(DFN,0)) S R(0)="0^Patient not found" Q
 ;
 N OUT,CNT S CNT=0
 ;
 ; Core demographics from PATIENT #2
 N NM S NM=$$GET1^DIQ(2,DFN_",",.01,"E")
 S CNT=CNT+1,OUT(CNT)="DEM"_U_"NAME"_U_NM
 ;
 N DOB S DOB=$$GET1^DIQ(2,DFN_",",.03,"E")
 S CNT=CNT+1,OUT(CNT)="DEM"_U_"DOB"_U_DOB
 ;
 ; Calculate age
 N INTDOB S INTDOB=$$GET1^DIQ(2,DFN_",",.03,"I")
 N AGE S AGE=""
 I INTDOB]"" D
 . N TODAY S TODAY=$$DT^XLFDT
 . S AGE=($E(TODAY,1,3)-$E(INTDOB,1,3))
 . I $E(TODAY,4,7)<$E(INTDOB,4,7) S AGE=AGE-1
 S CNT=CNT+1,OUT(CNT)="DEM"_U_"AGE"_U_AGE
 ;
 N SEX S SEX=$$GET1^DIQ(2,DFN_",",.02,"E")
 S CNT=CNT+1,OUT(CNT)="DEM"_U_"SEX"_U_SEX
 ;
 N SSN S SSN=$$GET1^DIQ(2,DFN_",",.09,"E")
 N SSN4 S SSN4=$S(SSN]"":$E(SSN,$L(SSN)-3,$L(SSN)),1:"")
 S CNT=CNT+1,OUT(CNT)="DEM"_U_"SSN_LAST4"_U_SSN4
 ;
 N MARITAL S MARITAL=$$GET1^DIQ(2,DFN_",",.05,"E")
 S CNT=CNT+1,OUT(CNT)="DEM"_U_"MARITAL"_U_MARITAL
 ;
 N RACE S RACE=$$GET1^DIQ(2,DFN_",",.06,"E")
 S CNT=CNT+1,OUT(CNT)="DEM"_U_"RACE"_U_RACE
 ;
 N RELIG S RELIG=$$GET1^DIQ(2,DFN_",",.08,"E")
 S CNT=CNT+1,OUT(CNT)="DEM"_U_"RELIGION"_U_RELIG
 ;
 ; Address
 N ST1 S ST1=$$GET1^DIQ(2,DFN_",",.111,"E")
 S CNT=CNT+1,OUT(CNT)="DEM"_U_"STREET"_U_ST1
 N ST2 S ST2=$$GET1^DIQ(2,DFN_",",.112,"E")
 I ST2]"" S CNT=CNT+1,OUT(CNT)="DEM"_U_"STREET2"_U_ST2
 N CITY S CITY=$$GET1^DIQ(2,DFN_",",.114,"E")
 S CNT=CNT+1,OUT(CNT)="DEM"_U_"CITY"_U_CITY
 N ST S ST=$$GET1^DIQ(2,DFN_",",.115,"E")
 S CNT=CNT+1,OUT(CNT)="DEM"_U_"STATE"_U_ST
 N ZIP S ZIP=$$GET1^DIQ(2,DFN_",",.116,"E")
 S CNT=CNT+1,OUT(CNT)="DEM"_U_"ZIP"_U_ZIP
 ;
 ; Phones
 N PH S PH=$$GET1^DIQ(2,DFN_",",.131,"E")
 S CNT=CNT+1,OUT(CNT)="DEM"_U_"PHONE"_U_PH
 N WK S WK=$$GET1^DIQ(2,DFN_",",.132,"E")
 I WK]"" S CNT=CNT+1,OUT(CNT)="DEM"_U_"WORK PHONE"_U_WK
 N CL S CL=$$GET1^DIQ(2,DFN_",",.133,"E")
 I CL]"" S CNT=CNT+1,OUT(CNT)="DEM"_U_"CELL PHONE"_U_CL
 ;
 ; Veteran / SC / Eligibility
 N VET S VET=$$GET1^DIQ(2,DFN_",",.301,"E")
 S CNT=CNT+1,OUT(CNT)="DEM"_U_"VETERAN"_U_VET
 N SCP S SCP=$$GET1^DIQ(2,DFN_",",.302,"E")
 S CNT=CNT+1,OUT(CNT)="DEM"_U_"SC PERCENT"_U_SCP
 ;
 ; Eligibility code
 N ELIG S ELIG=$$GET1^DIQ(2,DFN_",",.361,"E")
 S CNT=CNT+1,OUT(CNT)="DEM"_U_"ELIG CODE"_U_ELIG
 ;
 ; Enrollment
 N ENRDT S ENRDT=$$GET1^DIQ(2,DFN_",",.362,"E")
 S CNT=CNT+1,OUT(CNT)="DEM"_U_"ENROLLMENT DATE"_U_ENRDT
 ;
 ; Next of Kin (field .211-.219 in PATIENT #2)
 N NOKNM S NOKNM=$$GET1^DIQ(2,DFN_",",.211,"E")
 I NOKNM]"" D
 . N NOKREL S NOKREL=$$GET1^DIQ(2,DFN_",",.212,"E")
 . N NOKPH S NOKPH=$$GET1^DIQ(2,DFN_",",.219,"E")
 . S CNT=CNT+1,OUT(CNT)="NOK"_U_NOKNM_U_NOKREL_U_NOKPH
 ;
 ; Emergency contact (.33-.331)
 N EMGNM S EMGNM=$$GET1^DIQ(2,DFN_",",.331,"E")
 I EMGNM]"" D
 . N EMGREL S EMGREL=$$GET1^DIQ(2,DFN_",",.332,"E")
 . N EMGPH S EMGPH=$$GET1^DIQ(2,DFN_",",.333,"E")
 . S CNT=CNT+1,OUT(CNT)="EMRG"_U_EMGNM_U_EMGREL_U_EMGPH
 ;
 ; Insurance entries from subfile 2.312
 N INI S INI=0
 F  S INI=$O(^DPT(DFN,.312,INI)) Q:'INI  D
 . N CO,GRP,SUB
 . S CO=$P($G(^DPT(DFN,.312,INI,0)),U,1)
 . ; Get company name from INSURANCE COMPANY #36
 . N CONM S CONM=$S(CO:$$GET1^DIQ(36,CO_",",.01,"E"),1:"")
 . S GRP=$P($G(^DPT(DFN,.312,INI,0)),U,3)
 . S SUB=$P($G(^DPT(DFN,.312,INI,0)),U,2)
 . S CNT=CNT+1,OUT(CNT)="INS"_U_INI_U_CONM_U_GRP_U_SUB
 ;
 S R(0)="1^"_CNT_"^OK"
 N I F I=1:1:CNT S R(I)=OUT(I)
 Q
 ;
 ; ============================================================
 ; ZVE PATIENT INSURANCE — Insurance management
 ; ============================================================
 ; Params: DFN, ACTION (LIST|ADD|EDIT|VERIFY), COIEN, GROUP,
 ;         SUBID, SUBNAME, EFFDT, EXPDT
 ; Output: varies by ACTION
 ; ============================================================
INS(R,DFN,ACTION,COIEN,GROUP,SUBID,SUBNAME,EFFDT,EXPDT) ;
 S DFN=+$G(DFN)
 I 'DFN S R(0)="0^DFN required" Q
 I '$D(^DPT(DFN,0)) S R(0)="0^Patient not found" Q
 S ACTION=$$UP^XLFSTR($G(ACTION,"LIST"))
 ;
 I ACTION="LIST" D  Q
 . N CNT,OUT,INI S CNT=0
 . S INI=0 F  S INI=$O(^DPT(DFN,.312,INI)) Q:'INI  D
 . . N Z S Z=$G(^DPT(DFN,.312,INI,0))
 . . N CO S CO=$P(Z,U,1)
 . . N CONM S CONM=$S(CO:$$GET1^DIQ(36,CO_",",.01,"E"),1:"")
 . . N GRP S GRP=$P(Z,U,3)
 . . N SUB S SUB=$P(Z,U,2)
 . . N EFF S EFF=$P(Z,U,8)
 . . N EXP S EXP=$P(Z,U,4)
 . . N VFLAG S VFLAG=$P(Z,U,9)
 . . S CNT=CNT+1,OUT(CNT)=INI_U_CONM_U_GRP_U_SUB_U_EFF_U_EXP_U_VFLAG
 . S R(0)="1^"_CNT_"^OK"
 . N II F II=1:1:CNT S R(II)=OUT(II)
 ;
 I ACTION="ADD" D  Q
 . S COIEN=+$G(COIEN)
 . I 'COIEN S R(0)="0^Insurance company IEN required" Q
 . I '$D(^DIC(36,COIEN,0)) S R(0)="0^Insurance company not found" Q
 . ;
 . N MAXIEN S MAXIEN=+$O(^DPT(DFN,.312,"A"),-1)+1
 . S ^DPT(DFN,.312,MAXIEN,0)=COIEN_U_$G(SUBID)_U_$G(GROUP)_U_$G(EXPDT)_U_""_U_""_U_""_U_$G(EFFDT)
 . S ^DPT(DFN,.312,"B",COIEN,MAXIEN)=""
 . ; Update subfile header
 . S $P(^DPT(DFN,.312,0),U,3)=MAXIEN
 . S $P(^DPT(DFN,.312,0),U,4)=$P($G(^DPT(DFN,.312,0)),U,4)+1
 . D AUDITLOG^ZVEADMIN("INS-ADD",DFN,"Company="_COIEN_" Sub="_$G(SUBID))
 . S R(0)="1^OK^"_MAXIEN_"^ADDED"
 ;
 I ACTION="VERIFY" D  Q
 . ; Mark an insurance entry as verified
 . ; NOTE: COIEN param is reused here as the insurance entry IEN (not company IEN)
 . N INSIEN S INSIEN=+$G(COIEN)
 . I 'INSIEN S R(0)="0^Insurance entry IEN required" Q
 . I '$D(^DPT(DFN,.312,INSIEN,0)) S R(0)="0^Insurance entry not found" Q
 . N Z S Z=$G(^DPT(DFN,.312,INSIEN,0))
 . S $P(Z,U,9)=DUZ ; verified by
 . S $P(Z,U,10)=$$NOW^XLFDT ; verified date
 . S ^DPT(DFN,.312,INSIEN,0)=Z
 . D AUDITLOG^ZVEADMIN("INS-VERIFY",DFN,"Entry="_INSIEN)
 . S R(0)="1^OK^VERIFIED"
 ;
 S R(0)="0^Invalid ACTION: "_ACTION_" (use LIST, ADD, or VERIFY)" Q
 ;
 ; ============================================================
 ; ZVE PATIENT MEANS — Means test read/initiate
 ; ============================================================
 ; Params: DFN, ACTION (READ|INITIATE)
 ; Output: "1^...|0^error"
 ; Reads from ANNUAL MEANS TEST #408.31
 ; ============================================================
MEANS(R,DFN,ACTION) ;
 S DFN=+$G(DFN)
 I 'DFN S R(0)="0^DFN required" Q
 I '$D(^DPT(DFN,0)) S R(0)="0^Patient not found" Q
 S ACTION=$$UP^XLFSTR($G(ACTION,"READ"))
 ;
 I ACTION="READ" D  Q
 . ; Find most recent means test for this patient
 . ; ANNUAL MEANS TEST #408.31 — field .02 is PATIENT
 . N MTIEN,FOUND S MTIEN="",FOUND=0
 . ; Walk backwards through file to find latest for this patient
 . N IDX S IDX=$G(^DGMT(408.31,0)) I IDX="" S R(0)="0^No means test data available" Q
 . N LAST S LAST=+$P(IDX,U,3) ; last IEN
 . S MTIEN=LAST+1
 . F  S MTIEN=$O(^DGMT(408.31,MTIEN),-1) Q:'MTIEN  D  Q:FOUND
 . . I $P($G(^DGMT(408.31,MTIEN,0)),U,2)=DFN S FOUND=1
 . ;
 . I 'FOUND S R(0)="1^0^NO_MEANS_TEST" Q
 . ;
 . N MTDT S MTDT=$$GET1^DIQ(408.31,MTIEN_",",.01,"E")
 . N MTST S MTST=$$GET1^DIQ(408.31,MTIEN_",",.03,"E")
 . N MTCAT S MTCAT=$$GET1^DIQ(408.31,MTIEN_",",.04,"E")
 . N COPAY S COPAY=$$GET1^DIQ(408.31,MTIEN_",",.07,"E")
 . ;
 . S R(0)="1^1^OK"
 . S R(1)="MT"_U_MTIEN_U_MTDT_U_MTST_U_MTCAT_U_COPAY
 ;
 I ACTION="INITIATE" D  Q
 . ; Create a new means test shell — details entered via DG MEANS TEST process
 . N FDA,DIERR,DIEN
 . S DIEN(1)=""
 . S FDA(408.31,"+1,",.01)=$$NOW^XLFDT
 . S FDA(408.31,"+1,",.02)=DFN
 . S FDA(408.31,"+1,",.03)="REQUIRED"
 . D UPDATE^DIE("E","FDA","DIEN","DIERR")
 . I $D(DIERR) S R(0)="0^Failed to initiate means test: "_$G(DIERR("DIERR",1,"TEXT",1)) Q
 . D AUDITLOG^ZVEADMIN("MEANS-INIT",DFN,"Means test initiated: "_+DIEN(1))
 . S R(0)="1^OK^"_+DIEN(1)_"^INITIATED"
 ;
 S R(0)="0^Invalid ACTION: "_ACTION_" (use READ or INITIATE)" Q
 ;
 ; ============================================================
 ; ZVE PATIENT ELIG — Eligibility read
 ; ============================================================
 ; Params: DFN
 ; Output:
 ;   "1^1^OK"
 ;   "ELIG^field^value" rows
 ; ============================================================
ELIG(R,DFN) ;
 S DFN=+$G(DFN)
 I 'DFN S R(0)="0^DFN required" Q
 I '$D(^DPT(DFN,0)) S R(0)="0^Patient not found" Q
 ;
 N OUT,CNT S CNT=0
 ;
 ; Primary eligibility code
 N ECODE S ECODE=$$GET1^DIQ(2,DFN_",",.361,"E")
 S CNT=CNT+1,OUT(CNT)="ELIG"_U_"CODE"_U_ECODE
 ;
 ; Eligibility description
 N EDESC S EDESC=$$GET1^DIQ(2,DFN_",",.362,"E")
 S CNT=CNT+1,OUT(CNT)="ELIG"_U_"DESCRIPTION"_U_EDESC
 ;
 ; Service connected
 N SC S SC=$$GET1^DIQ(2,DFN_",",.301,"E")
 S CNT=CNT+1,OUT(CNT)="ELIG"_U_"SC"_U_SC
 ;
 ; SC percent
 N SCP S SCP=$$GET1^DIQ(2,DFN_",",.302,"E")
 S CNT=CNT+1,OUT(CNT)="ELIG"_U_"SC_PERCENT"_U_SCP
 ;
 ; Enrollment fields
 N ENRST S ENRST=$$GET1^DIQ(2,DFN_",",.0361,"E")
 S CNT=CNT+1,OUT(CNT)="ELIG"_U_"ENROLLMENT_STATUS"_U_ENRST
 ;
 N ENRDT S ENRDT=$$GET1^DIQ(2,DFN_",",.0362,"E")
 S CNT=CNT+1,OUT(CNT)="ELIG"_U_"ENROLLMENT_DATE"_U_ENRDT
 ;
 N ENRPR S ENRPR=$$GET1^DIQ(2,DFN_",",.0363,"E")
 S CNT=CNT+1,OUT(CNT)="ELIG"_U_"ENROLLMENT_PRIORITY"_U_ENRPR
 ;
 ; Copay status from last means test
 N COPAY S COPAY=""
 N MTIEN S MTIEN="" N IDX S IDX=$G(^DGMT(408.31,0))
 I IDX]"" D
 . N LAST S LAST=+$P(IDX,U,3),MTIEN=LAST+1
 . F  S MTIEN=$O(^DGMT(408.31,MTIEN),-1) Q:'MTIEN  Q:$P($G(^DGMT(408.31,MTIEN,0)),U,2)=DFN
 . I MTIEN S COPAY=$$GET1^DIQ(408.31,MTIEN_",",.07,"E")
 S CNT=CNT+1,OUT(CNT)="ELIG"_U_"COPAY_STATUS"_U_COPAY
 ;
 ; Means test status
 N MTST S MTST=$S(MTIEN:$$GET1^DIQ(408.31,MTIEN_",",.03,"E"),1:"NONE")
 S CNT=CNT+1,OUT(CNT)="ELIG"_U_"MEANS_TEST_STATUS"_U_MTST
 ;
 ; SC conditions (subfile 2.04)
 N SCI,SCCNT S SCI=0,SCCNT=0
 F  S SCI=$O(^DPT(DFN,.04,SCI)) Q:'SCI  D
 . N SCNM S SCNM=$P($G(^DPT(DFN,.04,SCI,0)),U,1)
 . I SCNM]"" S SCCNT=SCCNT+1,CNT=CNT+1,OUT(CNT)="ELIG"_U_"SC_CONDITION"_U_SCNM
 ;
 S R(0)="1^"_CNT_"^OK"
 N I F I=1:1:CNT S R(I)=OUT(I)
 Q
