ZVEINSTALL ; VE — Master Wave 1 Installation Script ; Apr 2026
 ;;1.0;VISTA EVOLVED;**1**;Apr 2026;Build 1
 ;
 ; Master installer — runs all Wave 1 routine INSTALL entry points
 ; then registers RPCs into context options
 ;
 ; Usage: D RUN^ZVEINSTALL
 ;
 Q  ; No direct entry
 ;
RUN ;
 W !,"####################################################"
 W !,"#  VistA Evolved — Wave 1 RPC Installation          #"
 W !,"#  30 RPCs across 5 new routines                    #"
 W !,"####################################################"
 W !,""
 ;
 ; Step 1: Register all RPCs in File #8994
 W !,"=== Step 1: Registering RPCs in File 8994 ==="
 D INSTALL^ZVEADMIN
 D INSTALL^ZVEADMN1
 D INSTALL^ZVEPAT
 D INSTALL^ZVEPAT1
 D INSTALL^ZVEADT
 D INSTALL^ZVESITEV
 W !,""
 ;
 ; Step 2: Create context options and add RPCs
 W !,"=== Step 2: Creating Context Options ==="
 D RUN^ZVECTX2
 W !,""
 ;
 ; Step 3: Verify installation
 W !,"=== Step 3: Verification ==="
 D VERIFY
 W !,""
 ;
 W !,"####################################################"
 W !,"#  Installation complete!                           #"
 W !,"####################################################"
 Q
 ;
VERIFY ;
 ; Count registered ZVE RPCs in File #8994
 N CNT,NM S CNT=0
 S NM="" F  S NM=$O(^XWB(8994,"B",NM)) Q:NM=""  D
 . I $E(NM,1,3)="ZVE" S CNT=CNT+1
 ;
 W !,"ZVE RPCs in File 8994: ",CNT
 ;
 ; Verify context options exist
 N ADMCTX S ADMCTX=$$FIND1^DIC(19,,"BX","ZVE ADMIN CONTEXT")
 W !,"ZVE ADMIN CONTEXT: ",$S(ADMCTX>0:"OK (IEN="_ADMCTX_")",1:"MISSING!")
 ;
 N PATCTX S PATCTX=$$FIND1^DIC(19,,"BX","ZVE PATIENT CONTEXT")
 W !,"ZVE PATIENT CONTEXT: ",$S(PATCTX>0:"OK (IEN="_PATCTX_")",1:"MISSING!")
 ;
 ; List all registered ZVE RPCs
 W !,""
 W !,"--- Registered ZVE RPCs ---"
 S NM="" F  S NM=$O(^XWB(8994,"B",NM)) Q:NM=""  D
 . I $E(NM,1,3)'="ZVE" Q
 . N IEN S IEN=$O(^XWB(8994,"B",NM,0))
 . N TAG S TAG=$P($G(^XWB(8994,IEN,0)),U,2)
 . N RTN S RTN=$P($G(^XWB(8994,IEN,0)),U,3)
 . W !,"  ",NM," -> ",TAG,"^",RTN
 Q
