ZVECHK ; Temp diagnostic routine
 Q
CHK ;
 ; Check which files exist
 W "=== File Existence ===",!
 N F F F=2,36,42,200,405,8994,19 D
 . N H S H=$G(^DIC(F,0))
 . W "File ",F,": ",$S(H]"":$P(H,"^",1),1:"NOT FOUND"),!
 ;
 ; Check DGPM global (File 405 storage)
 W "=== Globals ===",!
 W "^DGPM(0): ",$G(^DGPM(0)),!
 W "^DPT(0): ",$P($G(^DPT(0)),"^",1,3),!
 W "^DIC(42,0): ",$P($G(^DIC(42,0)),"^",1,3),!
 W "^VA(200,0): ",$P($G(^VA(200,0)),"^",1,3),!
 ;
 ; Check DD for 405
 W "=== DD(405) ===",!
 W "DD(405,0): ",$G(^DD(405,0)),!
 W "DD(405,.01,0): ",$G(^DD(405,.01,0)),!
 W "DD(405,.02,0): ",$G(^DD(405,.02,0)),!
 W "DD(405,.03,0): ",$G(^DD(405,.03,0)),!
 ;
 ; First patient and ward
 W "=== Test Data ===",!
 N DFN S DFN=$O(^DPT(0))
 W "First DFN: ",DFN,!
 I DFN W "  Name: ",$P($G(^DPT(DFN,0)),"^",1),!
 I DFN W "  Loc node: ",$G(^DPT(DFN,.1)),!
 N WD S WD=$O(^DIC(42,0))
 W "First Ward: ",WD,!
 I WD W "  Ward name: ",$P($G(^DIC(42,WD,0)),"^",1),!
 ;
 ; Count wards
 N WCNT S WCNT=0,WD=0 F  S WD=$O(^DIC(42,WD)) Q:'WD  S WCNT=WCNT+1
 W "Total wards: ",WCNT,!
 ;
 ; Count patients
 N PCNT S PCNT=0,DFN=0 F  S DFN=$O(^DPT(DFN)) Q:'DFN  Q:DFN="B"  S PCNT=PCNT+1
 W "Total patients: ",PCNT,!
 ;
 ; File 405 field definitions
 W "=== File 405 Fields ===",!
 N F F F=.01,.02,.03,.04,.05,.06,.07,.08,.09,.1,.11,.12,.14,.18,.19 D
 . W "  ",F,": ",$P($G(^DD(405,F,0)),"^",1)," [",$P($G(^DD(405,F,0)),"^",2),"]",!
 ;
 ; Transaction types
 W "=== File 405.3 (TRANSACTION Type) ===",!
 N I S I=0 F  S I=$O(^DG(405.3,I)) Q:'I  W "  ",I,": ",$P($G(^DG(405.3,I,0)),"^",1),!
 ;
 ; Movement types (405.1)
 W "=== File 405.1 (TYPE OF MOVEMENT) first 15 ===",!
 N I,C S I=0,C=0 F  S I=$O(^DG(405.1,I)) Q:'I  Q:C>14  S C=C+1 D
 . W "  ",I,": ",$P($G(^DG(405.1,I,0)),"^",1)," trans=",$P($G(^DG(405.1,I,0)),"^",2),!
 ;
 ; Treating specialties (45.7)
 W "=== File 45.7 (TREATING SPECIALTY) first 10 ===",!
 N I,C S I=0,C=0 F  S I=$O(^DIC(45.7,I)) Q:'I  Q:C>9  S C=C+1 D
 . W "  ",I,": ",$P($G(^DIC(45.7,I,0)),"^",1),!
 ;
 ; Admitting regulations (43.4)
 W "=== File 43.4 (ADMITTING REGULATION) first 10 ===",!
 N I,C S I=0,C=0 F  S I=$O(^DG(43.4,I)) Q:'I  Q:C>9  S C=C+1 D
 . W "  ",I,": ",$P($G(^DG(43.4,I,0)),"^",1),!
 ;
 ; Existing movement record
 W "=== Sample DGPM record ===",!
 N I S I=$O(^DGPM(0)) I I W "  DGPM(",I,")=",$G(^DGPM(I,0)),!
 ;
 ; File 405 identifier
 W "=== File 405 ID ===",!
 W "ID: ",$G(^DD(405,0,"ID")),!
 ;
 ; Check ZVETEST patient
 W "=== ZVETEST patient ===",!
 N NM S NM="" F  S NM=$O(^DPT("B",NM)) Q:NM=""  Q:NM]]"ZVETEST,"  D
 . I NM["ZVEDEPLOY"!(NM["ZVETEST") D
 . . N D2 S D2=$O(^DPT("B",NM,0))
 . . W "  ",NM," DFN=",D2,!
 Q
