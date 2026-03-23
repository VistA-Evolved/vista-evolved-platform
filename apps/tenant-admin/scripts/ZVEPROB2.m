ZVEPROB2 ;; Probe VistA data integrity for tenant-admin
 ;;
PROBE ;
 N I,C,NM
 W "=== VistA Data Probe ===",!
 W "^DD exists: "_$D(^DD),!
 W "^VA(200) exists: "_$D(^VA(200)),!
 W "^DIC(19) exists: "_$D(^DIC(19)),!
 W "^DIC(19.1) exists: "_$D(^DIC(19.1)),!
 W "^XWB(8994) exists: "_$D(^XWB(8994)),!
 ;
 W !,"--- Users (File 200) ---",!
 S I=0,C=0
 F  S I=$O(^VA(200,I)) Q:I=""  D
 . S C=C+1
 . S NM=$P($G(^VA(200,I,0)),"^",1)
 . W:C<30 I_" "_NM,!
 S:'C C=0
 W "Total users: "_C,!
 ;
 W !,"--- RPC Broker (File 8994) sample ---",!
 S I=0,C=0
 F  S I=$O(^XWB(8994,I)) Q:I=""  S C=C+1
 W "Total RPCs registered: "_C,!
 ;
 W !,"--- Options (File 19) count ---",!
 S I=0,C=0
 F  S I=$O(^DIC(19,I)) Q:I=""  S C=C+1
 W "Total options: "_C,!
 ;
 W !,"--- Security Keys (File 19.1) count ---",!
 S I=0,C=0
 F  S I=$O(^DIC(19.1,I)) Q:I=""  S C=C+1
 W "Total security keys: "_C,!
 ;
 W !,"=== Probe complete ===",!
 Q
