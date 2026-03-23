PROBE ;; Probe VistA users in File 200
 N I,CNT
 S CNT=0
 S I=0
 F  S I=$O(^VA(200,I)) Q:I=""  D
 . S CNT=CNT+1
 . W I_" "_$P($G(^VA(200,I,0)),"^",1),!
 . Q:CNT>25
 W "Total users found: "_CNT,!
 Q
