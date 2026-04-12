ZVECHECK ; Quick diagnostic — check user, menu, terminal type
 ;
EN ;
 W "=== User 65 Check ===",!
 W "DUZ 65 node 0: ",$G(^VA(200,65,0)),!
 W "DUZ 65 field 201 (primary menu): ",$G(^VA(200,65,201)),!
 ;
 N EVE S EVE=+$O(^DIC(19,"B","EVE",0))
 W "EVE IEN in file 19: ",EVE,!
 I EVE>0 W "EVE node 0: ",$G(^DIC(19,EVE,0)),!
 ;
 W !,"=== XOPT (Kernel System Params) ===",!
 W "^XTV(8989.3,1,""XUS""): ",$G(^XTV(8989.3,1,"XUS")),!
 W "  Piece 5 (ENQ device attrib): ",$P($G(^XTV(8989.3,1,"XUS")),U,5),!
 ;
 W !,"=== Terminal Type check ===",!
 W "User 65 node 1.2 (terminal type): ",$G(^VA(200,65,1.2)),!
 ;
 W !,"=== XQ Menu Manager ===",!
 W "^DIC(19,0): ",$G(^DIC(19,0)),!
 W "XQ1 routine exists: ",$S($T(EN^XQ1)]"":"YES",1:"NO"),!
 W "XQ routine exists: ",$S($T(EN^XQ)]"":"YES",1:"NO"),!
 W "XQ83 CHEK exists: ",$S($T(CHEK^XQ83)]"":"YES",1:"NO"),!
 ;
 W !,"=== All users with primary menu ===",!
 N I S I=0 F  S I=$O(^VA(200,I)) Q:I'>0  I $G(^VA(200,I,201))>0 W "  DUZ=",I," menu=",^VA(200,I,201)," name=",$P($G(^VA(200,I,0)),U),!
 ;
 H
