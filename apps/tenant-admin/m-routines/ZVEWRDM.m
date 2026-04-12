ZVEWRDM ; VE — Ward (File 42) direct writes
 ;;1.0;VE WRDM;**;Mar 21, 2026
 Q
 ;
INSTALL
 W !,"=== Installing ZVE WRDM RPCs ==="
 D REGONE("ZVE WRDM EDIT","EDIT","ZVEWRDM","Edit ward location name")
 W !,"=== ZVE WRDM install complete ==="
 Q
 ;
REGONE(NAME,TAG,RTN,DESC)
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
EDIT(R,IEN,NM) ; RPC ZVE WRDM EDIT
 I '+$G(IEN) W "0^IEN required",! Q
 I $G(NM)="" W "0^NAME required",! Q
 N FDA,DIERR
 S FDA(42,IEN_",",.01)=NM
 D FILE^DIE("","FDA","DIERR")
 I $D(DIERR) W "0^FILE^DIE error",! Q
 W "1^OK",! Q
