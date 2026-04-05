ZVEPRB94 ;VE probe - File 8989.3 actual fields and DDR test
 ;
PROBE ;
 ; List fields in DD for File 8989.3
 W "Fields in File 8989.3:",!
 N FLD
 S FLD=0
 F  S FLD=$O(^DD(8989.3,FLD)) Q:FLD=""  D
 . W "  Field ",FLD,": ",$P($G(^DD(8989.3,FLD,0)),"^",1),!
 ;
 ; Show the actual data in IEN 1
 W !,"Raw data in 8989.3 IEN 1:",!
 N NODE
 S NODE=0
 F  S NODE=$O(^XTV(8989.3,1,NODE)) Q:NODE=""  W "  Node: ",NODE," = ",$G(^XTV(8989.3,1,NODE)),!
 ;
 ; Test DDR GETS ENTRY DATA with just .01 field using colon separator
 W !,"Test DDR GETS with .01 only:",!
 N RESULT
 D GETS^DIDT(8989.3,"1,",".01","E",.RESULT)
 N K S K=0
 F  S K=$O(RESULT(K)) Q:K=""  W "  RESULT(",K,"): ",$G(RESULT(K)),!
 ;
 ; Test with basic safe fields
 W !,"Test DDR GETS with .01:.02:.03:",!
 N RESULT2
 D GETS^DIDT(8989.3,"1,",".01:.02:.03","E",.RESULT2)
 S K=0
 F  S K=$O(RESULT2(K)) Q:K=""  W "  RESULT2(",K,"): ",$G(RESULT2(K)),!
 Q
