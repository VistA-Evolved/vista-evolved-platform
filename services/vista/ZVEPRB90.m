ZVEPRB90 ;VE probe - find actual Kernel Site Params global
 ;
PROBE ;
 ; Check the data dictionary to find the global for File 8989.3
 W "DD global for 8989.3: ",$G(^DD(8989.3,0,"GL")),!
 ;
 ; Try common kernel globals
 W "XTV(8989.3,0): ",$G(^XTV(8989.3,0)),!
 W "XTV(8989.3,B,0): ",$G(^XTV(8989.3,"B",0)),!
 ;
 ; Check the standard kernel site params globals
 W "XTMP(8989.3,0): ",$G(^XTMP(8989.3,0)),!
 ;
 ; List all XTV subscripts
 W "XTV subscripts:  "
 N X S X=0
 F  S X=$O(^XTV(X)) Q:X=""  W X," "
 W !
 ;
 ; Check if 8989 exists (vs 8989.3)
 W "8989 first IEN: ",$O(^XTV(8989,0)),!
 ;
 ; Find via FileMan global lookup
 N GNAME
 S GNAME=$G(^DIC(8989.3,0,"GL"))
 W "DIC global name: ",GNAME,!
 IF GNAME'="" D CHECKGLOBAL(GNAME)
 Q
 ;
CHECKGLOBAL(GNAME) ;
 ; Check the global by name
 N IEN
 S IEN=0
 ; Can't use indirection safely for all globals, so list known variants
 W "Checking common system param globals...",!
 W "^XUP(8989.3,0): ",$G(^XUP(8989.3,0)),!
 W "^XTMP(8989.3,0): ",$G(^XTMP(8989.3,0)),!
 ; XT namespace
 N X
 S X=0
 W "XT namespace top level: "
 F  S X=$O(^XT(X)) Q:X=""  W X," "
 W !
 Q
