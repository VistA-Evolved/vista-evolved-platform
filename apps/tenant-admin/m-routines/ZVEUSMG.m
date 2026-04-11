ZVEUSMG ; VE — User management broker helpers (keys, e-sig, creds, lifecycle)
 ;;1.0;VE USERMG;**;Mar 21, 2026
 ; Overlay RPCs for tenant-admin direct writes. Register via INSTALL^ZVEUSMG.
 ; Keys use ^XUSEC(KEY,DUZ) (standard Kernel pattern).
 ; Output uses R() array (broker type 2) — NOT W-based.
 ; IMPORTANT: Target user param is TDUZ (not DUZ) to avoid shadowing system DUZ.
 Q
 ;
INSTALL ; Register RPCs in File #8994 (idempotent)
 W !,"=== Installing ZVE USMG RPCs ==="
 D REGONE("ZVE USMG KEYS","KEYS","ZVEUSMG","Assign/remove security keys")
 D REGONE("ZVE USMG ESIG","ESIG","ZVEUSMG","Set electronic signature code")
 D REGONE("ZVE USMG CRED","CRED","ZVEUSMG","Set access/verify (XUSHSH)")
 D REGONE("ZVE USMG ADD","ADD","ZVEUSMG","Create File 200 stub user")
 D REGONE("ZVE USMG DEACT","DEACT","ZVEUSMG","Set termination date (field 9)")
 D REGONE("ZVE USMG REACT","REACT","ZVEUSMG","Clear termination date")
 D REGONE("ZVE USMG TERM","TERM","ZVEUSMG","Full account termination (DISUSER + clear creds)")
 D REGONE("ZVE USMG UNLOCK","UNLOCK","ZVEUSMG","Release a locked-out account")
 D REGONE("ZVE USMG RENAME","RENAME","ZVEUSMG","Rename user (.01)")
 D REGONE("ZVE USMG CHKAC","CHKAC","ZVEUSMG","Check access code availability")
 W !,"=== ZVE USMG install complete ==="
 Q
 ;
REGONE(NAME,TAG,RTN,DESC) ; Register one remote procedure
 N IEN S IEN=$$FIND1^DIC(8994,,"BX",NAME)
 I IEN>0 W !,"  ",NAME," already registered" Q
 N FDA,ERR
 S FDA(8994,"+1,",.01)=NAME
 S FDA(8994,"+1,",.02)=TAG
 S FDA(8994,"+1,",.03)=RTN
 S FDA(8994,"+1,",.04)=2
 D UPDATE^DIE("E","FDA","","ERR")
 I $D(ERR) W !,"  ERROR: ",$G(ERR("DIERR",1,"TEXT",1)) Q
 W !,"  Registered: ",NAME
 Q
 ;
KEYS(R,ACT,TDUZ,KNM) ; RPC ZVE USMG KEYS — params: ACTION, target-DUZ, KEY name
 N E S E=""
 I $G(ACT)="" S E="ACTION required"
 I '+$G(TDUZ) S E="DUZ required"
 I $G(KNM)="" S E="KEY required"
 I E]"" S R(0)="0^"_E Q
 I ACT'="ADD",ACT'="DEL" S R(0)="0^Invalid ACTION" Q
 I '$D(^VA(200,+TDUZ,0)) S R(0)="0^User not found" Q
 ;
 ; Validate the key name exists in SECURITY KEY #19.1. Without this the
 ; ADD path would happily file arbitrary text as if it were a real key.
 I '$D(^DIC(19.1,"B",KNM)) S R(0)="0^Security key not found: "_KNM Q
 ;
 ; For ADD, also reject if the user already holds this key. VistA's
 ; ^XUSEC and File 200 field 51 both should remain single-valued per key
 ; per user — an idempotent ADD shouldn't silently create a duplicate row.
 I ACT="ADD" I $D(^XUSEC(KNM,+TDUZ)) S R(0)="0^User already holds key: "_KNM Q
 ;
 ; ORES/ORELSE mutual exclusion check (CONFLICT NEWed at this level)
 N CONFLICT S CONFLICT=0
 I ACT="ADD" D
 . I KNM="ORES" D  Q:CONFLICT
 . . N KIEN S KIEN=0
 . . F  S KIEN=$O(^VA(200,+TDUZ,51,KIEN)) Q:'KIEN  D  Q:CONFLICT
 . . . I $P($G(^VA(200,+TDUZ,51,KIEN,0)),U,1)="ORELSE" D
 . . . . S CONFLICT=1,R(0)="0^Cannot assign ORES: user holds ORELSE (mutually exclusive)"
 . I KNM="ORELSE" D  Q:CONFLICT
 . . N KIEN S KIEN=0
 . . F  S KIEN=$O(^VA(200,+TDUZ,51,KIEN)) Q:'KIEN  D  Q:CONFLICT
 . . . I $P($G(^VA(200,+TDUZ,51,KIEN,0)),U,1)="ORES" D
 . . . . S CONFLICT=1,R(0)="0^Cannot assign ORELSE: user holds ORES (mutually exclusive)"
 Q:CONFLICT
 ;
 I ACT="ADD" D
 . S ^XUSEC(KNM,+TDUZ)=""
 . N MAXK S MAXK=+$O(^VA(200,+TDUZ,51,"A"),-1)+1
 . S ^VA(200,+TDUZ,51,MAXK,0)=KNM
 . S ^VA(200,+TDUZ,51,"B",KNM,MAXK)=""
 . I '$P($G(^VA(200,+TDUZ,51,0)),U,1) S $P(^VA(200,+TDUZ,51,0),U,1)="200.051"
 . S $P(^VA(200,+TDUZ,51,0),U,3)=MAXK
 . S $P(^VA(200,+TDUZ,51,0),U,4)=$P($G(^VA(200,+TDUZ,51,0)),U,4)+1
 . D AUDITLOG^ZVEADMIN("KEY-ASSIGN",+TDUZ,"Key="_KNM)
 I ACT="DEL" D
 . N KIEN,FOUND S FOUND=0,KIEN=0
 . F  S KIEN=$O(^VA(200,+TDUZ,51,KIEN)) Q:'KIEN  D  Q:FOUND
 . . I $P($G(^VA(200,+TDUZ,51,KIEN,0)),U,1)=KNM D
 . . . K ^VA(200,+TDUZ,51,KIEN)
 . . . K ^VA(200,+TDUZ,51,"B",KNM,KIEN)
 . . . S FOUND=1
 . I 'FOUND S R(0)="0^Key not assigned: "_KNM Q
 . K ^XUSEC(KNM,+TDUZ)
 . S $P(^VA(200,+TDUZ,51,0),U,4)=$P($G(^VA(200,+TDUZ,51,0)),U,4)-1
 . D AUDITLOG^ZVEADMIN("KEY-REMOVE",+TDUZ,"Key="_KNM)
 S R(0)="1^OK^"_ACT Q
 ;
ESIG(R,TDUZ,CODE) ; RPC ZVE USMG ESIG
 I '+$G(TDUZ) S R(0)="0^DUZ required" Q
 I '$D(^VA(200,+TDUZ,0)) S R(0)="0^User not found" Q
 I $G(CODE)="" S R(0)="0^CODE required" Q
 N FDA,DIERR
 S FDA(200,TDUZ_",",20.4)=$$EN^XUSHSH(CODE)
 D FILE^DIE("","FDA","DIERR")
 I $D(DIERR) S R(0)="0^FILE^DIE error" Q
 D AUDITLOG^ZVEADMIN("ESIG-SET",+TDUZ,"E-sig set via USMG")
 S R(0)="1^OK" Q
 ;
CRED(R,TDUZ,AC,VC) ; RPC ZVE USMG CRED
 I '+$G(TDUZ) S R(0)="0^DUZ required" Q
 I '$D(^VA(200,+TDUZ,0)) S R(0)="0^User not found" Q
 I $G(AC)=""!($G(VC)="") S R(0)="0^ACCESS and VERIFY required" Q
 N FDA,DIERR
 S FDA(200,TDUZ_",",2)=$$EN^XUSHSH(AC)
 S FDA(200,TDUZ_",",11)=$$EN^XUSHSH(VC)
 ; Force password change on first login — set verify code change date to past
 ; S1.6: Use $$FMADD to compute yesterday in proper FileMan YYYMMDD format
 ; (2000101 was year 3700; DT-based math ensures a valid past date)
 S FDA(200,TDUZ_",",11.2)=$$FMADD^XLFDT(DT,-1)
 D FILE^DIE("","FDA","DIERR")
 I $D(DIERR) S R(0)="0^FILE^DIE error" Q
 D AUDITLOG^ZVEADMIN("CRED-SET",+TDUZ,"Credentials updated via admin")
 S R(0)="1^OK" Q
 ;
ADD(R,NM,AC,VC) ; RPC ZVE USMG ADD — minimal user creation
 ; File 200's .01 NAME input transform calls LAYGO^XUA4A7 which requires
 ; the classic DIC variables to be set up. UPDATE^DIE doesn't export DIC,
 ; so we use the older FILE^DICN pattern which is a standard FileMan
 ; add-with-LAYGO path. LAYGO^XUA4A7 reads DIC(0) to know it's allowed
 ; to create a new entry.
 I $G(NM)="" S R(0)="0^NAME required" Q
 N DIC,X,Y,DUPDUZ,DIADD,DIC0SAVE
 ; Refuse if name already exists to avoid accidental duplicate creation
 S DUPDUZ=$O(^VA(200,"B",NM,0))
 I +DUPDUZ>0 S R(0)="0^User already exists: "_NM_" (DUZ "_DUPDUZ_")" Q
 ; S9.23: Refuse if access code already in use (check "A" xref)
 I $G(AC)]"" N ACHASH S ACHASH=$$EN^XUSHSH(AC) I $O(^VA(200,"A",ACHASH,0))>0 S R(0)="0^Access code already in use" Q
 S DIC="^VA(200,"
 S DIC(0)="LX"
 S DIC("DR")=""
 S X=NM
 D FILE^DICN
 ; FILE^DICN returns Y = ien^name (positive IEN on success, -1 on failure)
 I +Y<0 S R(0)="0^FILE^DICN failed for name "_NM Q
 N NEWDUZ S NEWDUZ=+Y
 ; Set hashed credentials via FILE^DIE. XUSHSH is the Kernel hash routine
 ; that produces the same format XUS uses at sign-on, so the user can log
 ; in immediately with these access/verify codes.
 I $G(AC)]""!($G(VC)]"") D
 . N CFDA,CERR
 . I $G(AC)]"" S CFDA(200,NEWDUZ_",",2)=$$EN^XUSHSH(AC)
 . I $G(VC)]"" S CFDA(200,NEWDUZ_",",11)=$$EN^XUSHSH(VC)
 . ; Force password change on first login
 . ; S1.6: Use $$FMADD to compute yesterday in proper FileMan YYYMMDD format
 . S CFDA(200,NEWDUZ_",",11.2)=$$FMADD^XLFDT(DT,-1)
 . D FILE^DIE("","CFDA","CERR")
 D AUDITLOG^ZVEADMIN("USER-ADD",NEWDUZ,"Created user "_NM)
 S R(0)="1^"_NEWDUZ Q
 ;
DEACT(R,TDUZ,REASON) ; RPC ZVE USMG DEACT — soft deactivation
 I '+$G(TDUZ) S R(0)="0^DUZ required" Q
 I '$D(^VA(200,+TDUZ,0)) S R(0)="0^User not found" Q
 N FDA,DIERR
 ; Set DISUSER flag (node 7, piece 1) — blocks sign-on
 S $P(^VA(200,+TDUZ,7),U,1)=1
 ; Set termination date (field 9.2) to today
 S FDA(200,TDUZ_",",9.2)=DT
 ; C006: Write termination reason (field 9.4) if provided
 I $G(REASON)]"" S FDA(200,TDUZ_",",9.4)=REASON
 D FILE^DIE("","FDA","DIERR")
 I $D(DIERR) S R(0)="0^FILE^DIE error" Q
 D AUDITLOG^ZVEADMIN("USER-DEACT",+TDUZ,"Deactivated"_$S($G(REASON)]"":": "_REASON,1:""))
 S R(0)="1^OK" Q
 ;
REACT(R,TDUZ) ; RPC ZVE USMG REACT — reactivation
 I '+$G(TDUZ) S R(0)="0^DUZ required" Q
 I '$D(^VA(200,+TDUZ,0)) S R(0)="0^User not found" Q
 N FDA,DIERR
 ; Clear DISUSER flag — restores sign-on
 S $P(^VA(200,+TDUZ,7),U,1)=""
 ; Clear termination date (field 9.2)
 S FDA(200,TDUZ_",",9.2)="@"
 D FILE^DIE("","FDA","DIERR")
 I $D(DIERR) S R(0)="0^FILE^DIE error" Q
 D AUDITLOG^ZVEADMIN("USER-REACT",+TDUZ,"Reactivated")
 S R(0)="1^OK" Q
 ;
TERM(R,TDUZ) ; RPC ZVE USMG TERM — full account termination
 ; Sets DISUSER (#200 field 7) = 1, sets TERMINATION DATE (field 9.2),
 ; clears ACCESS CODE (field 2), clears VERIFY CODE (field 11),
 ; clears the e-signature (field 20.4), and removes all assigned keys.
 ; Mirrors the terminal "Terminate User" workflow used by site managers.
 I '+$G(TDUZ) S R(0)="0^DUZ required" Q
 I '$D(^VA(200,+TDUZ,0)) S R(0)="0^User not found" Q
 N FDA,DIERR
 S FDA(200,TDUZ_",",7)=1
 S FDA(200,TDUZ_",",9.2)=DT
 S FDA(200,TDUZ_",",2)="@"
 S FDA(200,TDUZ_",",11)="@"
 S FDA(200,TDUZ_",",20.4)="@"
 D FILE^DIE("","FDA","DIERR")
 I $D(DIERR) S R(0)="0^FILE^DIE error: "_$G(DIERR("DIERR",1,"TEXT",1)) Q
 ;
 ; Remove all keys from #200 field 51 and from ^XUSEC. Walk in reverse so
 ; deletes don't disturb the iteration.
 N KIEN,KNM
 S KIEN=$O(^VA(200,+TDUZ,51,""),-1)
 F  Q:'KIEN  D  S KIEN=$O(^VA(200,+TDUZ,51,KIEN),-1)
 . S KNM=$P($G(^VA(200,+TDUZ,51,KIEN,0)),U,1)
 . I KNM]"" K ^XUSEC(KNM,+TDUZ),^VA(200,+TDUZ,51,"B",KNM,KIEN)
 . K ^VA(200,+TDUZ,51,KIEN)
 ;
 ; Reset key subfile header counts and last-IEN
 I $D(^VA(200,+TDUZ,51,0)) D
 . S $P(^VA(200,+TDUZ,51,0),U,3)=0
 . S $P(^VA(200,+TDUZ,51,0),U,4)=0
 ;
 ; Also clear the locked-out flag if set, so a future re-activation
 ; doesn't surface a stale lockout state.
 K ^XUSEC("LOCKED",+TDUZ)
 ;
 D AUDITLOG^ZVEADMIN("USER-TERM",+TDUZ,"Account fully terminated (creds + keys cleared)")
 S R(0)="1^OK^Terminated" Q
 ;
UNLOCK(R,TDUZ) ; RPC ZVE USMG UNLOCK — release a locked-out account
 ; VistA's standard sign-on lockout uses ^XUSEC("LOCKED",DUZ) to gate
 ; further sign-on attempts after the failed-attempt threshold. The
 ; classic terminal option is "Release User [XUSERREL]". Clearing the
 ; node restores immediate sign-on access.
 I '+$G(TDUZ) S R(0)="0^DUZ required" Q
 I '$D(^VA(200,+TDUZ,0)) S R(0)="0^User not found" Q
 N WASLOCKED S WASLOCKED=$D(^XUSEC("LOCKED",+TDUZ))
 K ^XUSEC("LOCKED",+TDUZ)
 ;
 ; Some sites also use field 7.3 (FAILED SIGN-ON ATTEMPTS counter) to
 ; track lockout state. Reset it to clear the cumulative count.
 N FDA,DIERR
 S FDA(200,TDUZ_",",7.3)="@"
 D FILE^DIE("","FDA","DIERR")
 ; Field 7.3 may not exist at every site — DIERR here is non-fatal,
 ; the lockout xref clear (above) is the canonical action.
 ;
 D AUDITLOG^ZVEADMIN("USER-UNLOCK",+TDUZ,"Account released from lockout")
 S R(0)="1^OK^"_$S(WASLOCKED:"Was locked",1:"Was not locked")
 Q
 ;
RENAME(R,TDUZ,NEWNAME) ; RPC ZVE USMG RENAME — rename user (.01)
 ; Validates LAST,FIRST format and uniqueness, then files via FILE^DIE.
 I '+$G(TDUZ) S R(0)="0^DUZ required" Q
 I '$D(^VA(200,+TDUZ,0)) S R(0)="0^User not found" Q
 S NEWNAME=$$UP^XLFSTR($G(NEWNAME))
 I NEWNAME="" S R(0)="0^NEWNAME required" Q
 I NEWNAME'?1.30A1","1.30A.E S R(0)="0^Name must be in LAST,FIRST format" Q
 ;
 ; Reject duplicate names (FileMan uniqueness on .01 is enforced via input
 ; transform but we surface a clearer error here).
 N DUPDUZ S DUPDUZ=$O(^VA(200,"B",NEWNAME,0))
 I +DUPDUZ>0,+DUPDUZ'=+TDUZ S R(0)="0^Name already in use by DUZ "_DUPDUZ Q
 ;
 N OLDNAME S OLDNAME=$$GET1^DIQ(200,TDUZ_",",.01,"E")
 N FDA,DIERR
 S FDA(200,TDUZ_",",.01)=NEWNAME
 D FILE^DIE("","FDA","DIERR")
 I $D(DIERR) S R(0)="0^FILE^DIE error: "_$G(DIERR("DIERR",1,"TEXT",1)) Q
 ;
 D AUDITLOG^ZVEADMIN("USER-RENAME",+TDUZ,"Renamed: "_OLDNAME_" -> "_NEWNAME)
 S R(0)="1^OK^"_NEWNAME Q
 ;
AUDLOG(R,TDUZ,MAX) ; RPC ZVE USMG AUDLOG — ZVE administrative audit log
 ; Walks the ZVE-local audit log written by AUDITLOG^ZVEADMIN, stored at
 ; ^ZVEADM("AUDIT",LN)="EVT^DATE^SRCDUZ^TARGETDUZ^MSG". Returns the most
 ; recent MAX entries, newest first, with an optional target-DUZ filter.
 ;
 ; Params:
 ;   TDUZ — optional target DUZ filter. Empty or "*" for all users.
 ;   MAX  — optional result cap (default 50, hard cap 500)
 ;
 ; Output:
 ;   Line 0: "1^COUNT^OK"
 ;   Data  : "IEN^FILE^DATETIME^EVENT^FIELDNUM^USERDUZ^OLD^NEW^DESCRIPTION"
 N CNT,OUT,LIMIT
 S TDUZ=$G(TDUZ)
 S LIMIT=+$G(MAX) I LIMIT<1 S LIMIT=50
 I LIMIT>500 S LIMIT=500
 S CNT=0
 ;
 N LN S LN=""
 F  S LN=$O(^ZVEADM("AUDIT",LN),-1) Q:LN=""!(CNT'<LIMIT)  D
 . N Z,EVT,DT,SRC,TGT,MSG
 . S Z=$G(^ZVEADM("AUDIT",LN))
 . I Z="" Q
 . S EVT=$P(Z,U,1),DT=$P(Z,U,2),SRC=$P(Z,U,3),TGT=$P(Z,U,4),MSG=$P(Z,U,5,99)
 . I TDUZ]"",TDUZ'="*",+TDUZ'=+TGT Q
 . S CNT=CNT+1
 . S OUT(CNT)=LN_U_"200"_U_DT_U_EVT_U_""_U_SRC_U_""_U_""_U_MSG
 ;
 S R(0)="1^"_CNT_"^OK"
 N I F I=1:1:CNT S R(I)=OUT(I)
 Q
 ;
CHKAC(R,AC) ; RPC ZVE USMG CHKAC — check access code availability
 ; S9.23: Checks ^VA(200,"A") xref for hashed access code collisions.
 ; Returns 1^Available or 0^Access code already in use.
 I $G(AC)="" S R(0)="0^Access code required" Q
 N HASH,DUP
 S HASH=$$EN^XUSHSH(AC)
 S DUP=$O(^VA(200,"A",HASH,0))
 I +DUP>0 S R(0)="0^Access code already in use" Q
 S R(0)="1^Available"
 Q
