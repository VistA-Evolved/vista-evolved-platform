ZVEPRB89 ;VE probe routine - File 8989.3 DDR field test
 ;
PROBE ;
 ; List first entry in File 8989.3
 N ARRAY,IEN,X
 ; Use DDR LISTER logic - find the first IEN
 S IEN=0
 S IEN=$O(^XTV(8989.3,IEN))
 W "First IEN in 8989.3: ",IEN,!
 IF IEN="" W "No entries found in 8989.3",! Q
 ;
 ; Read the key fields directly
 W ".01 SITE NAME: ",$P($G(^XTV(8989.3,IEN,0)),"^",1),!
 W ".02 DOMAIN NAME: ",$P($G(^XTV(8989.3,IEN,0)),"^",2),!
 W ".03 VOLUME SET: ",$P($G(^XTV(8989.3,IEN,0)),"^",3),!
 ;
 ; Try DDR GETS approach with correct IENS format
 N RESULT
 S RESULT=""
 D GETS^DIDT
 ;
 ; Show what globals are under this IEN
 W "Nodes under IEN ",IEN,":",!
 N NODE
 S NODE=""
 F  S NODE=$O(^XTV(8989.3,IEN,NODE)) Q:NODE=""  W "  Node: ",NODE," = ",$G(^XTV(8989.3,IEN,NODE)),!
 Q
 ;
DDRTEST ;
 ; Call DDR GETS ENTRY DATA RPC directly
 N GARRAY,FLAGS,FILE,IENS,FIELDS,NODES
 S FILE=8989.3
 S IENS="1,"
 S FIELDS=".01:.02:.03"
 S FLAGS="E"
 ; Standard DDR GETS call
 D GETS^DIDT(FILE,IENS,FIELDS,FLAGS,.GARRAY)
 N I
 S I=0
 F  S I=$O(GARRAY(I)) Q:I=""  W "GARRAY(",I,"): ",$G(GARRAY(I)),!
 Q
