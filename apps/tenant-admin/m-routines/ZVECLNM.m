ZVECLNM ; VE — Clinic (File 44) direct writes
 ;;1.0;VE CLNM;**;Mar 21, 2026
 Q
 ;
INSTALL
 W !,"=== Installing ZVE CLNM RPCs ==="
 D REGONE("ZVE CLNM ADD","ADD","ZVECLNM","Add hospital location")
 D REGONE("ZVE CLNM EDIT","EDIT","ZVECLNM","Edit hospital location name")
 W !,"=== ZVE CLNM install complete ==="
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
ADD(R,NM) ; RPC ZVE CLNM ADD
 I $G(NM)="" W "0^NAME required",! Q
 N FDA,IEN,DIERR
 S FDA(44,"+1,",.01)=NM
 D UPDATE^DIE("E",$NA(FDA),$NA(IEN),$NA(DIERR))
 I $D(DIERR) W "0^UPDATE^DIE failed",! Q
 W "1^",$G(IEN(1)),! Q
 ;
EDIT(R,IEN,NM) ; RPC ZVE CLNM EDIT
 I '+$G(IEN) W "0^IEN required",! Q
 I $G(NM)="" W "0^NAME required",! Q
 N FDA,DIERR
 S FDA(44,IEN_",",.01)=NM
 D FILE^DIE("","FDA","DIERR")
 I $D(DIERR) W "0^FILE^DIE error",! Q
 W "1^OK",! Q
