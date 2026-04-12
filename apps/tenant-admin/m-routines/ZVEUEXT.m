ZVEUEXT ; VE — User extension data (fields not in File 200)
 ;;1.0;VE USEREXT;**;Apr 12, 2026
 ; Stores custom extension fields for File 200 users in ^ZVEX.
 ; Fields: EMPID (Employee ID), ROLE (admin panel role used at creation),
 ;         SECONDARY (secondary feature flags).
 ; #597: Moved from ^XTMP("ZVE-USEREXT") to permanent ^ZVEX global.
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
ENSURENODE ; Ensure ^ZVEX exists (no-op for permanent global, kept for compatibility)
 Q
 ;
EXTSET(R,TDUZ,FIELD,VALUE) ; RPC ZVE UEXT SET
 I '+$G(TDUZ) S R(0)="0^DUZ required" Q
 I $G(FIELD)="" S R(0)="0^FIELD required" Q
 I '$D(^VA(200,+TDUZ,0)) S R(0)="0^User not found" Q
 ; Whitelist of allowed extension fields (delimited match prevents substring bypass)
 N ALLOWED S ALLOWED="^EMPID^ROLE^SECONDARY^DISPLAYNAME^"
 I ALLOWED'["^"_FIELD_"^" S R(0)="0^Invalid extension field: "_FIELD Q
 D ENSURENODE
 S ^ZVEX(+TDUZ,FIELD)=$G(VALUE)
 D AUDITLOG^ZVEADMIN("UEXT-SET",+TDUZ,"Set "_FIELD_"="_$G(VALUE))
 S R(0)="1^OK" Q
 ;
EXTGET(R,TDUZ,FIELD) ; RPC ZVE UEXT GET
 I '+$G(TDUZ) S R(0)="0^DUZ required" Q
 I $G(FIELD)="" S R(0)="0^FIELD required" Q
 S R(0)="1^"_$G(^ZVEX(+TDUZ,FIELD)) Q
 ;
EXTALL(R,TDUZ) ; RPC ZVE UEXT GETALL — returns all extension fields for a user
 I '+$G(TDUZ) S R(0)="0^DUZ required" Q
 N FLD,I S I=0
 S R(0)="1^OK"
 S FLD=""
 F  S FLD=$O(^ZVEX(+TDUZ,FLD)) Q:FLD=""  D
 . S I=I+1
 . S R(I)=FLD_U_$G(^ZVEX(+TDUZ,FLD))
 Q
 ;
MIGRATE ; Migrate ^XTMP("ZVE-USEREXT") → ^ZVEX (run once, idempotent)
 I '$D(^XTMP("ZVE-USEREXT")) W !,"No ^XTMP data to migrate" Q
 N DUZ2,FLD,CNT S CNT=0
 S DUZ2=0 F  S DUZ2=$O(^XTMP("ZVE-USEREXT",DUZ2)) Q:'DUZ2  D
 . S FLD="" F  S FLD=$O(^XTMP("ZVE-USEREXT",DUZ2,FLD)) Q:FLD=""  D
 . . I '$D(^ZVEX(DUZ2,FLD)) S ^ZVEX(DUZ2,FLD)=^XTMP("ZVE-USEREXT",DUZ2,FLD) S CNT=CNT+1
 W !,"Migrated ",CNT," extension fields to ^ZVEX"
 Q
