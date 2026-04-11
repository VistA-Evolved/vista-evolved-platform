ZVEUEXT ; VE — User extension data (fields not in File 200)
 ;;1.0;VE USEREXT;**;Apr 12, 2026
 ; Stores custom extension fields for File 200 users in ^XTMP("ZVE-USEREXT").
 ; Fields: EMPID (Employee ID), ROLE (admin panel role used at creation),
 ;         SECONDARY (secondary feature flags).
 ; ^XTMP purge date set 10 years out so data is effectively permanent.
 Q
 ;
INSTALL ; Register RPCs in File #8994
 W !,"=== Installing ZVE UEXT RPCs ==="
 D REGONE^ZVEUSMG("ZVE UEXT SET","EXTSET","ZVEUEXT","Set user extension field")
 D REGONE^ZVEUSMG("ZVE UEXT GET","EXTGET","ZVEUEXT","Get user extension field")
 D REGONE^ZVEUSMG("ZVE UEXT GETALL","EXTALL","ZVEUEXT","Get all extension fields for user")
 W !,"=== ZVE UEXT install complete ==="
 Q
 ;
ENSURENODE ; Ensure ^XTMP("ZVE-USEREXT") exists with a far-future purge date
 I '$D(^XTMP("ZVE-USEREXT",0)) D
 . ; Set purge date 10 years from now and description
 . S ^XTMP("ZVE-USEREXT",0)=$$FMADD^XLFDT(DT,3650)_U_DT
 . S ^XTMP("ZVE-USEREXT","DESC")="VistA Evolved user extension fields"
 Q
 ;
EXTSET(R,TDUZ,FIELD,VALUE) ; RPC ZVE UEXT SET
 I '+$G(TDUZ) S R(0)="0^DUZ required" Q
 I $G(FIELD)="" S R(0)="0^FIELD required" Q
 I '$D(^VA(200,+TDUZ,0)) S R(0)="0^User not found" Q
 ; Whitelist of allowed extension fields
 N ALLOWED S ALLOWED="EMPID^ROLE^SECONDARY^DISPLAYNAME"
 I ALLOWED'[FIELD S R(0)="0^Invalid extension field: "_FIELD Q
 D ENSURENODE
 S ^XTMP("ZVE-USEREXT",+TDUZ,FIELD)=$G(VALUE)
 D AUDITLOG^ZVEADMIN("UEXT-SET",+TDUZ,"Set "_FIELD_"="_$G(VALUE))
 S R(0)="1^OK" Q
 ;
EXTGET(R,TDUZ,FIELD) ; RPC ZVE UEXT GET
 I '+$G(TDUZ) S R(0)="0^DUZ required" Q
 I $G(FIELD)="" S R(0)="0^FIELD required" Q
 S R(0)="1^"_$G(^XTMP("ZVE-USEREXT",+TDUZ,FIELD)) Q
 ;
EXTALL(R,TDUZ) ; RPC ZVE UEXT GETALL — returns all extension fields for a user
 I '+$G(TDUZ) S R(0)="0^DUZ required" Q
 N FLD,I S I=0
 S R(0)="1^OK"
 S FLD=""
 F  S FLD=$O(^XTMP("ZVE-USEREXT",+TDUZ,FLD)) Q:FLD=""  D
 . S I=I+1
 . S R(I)=FLD_U_$G(^XTMP("ZVE-USEREXT",+TDUZ,FLD))
 Q
