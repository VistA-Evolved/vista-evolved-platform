ZVEPRB92 ;VE probe - check YDB regions and actual data presence
 ;
PROBE ;
 ; First check if ANY FileMan data exists at all
 W "DIC(0): ",$G(^DIC(0)),!
 W "DD(200,0): ",$P($G(^DD(200,0)),"^",1),!  ; File 200 New Person
 ;
 ; Check new person file
 N IEN
 S IEN=$O(^VA(200,0))
 W "First user IEN in File 200: ",IEN,!
 IF IEN'="" W "  Name: ",$P($G(^VA(200,IEN,0)),"^",1),!
 ;
 ; Check File 4 Institution
 S IEN=$O(^DIC(4,0))
 W "First IEN in File 4 (DIC): ",IEN,!
 S IEN=$O(^DIC(4,"B",0))
 W "First IEN in File 4 B-index: ",IEN,!
 ;
 ; Check actual data presence via $D (exists check)
 W "$D(^DIC): ",$D(^DIC),!
 W "$D(^DD): ",$D(^DD),!
 W "$D(^VA): ",$D(^VA),!
 W "$D(^XWB): ",$D(^XWB),!
 W "$D(^XUSEC): ",$D(^XUSEC),!
 ;
 ; List top-level nodes in ^DIC
 W "Top-level ^DIC nodes: "
 N X S X=0
 F  S X=$O(^DIC(X)) Q:X=""  W X," "
 W !
 Q
