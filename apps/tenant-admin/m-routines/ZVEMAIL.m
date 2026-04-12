ZVEMAIL ; VE — MailMan, Two-Person Integrity, Alert Creation RPCs ; Apr 2026
 ;;1.0;VISTA EVOLVED;**1**;Apr 2026;Build 1
 ;
 ; RPCs in this routine:
 ;   ZVE MM INBOX     - Read MailMan inbox for user
 ;   ZVE MM READ      - Read single MailMan message body
 ;   ZVE MM SEND      - Send MailMan message
 ;   ZVE MM DELETE    - Delete (move to WASTE basket)
 ;   ZVE 2P SUBMIT    - Submit two-person integrity change request
 ;   ZVE 2P LIST      - List pending 2P requests
 ;   ZVE 2P ACTION    - Approve or reject a 2P request
 ;   ZVE ALERT CREATE - Create a VistA alert
 ;
 Q  ; No direct entry
 ;
INSTALL ;
 W !,"=== Installing ZVEMAIL RPCs ==="
 D REGONE^ZVEADMIN("ZVE MM INBOX","MMINBOX","ZVEMAIL","Read MailMan inbox")
 D REGONE^ZVEADMIN("ZVE MM READ","MMREAD","ZVEMAIL","Read MailMan message body")
 D REGONE^ZVEADMIN("ZVE MM SEND","MMSEND","ZVEMAIL","Send MailMan message")
 D REGONE^ZVEADMIN("ZVE MM DELETE","MMDEL","ZVEMAIL","Delete MailMan message")
 D REGONE^ZVEADMIN("ZVE 2P SUBMIT","TWOPSUB","ZVEMAIL","Submit 2P change request")
 D REGONE^ZVEADMIN("ZVE 2P LIST","TWOPLIST","ZVEMAIL","List 2P change requests")
 D REGONE^ZVEADMIN("ZVE 2P ACTION","TWOPACT","ZVEMAIL","Approve/reject 2P request")
 D REGONE^ZVEADMIN("ZVE ALERT CREATE","ALERTCRT","ZVEMAIL","Create VistA alert")
 ; Set XTMP expiration for 2P queue
 I '$D(^XTMP("ZVE2P",0)) S ^XTMP("ZVE2P",0)=$$FMADD^XLFDT($$NOW^XLFDT,365)_U_$$NOW^XLFDT_U_"VE Two-Person Integrity Queue"
 W !,"=== ZVEMAIL install complete ==="
 Q
 ;
 ; ============================================================
 ; ZVE MM INBOX — Read MailMan inbox for user
 ; ============================================================
MMINBOX(R,TARGETDUZ,FOLDER,MAX) ;
 S TARGETDUZ=+$G(TARGETDUZ)
 I 'TARGETDUZ S R(0)="0^User ID required" Q
 S FOLDER=$$UP^XLFSTR($G(FOLDER,"IN"))
 S MAX=+$G(MAX,50) I MAX<1 S MAX=50
 ;
 N CNT S CNT=0
 ;
 ; Traverse user's mailbox baskets via ^XMB(3.7,DUZ,2,basketIEN,...)
 N BIEN S BIEN=0
 F  S BIEN=$O(^XMB(3.7,TARGETDUZ,2,BIEN)) Q:'BIEN  Q:CNT>=MAX  D
 . N BNAME S BNAME=$$UP^XLFSTR($P($G(^XMB(3.7,TARGETDUZ,2,BIEN,0)),U,1))
 . ; Filter by folder type
 . I FOLDER="IN",BNAME="WASTE" Q
 . I FOLDER="WASTE",BNAME'="WASTE" Q
 . I FOLDER="SENT" Q  ; sent handled separately
 . ;
 . N MIEN S MIEN=0
 . F  S MIEN=$O(^XMB(3.7,TARGETDUZ,2,BIEN,1,MIEN)) Q:'MIEN  Q:CNT>=MAX  D
 . . N MSG S MSG=$G(^XMB(3.9,MIEN,0))
 . . Q:MSG=""
 . . N SUBJ S SUBJ=$P(MSG,U,1)
 . . N FROM S FROM=$P(MSG,U,2)
 . . N DT S DT=$P(MSG,U,3)
 . . ; Get sender name
 . . N FROMNAME S FROMNAME=""
 . . I +FROM>0 S FROMNAME=$$GET1^DIQ(200,FROM_",",.01,"E")
 . . I FROMNAME="" S FROMNAME=$S(+FROM:FROM,1:"SYSTEM")
 . . ; Check if read
 . . N RD S RD=$S($D(^XMB(3.7,TARGETDUZ,2,BIEN,1,MIEN,"R")):1,1:0)
 . . ; Priority
 . . N PRI S PRI=$S($P(MSG,U,5):"HIGH",1:"NORMAL")
 . . ;
 . . S CNT=CNT+1
 . . S R(CNT)=MIEN_U_FROMNAME_U_SUBJ_U_$$FMTE^XLFDT(DT)_U_PRI_U_RD_U_BNAME
 ;
 S R(0)="1^"_CNT_"^OK"
 Q
 ;
 ; ============================================================
 ; ZVE MM READ — Read single MailMan message body
 ; ============================================================
MMREAD(R,TARGETDUZ,MSGIEN) ;
 S MSGIEN=+$G(MSGIEN)
 I 'MSGIEN S R(0)="0^Message ID required" Q
 I '$D(^XMB(3.9,MSGIEN,0)) S R(0)="0^Message not found" Q
 ;
 N MSG S MSG=$G(^XMB(3.9,MSGIEN,0))
 N FROM S FROM=$P(MSG,U,2)
 N FROMNAME S FROMNAME=""
 I +FROM>0 S FROMNAME=$$GET1^DIQ(200,FROM_",",.01,"E")
 ;
 S R(1)=$S(FROMNAME'="":FROMNAME,1:FROM)_U_$P(MSG,U,1)_U_$$FMTE^XLFDT($P(MSG,U,3))_U_$S($P(MSG,U,5):"HIGH",1:"NORMAL")
 ;
 ; Read message body from ^XMB(3.9,MSGIEN,2,line,0)
 N LN,CNT S LN=0,CNT=1
 F  S LN=$O(^XMB(3.9,MSGIEN,2,LN)) Q:'LN  D
 . S CNT=CNT+1
 . S R(CNT)=$G(^XMB(3.9,MSGIEN,2,LN,0))
 ;
 ; Mark as read for this user
 S TARGETDUZ=+$G(TARGETDUZ)
 I TARGETDUZ>0 D
 . N BIEN S BIEN=0
 . F  S BIEN=$O(^XMB(3.7,TARGETDUZ,2,BIEN)) Q:'BIEN  D
 . . I $D(^XMB(3.7,TARGETDUZ,2,BIEN,1,MSGIEN)) S ^XMB(3.7,TARGETDUZ,2,BIEN,1,MSGIEN,"R")=""
 ;
 S R(0)="1^"_CNT_"^OK"
 Q
 ;
 ; ============================================================
 ; ZVE MM SEND — Send MailMan message
 ; ============================================================
MMSEND(R,FROMDUZ,TODUZ,SUBJECT,BODY) ;
 S FROMDUZ=+$G(FROMDUZ)
 I 'FROMDUZ S R(0)="0^Sender required" Q
 S TODUZ=+$G(TODUZ)
 I 'TODUZ S R(0)="0^Recipient required" Q
 I $G(SUBJECT)="" S R(0)="0^Subject required" Q
 ;
 N XMY,XMSUB,XMTEXT,XMDUZ,XMZ
 S XMDUZ=FROMDUZ
 S XMSUB=SUBJECT
 S XMY(TODUZ)=""
 ;
 ; Build message body in ^TMP
 N TMPSUB S TMPSUB="ZVEMAIL"
 K ^TMP(TMPSUB,$J)
 N LN S LN=0
 N BTEXT S BTEXT=$G(BODY)
 I BTEXT="" S LN=1,^TMP(TMPSUB,$J,LN,0)=" "
 E  D
 . N I F I=1:1:$L(BTEXT,"|") D
 . . S LN=LN+1,^TMP(TMPSUB,$J,LN,0)=$P(BTEXT,"|",I)
 S XMTEXT="^TMP(""ZVEMAIL"","_$J_","
 ;
 D ^XMD
 ;
 K ^TMP(TMPSUB,$J)
 ;
 I $G(XMZ)>0 D
 . D AUDITLOG^ZVEADMIN("MM-SEND",FROMDUZ,"Msg "_XMZ_" to "_TODUZ_": "_SUBJECT)
 . S R(0)="1^"_XMZ_"^Message sent"
 E  S R(0)="1^0^Message queued"
 Q
 ;
 ; ============================================================
 ; ZVE MM DELETE — Delete (move to WASTE basket)
 ; ============================================================
MMDEL(R,TARGETDUZ,MSGIEN) ;
 S TARGETDUZ=+$G(TARGETDUZ)
 I 'TARGETDUZ S R(0)="0^User required" Q
 S MSGIEN=+$G(MSGIEN)
 I 'MSGIEN S R(0)="0^Message ID required" Q
 ;
 ; Find and remove from current basket
 N BIEN,FOUND S BIEN=0,FOUND=0
 F  S BIEN=$O(^XMB(3.7,TARGETDUZ,2,BIEN)) Q:'BIEN  Q:FOUND  D
 . I $D(^XMB(3.7,TARGETDUZ,2,BIEN,1,MSGIEN)) D
 . . N BNAME S BNAME=$$UP^XLFSTR($P($G(^XMB(3.7,TARGETDUZ,2,BIEN,0)),U,1))
 . . I BNAME="WASTE" S FOUND=1 Q  ; already in waste
 . . K ^XMB(3.7,TARGETDUZ,2,BIEN,1,MSGIEN)
 . . S FOUND=1
 ;
 ; Find WASTE basket and add message there
 N WBIEN,WFOUND S WBIEN=0,WFOUND=0
 F  S WBIEN=$O(^XMB(3.7,TARGETDUZ,2,WBIEN)) Q:'WBIEN  Q:WFOUND  D
 . N BN S BN=$$UP^XLFSTR($P($G(^XMB(3.7,TARGETDUZ,2,WBIEN,0)),U,1))
 . I BN="WASTE" S WFOUND=1
 I WFOUND,WBIEN>0 S ^XMB(3.7,TARGETDUZ,2,WBIEN,1,MSGIEN)=""
 ;
 D AUDITLOG^ZVEADMIN("MM-DELETE",TARGETDUZ,"Msg "_MSGIEN_" moved to WASTE")
 S R(0)="1^OK^Message deleted"
 Q
 ;
 ; ============================================================
 ; ZVE 2P SUBMIT — Submit two-person integrity change request
 ; ============================================================
TWOPSUB(R,SECTION,FIELD,OLDVAL,NEWVAL,REASON,SUBMITTER) ;
 S SECTION=$G(SECTION) I SECTION="" S R(0)="0^Section required" Q
 S FIELD=$G(FIELD) I FIELD="" S R(0)="0^Field required" Q
 S SUBMITTER=+$G(SUBMITTER) I 'SUBMITTER S R(0)="0^Submitter DUZ required" Q
 ;
 N REQID S REQID=$I(^XTMP("ZVE2P"))
 N NOW S NOW=$$NOW^XLFDT
 ;
 S ^XTMP("ZVE2P",REQID)=SECTION_U_FIELD_U_$G(OLDVAL)_U_$G(NEWVAL)_U_$G(REASON)_U_SUBMITTER_U_NOW_U_"PENDING"
 ;
 ; Refresh purge date
 S $P(^XTMP("ZVE2P",0),U,1)=$$FMADD^XLFDT(NOW,365)
 ;
 D AUDITLOG^ZVEADMIN("2P-SUBMIT",SUBMITTER,"ReqID="_REQID_" Section="_SECTION_" Field="_FIELD)
 ;
 S R(0)="1^"_REQID_"^Change request submitted for approval"
 Q
 ;
 ; ============================================================
 ; ZVE 2P LIST — List pending 2P requests
 ; ============================================================
TWOPLIST(R,STATUS) ;
 S STATUS=$$UP^XLFSTR($G(STATUS,"PENDING"))
 N CNT,ID S CNT=0,ID=0
 F  S ID=$O(^XTMP("ZVE2P",ID)) Q:'ID  D
 . N DATA S DATA=$G(^XTMP("ZVE2P",ID))
 . Q:DATA=""
 . N STAT S STAT=$P(DATA,U,8)
 . I STATUS'="ALL",STAT'=STATUS Q
 . ; Get submitter name
 . N SUBDUZ S SUBDUZ=+$P(DATA,U,6)
 . N SUBNAME S SUBNAME=""
 . I SUBDUZ>0 S SUBNAME=$$GET1^DIQ(200,SUBDUZ_",",.01,"E")
 . ; Get approver name if present
 . N APPDUZ S APPDUZ=+$P(DATA,U,9)
 . N APPNAME S APPNAME=""
 . I APPDUZ>0 S APPNAME=$$GET1^DIQ(200,APPDUZ_",",.01,"E")
 . ;
 . S CNT=CNT+1
 . S R(CNT)=ID_U_$P(DATA,U,1)_U_$P(DATA,U,2)_U_$P(DATA,U,3)_U_$P(DATA,U,4)_U_$P(DATA,U,5)_U_SUBDUZ_U_SUBNAME_U_$$FMTE^XLFDT($P(DATA,U,7))_U_STAT_U_APPDUZ_U_APPNAME_U_$$FMTE^XLFDT($P(DATA,U,10))
 ;
 S R(0)="1^"_CNT_"^OK"
 Q
 ;
 ; ============================================================
 ; ZVE 2P ACTION — Approve or reject a 2P request
 ; ============================================================
TWOPACT(R,REQID,ACTION,APPROVER) ;
 S REQID=+$G(REQID)
 I 'REQID S R(0)="0^Request ID required" Q
 I '$D(^XTMP("ZVE2P",REQID)) S R(0)="0^Request not found" Q
 S ACTION=$$UP^XLFSTR($G(ACTION))
 S APPROVER=+$G(APPROVER)
 I 'APPROVER S R(0)="0^Approver DUZ required" Q
 ;
 N DATA S DATA=$G(^XTMP("ZVE2P",REQID))
 N CURSTAT S CURSTAT=$P(DATA,U,8)
 I CURSTAT'="PENDING" S R(0)="0^Request is already "_CURSTAT Q
 ;
 N SUBMITTER S SUBMITTER=+$P(DATA,U,6)
 I APPROVER=SUBMITTER S R(0)="0^Cannot approve your own change request. A different administrator must approve." Q
 ;
 I ACTION="APPROVE" D  Q
 . ; Apply the parameter change via PARAMST
 . N FIELD,NEWVAL,PRES
 . S FIELD=$P(DATA,U,2)
 . S NEWVAL=$P(DATA,U,4)
 . D PARAMST^ZVEADMN1(.PRES,FIELD,NEWVAL,"2P approved by "_$$GET1^DIQ(200,APPROVER_",",.01,"E"))
 . ;
 . I $P($G(PRES(0)),U,1)=1 D
 . . S $P(^XTMP("ZVE2P",REQID),U,8)="APPROVED"
 . . S $P(^XTMP("ZVE2P",REQID),U,9)=APPROVER
 . . S $P(^XTMP("ZVE2P",REQID),U,10)=$$NOW^XLFDT
 . . D AUDITLOG^ZVEADMIN("2P-APPROVE",APPROVER,"ReqID="_REQID)
 . . S R(0)="1^OK^Change approved and applied"
 . E  D
 . . S R(0)="0^Approved but failed to apply: "_$G(PRES(0))
 ;
 I ACTION="REJECT" D  Q
 . S $P(^XTMP("ZVE2P",REQID),U,8)="REJECTED"
 . S $P(^XTMP("ZVE2P",REQID),U,9)=APPROVER
 . S $P(^XTMP("ZVE2P",REQID),U,10)=$$NOW^XLFDT
 . D AUDITLOG^ZVEADMIN("2P-REJECT",APPROVER,"ReqID="_REQID)
 . S R(0)="1^OK^Change request rejected"
 ;
 S R(0)="0^Invalid action: "_ACTION_" (use APPROVE or REJECT)"
 Q
 ;
 ; ============================================================
 ; ZVE ALERT CREATE — Create a VistA alert
 ; ============================================================
ALERTCRT(R,FROMDUZ,TODUZ,SUBJECT,BODY,PRIORITY) ;
 S FROMDUZ=+$G(FROMDUZ)
 I 'FROMDUZ S R(0)="0^Sender required" Q
 S TODUZ=+$G(TODUZ)
 I 'TODUZ S R(0)="0^Recipient required" Q
 I $G(SUBJECT)="" S R(0)="0^Subject required" Q
 ;
 ; Use XQALERT API
 N XQA,XQAARCH,XQAMSG,XQAID
 S XQA(TODUZ)=""
 S XQAMSG=SUBJECT
 S XQAARCH=1
 ;
 I $$UP^XLFSTR($G(PRIORITY))="HIGH" S XQAID="ZVE-HIGH-"_$$NOW^XLFDT
 ;
 D SETUP^XQALERT
 ;
 D AUDITLOG^ZVEADMIN("ALERT-CREATE",FROMDUZ,"To="_TODUZ_": "_SUBJECT)
 ;
 S R(0)="1^OK^Alert sent"
 Q
