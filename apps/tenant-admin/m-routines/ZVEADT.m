ZVEADT ; VE — ADT (Admit/Discharge/Transfer/Census) RPCs ; Apr 2026
 ;;1.0;VISTA EVOLVED;**1**;Apr 2026;Build 1
 ;
 ; RPCs in this routine:
 ;   ZVE ADT ADMIT     - Admit patient to inpatient ward
 ;   ZVE ADT DISCHARGE - Discharge inpatient
 ;   ZVE ADT TRANSFER  - Transfer between wards
 ;   ZVE ADT CENSUS    - Ward census (the missing endpoint!)
 ;
 Q  ; No direct entry
 ;
INSTALL ;
 W !,"=== Installing ZVEADT RPCs ==="
 D REGONE^ZVEADMIN("ZVE ADT ADMIT","ADMIT","ZVEADT","Admit patient")
 D REGONE^ZVEADMIN("ZVE ADT DISCHARGE","DISCH","ZVEADT","Discharge patient")
 D REGONE^ZVEADMIN("ZVE ADT TRANSFER","TRANS","ZVEADT","Transfer patient")
 D REGONE^ZVEADMIN("ZVE ADT CENSUS","CENSUS","ZVEADT","Ward census")
 W !,"=== ZVEADT install complete ==="
 Q
 ;
 ; ============================================================
 ; ZVE ADT ADMIT — Admit patient to inpatient ward
 ; ============================================================
 ; Params: DFN, WARDIEN, ROOMBED, DIAGCODE, ATTENDDUZ, ADMTYPE
 ; Output: "1^MOVIEN^admdt^ward^roombed" or "0^error"
 ; Writes: ^DGPM (File #405 PATIENT MOVEMENT), ^DPT (File #2)
 ;
 ; NOTE: Uses direct ^DGPM global SET — the standard VistA ADT
 ;       movement pattern. FileMan UPDATE^DIE is unsuitable here
 ;       because File 405 field .01 has an input transform that
 ;       requires $D(DGPMT) and blocks programmatic filing.
 ;       This is consistent with how VistA's own DG* routines
 ;       create movement records.
 ;
 ; ^DGPM storage (node 0, by piece):
 ;   P1=date(.01) P2=trans(.02) P3=patient(.03) P4=movtype(.04)
 ;   P5=facility(.05) P6=ward(.06) P7=roombed(.07) P8=primphys(.08)
 ;   P9=specialty(.09) P10=diagnosis(.1) P11=sc(.11) P12=regulation(.12)
 ;   P13=unused  P14=admptr(.14)  P15-P16=unused
 ;   P17=mastype(.18) P18=attending(.19)
 ; ============================================================
ADMIT(R,DFN,WARDIEN,ROOMBED,DIAGCODE,ATTENDDUZ,ADMTYPE) ;
 S DFN=+$G(DFN)
 I 'DFN S R(0)="0^DFN required" Q
 I '$D(^DPT(DFN,0)) S R(0)="0^Patient not found" Q
 ;
 ; Verify not already admitted
 I $P($G(^DPT(DFN,.1)),U,1)]"" D  Q
 . N CURWARD S CURWARD=$P(^DPT(DFN,.1),U,1)
 . S R(0)="0^Patient already admitted — current ward: "_$$GET1^DIQ(42,CURWARD_",",.01,"E")
 ;
 ; Verify ward
 S WARDIEN=+$G(WARDIEN)
 I 'WARDIEN S R(0)="0^Ward IEN required" Q
 I '$D(^DIC(42,WARDIEN,0)) S R(0)="0^Ward not found" Q
 ;
 S ROOMBED=$G(ROOMBED)
 S DIAGCODE=$G(DIAGCODE,"ADMIT")
 S ATTENDDUZ=+$G(ATTENDDUZ)
 S ADMTYPE=+$G(ADMTYPE,1) ; TYPE OF MOVEMENT — default 1=DIRECT
 ;
 N NOW S NOW=$$NOW^XLFDT
 ;
 ; Allocate next movement IEN (atomic increment)
 N MOVIEN S MOVIEN=$P(^DGPM(0),U,3)+1
 ;
 ; Build movement record
 N REC S REC=""
 S $P(REC,U,1)=NOW          ; .01 DATE/TIME
 S $P(REC,U,2)=1            ; .02 TRANSACTION = ADMISSION
 S $P(REC,U,3)=DFN          ; .03 PATIENT
 S $P(REC,U,4)=ADMTYPE      ; .04 TYPE OF MOVEMENT
 S $P(REC,U,6)=WARDIEN      ; .06 WARD LOCATION
 I ROOMBED]"" S $P(REC,U,7)=ROOMBED ; .07 ROOM-BED
 S $P(REC,U,10)=DIAGCODE    ; .1  DIAGNOSIS SHORT
 S $P(REC,U,14)=MOVIEN      ; .14 ADMISSION MOVEMENT (self-ptr)
 I ATTENDDUZ S $P(REC,U,18)=ATTENDDUZ ; .19 ATTENDING PHYSICIAN
 ;
 ; File the movement record
 S ^DGPM(MOVIEN,0)=REC
 ;
 ; Update DGPM header (last IEN and count)
 S $P(^DGPM(0),U,3)=MOVIEN
 S $P(^DGPM(0),U,4)=$P(^DGPM(0),U,4)+1
 ;
 ; Set cross-references
 S ^DGPM("C",DFN,MOVIEN)=""
 S ^DGPM("ATID",1,DFN,NOW,MOVIEN)=""
 S ^DGPM("APTT",DFN,NOW,MOVIEN)=""
 ;
 ; Update patient current location in ^DPT
 S $P(^DPT(DFN,.1),U,1)=WARDIEN
 I ROOMBED]"" S $P(^DPT(DFN,.1),U,2)=ROOMBED
 S $P(^DPT(DFN,.1),U,16)=NOW ; admission date
 ;
 D AUDITLOG^ZVEADMIN("ADT-ADMIT",DFN,"Ward="_WARDIEN_" Mov="_MOVIEN)
 ;
 N WNAME S WNAME=$$GET1^DIQ(42,WARDIEN_",",.01,"E")
 S R(0)="1^"_MOVIEN_"^"_$$FMTE^XLFDT(NOW)_"^"_WNAME_"^"_ROOMBED Q
 ;
 ; ============================================================
 ; ZVE ADT DISCHARGE — Discharge inpatient
 ; ============================================================
 ; Params: DFN, DIAGCODE, DISPOSITION, DISCHTYPE
 ; Output: "1^MOVIEN^dischdt^disposition" or "0^error"
 ; Uses direct ^DGPM global SET — see ADMIT documentation
 ; ============================================================
DISCH(R,DFN,DIAGCODE,DISPOSITION,DISCHTYPE) ;
 S DFN=+$G(DFN)
 I 'DFN S R(0)="0^DFN required" Q
 I '$D(^DPT(DFN,0)) S R(0)="0^Patient not found" Q
 ;
 ; Verify currently admitted
 I $P($G(^DPT(DFN,.1)),U,1)="" D  Q
 . S R(0)="0^Patient not currently admitted — cannot discharge"
 ;
 S DIAGCODE=$G(DIAGCODE,"DISCHARGE")
 S DISPOSITION=$G(DISPOSITION)
 S DISCHTYPE=+$G(DISCHTYPE)
 ;
 N NOW S NOW=$$NOW^XLFDT
 N CURWARD S CURWARD=$P(^DPT(DFN,.1),U,1)
 ;
 ; Find the admission movement for this stay
 N ADMPTR S ADMPTR=""
 N MI S MI=0
 F  S MI=$O(^DGPM("C",DFN,MI),-1) Q:'MI  Q:ADMPTR  D
 . I $P($G(^DGPM(MI,0)),U,2)=1 S ADMPTR=MI ; transaction=1=ADMISSION
 ;
 ; Allocate next movement IEN
 N MOVIEN S MOVIEN=$P(^DGPM(0),U,3)+1
 ;
 ; Build discharge movement record
 N REC S REC=""
 S $P(REC,U,1)=NOW          ; .01 DATE/TIME
 S $P(REC,U,2)=3            ; .02 TRANSACTION = DISCHARGE
 S $P(REC,U,3)=DFN          ; .03 PATIENT
 S $P(REC,U,6)=CURWARD      ; .06 WARD (from where)
 S $P(REC,U,10)=DIAGCODE    ; .1  DIAGNOSIS SHORT
 I ADMPTR S $P(REC,U,14)=ADMPTR ; .14 ADMISSION MOVEMENT
 I DISCHTYPE S $P(REC,U,17)=DISCHTYPE ; .18 MAS MOVEMENT TYPE
 ;
 ; File the movement record
 S ^DGPM(MOVIEN,0)=REC
 ;
 ; Update DGPM header
 S $P(^DGPM(0),U,3)=MOVIEN
 S $P(^DGPM(0),U,4)=$P(^DGPM(0),U,4)+1
 ;
 ; Set cross-references
 S ^DGPM("C",DFN,MOVIEN)=""
 S ^DGPM("ATID",3,DFN,NOW,MOVIEN)=""
 S ^DGPM("APTT",DFN,NOW,MOVIEN)=""
 ;
 ; Clear patient current location in ^DPT
 S $P(^DPT(DFN,.1),U,1)=""
 S $P(^DPT(DFN,.1),U,2)=""
 ;
 D AUDITLOG^ZVEADMIN("ADT-DISCH",DFN,"Discharged Mov="_MOVIEN)
 ;
 S R(0)="1^"_MOVIEN_"^"_$$FMTE^XLFDT(NOW)_"^"_DISPOSITION Q
 ;
 ; ============================================================
 ; ZVE ADT TRANSFER — Transfer between wards
 ; ============================================================
 ; Params: DFN, TOWARDIEN, TOROOMBED, REASON
 ; Output: "1^MOVIEN^transdt^fromward^toward" or "0^error"
 ; Uses direct ^DGPM global SET — see ADMIT documentation
 ; ============================================================
TRANS(R,DFN,TOWARDIEN,TOROOMBED,REASON) ;
 S DFN=+$G(DFN)
 I 'DFN S R(0)="0^DFN required" Q
 I '$D(^DPT(DFN,0)) S R(0)="0^Patient not found" Q
 ;
 ; Verify currently admitted
 N CURWARD S CURWARD=$P($G(^DPT(DFN,.1)),U,1)
 I CURWARD="" D  Q
 . S R(0)="0^Patient not currently admitted — cannot transfer"
 ;
 S TOWARDIEN=+$G(TOWARDIEN)
 I 'TOWARDIEN S R(0)="0^Destination ward IEN required" Q
 I '$D(^DIC(42,TOWARDIEN,0)) S R(0)="0^Destination ward not found" Q
 ;
 I TOWARDIEN=CURWARD S R(0)="0^Cannot transfer to same ward" Q
 ;
 S TOROOMBED=$G(TOROOMBED)
 S REASON=$G(REASON)
 ;
 N NOW S NOW=$$NOW^XLFDT
 ;
 ; Find the admission movement for this stay
 N ADMPTR S ADMPTR=""
 N MI S MI=0
 F  S MI=$O(^DGPM("C",DFN,MI),-1) Q:'MI  Q:ADMPTR  D
 . I $P($G(^DGPM(MI,0)),U,2)=1 S ADMPTR=MI
 ;
 ; Allocate next movement IEN
 N MOVIEN S MOVIEN=$P(^DGPM(0),U,3)+1
 ;
 ; Build transfer movement record
 N REC S REC=""
 S $P(REC,U,1)=NOW          ; .01 DATE/TIME
 S $P(REC,U,2)=2            ; .02 TRANSACTION = TRANSFER
 S $P(REC,U,3)=DFN          ; .03 PATIENT
 S $P(REC,U,4)=11           ; .04 TYPE OF MOVEMENT = INTERWARD TRANSFER
 S $P(REC,U,6)=TOWARDIEN    ; .06 WARD (destination)
 I TOROOMBED]"" S $P(REC,U,7)=TOROOMBED ; .07 ROOM-BED
 I ADMPTR S $P(REC,U,14)=ADMPTR ; .14 ADMISSION MOVEMENT
 ;
 ; File the movement record
 S ^DGPM(MOVIEN,0)=REC
 ;
 ; Update DGPM header
 S $P(^DGPM(0),U,3)=MOVIEN
 S $P(^DGPM(0),U,4)=$P(^DGPM(0),U,4)+1
 ;
 ; Set cross-references
 S ^DGPM("C",DFN,MOVIEN)=""
 S ^DGPM("ATID",2,DFN,NOW,MOVIEN)=""
 S ^DGPM("APTT",DFN,NOW,MOVIEN)=""
 ;
 ; Update patient current location in ^DPT
 S $P(^DPT(DFN,.1),U,1)=TOWARDIEN
 I TOROOMBED]"" S $P(^DPT(DFN,.1),U,2)=TOROOMBED
 ;
 N FROMWNAME S FROMWNAME=$$GET1^DIQ(42,CURWARD_",",.01,"E")
 N TOWNAME S TOWNAME=$$GET1^DIQ(42,TOWARDIEN_",",.01,"E")
 ;
 D AUDITLOG^ZVEADMIN("ADT-TRANS",DFN,"From="_FROMWNAME_" To="_TOWNAME_" Mov="_MOVIEN)
 ;
 S R(0)="1^"_MOVIEN_"^"_$$FMTE^XLFDT(NOW)_"^"_FROMWNAME_"^"_TOWNAME Q
 ;
 ; ============================================================
 ; ZVE ADT CENSUS — Ward census (the missing endpoint!)
 ; ============================================================
 ; Params: WARDIEN (specific ward IEN or "ALL"), PENDING, MAX
 ; Output:
 ;   "1^COUNT^OK"
 ;   "DFN^NAME^ROOMBED^ADMDT^LOS^ATTENDING^ADMITDX^DIET"
 ; ============================================================
CENSUS(R,WARDIEN,PENDING,MAX) ;
 S WARDIEN=$G(WARDIEN,"ALL")
 S PENDING=$$UP^XLFSTR($G(PENDING,"N"))
 S MAX=+$G(MAX,500) I MAX<1 S MAX=500
 ;
 N CNT,OUT S CNT=0
 ;
 ; Scan PATIENT #2 for current inpatients
 ; NOTE: Full scan of ^DPT capped by MAX to prevent unbounded traversal
 N DFN S DFN=0
 F  S DFN=$O(^DPT(DFN)) Q:'DFN  Q:DFN="B"  Q:CNT'<MAX  D
 . N LOC S LOC=$P($G(^DPT(DFN,.1)),U,1) Q:LOC=""
 . ; Ward filter
 . I WARDIEN'="ALL",LOC'=+WARDIEN Q
 . ;
 . N NM S NM=$P($G(^DPT(DFN,0)),U,1)
 . N RMBD S RMBD=$P($G(^DPT(DFN,.1)),U,2)
 . N ADMDT S ADMDT=$P($G(^DPT(DFN,.1)),U,16)
 . ;
 . ; Length of stay
 . N LOS S LOS=""
 . I ADMDT]"" D
 . . N TODAY S TODAY=$$DT^XLFDT
 . . S LOS=$$FMDIFF^XLFDT(TODAY,ADMDT,1) ; days difference
 . ;
 . ; Attending provider — get from latest movement record
 . N ATTEND S ATTEND=""
 . N MOVIEN S MOVIEN=0
 . F  S MOVIEN=$O(^DGPM("C",DFN,MOVIEN),-1) Q:'MOVIEN  Q:ATTEND]""  D
 . . N ATTDUZ S ATTDUZ=$P($G(^DGPM(MOVIEN,0)),U,18) ; P18 = .19 ATTENDING
 . . I ATTDUZ S ATTEND=$P($G(^VA(200,ATTDUZ,0)),U,1)
 . ;
 . ; Admitting diagnosis from latest movement
 . N ADMITDX S ADMITDX=""
 . S MOVIEN=0
 . F  S MOVIEN=$O(^DGPM("C",DFN,MOVIEN),-1) Q:'MOVIEN  Q:ADMITDX]""  D
 . . S ADMITDX=$P($G(^DGPM(MOVIEN,0)),U,10)
 . ;
 . ; Diet — from NUTRITION ORDER if available
 . N DIET S DIET=""
 . I $D(^FHPT(DFN)) D
 . . ; Get latest diet order from Nutrition Patient file
 . . N DO S DO=$O(^FHPT(DFN,2,""),-1)
 . . I DO S DIET=$P($G(^FHPT(DFN,2,DO,0)),U,2)
 . ;
 . S CNT=CNT+1
 . S OUT(CNT)=DFN_U_NM_U_RMBD_U_$$FMTE^XLFDT(ADMDT)_U_LOS_U_ATTEND_U_ADMITDX_U_DIET
 ;
 S R(0)="1^"_CNT_"^OK"
 N I F I=1:1:CNT S R(I)=OUT(I)
 Q
