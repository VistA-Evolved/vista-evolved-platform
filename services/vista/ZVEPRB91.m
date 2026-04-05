ZVEPRB91 ;VE probe - find site parameters data
 ;
PROBE ;
 ; The kernel site params could be at different file numbers
 ; Let's check a range of related files in DIC
 W "Checking DIC for kernel-related files...",!
 N FILE
 F FILE=8,8.1,8.2,8989,8989.1,8989.3,8989.5,8990,8991,8993,8994 D
 . W "File ",FILE,": ",$P($G(^DIC(FILE,0)),"^",1),!
 ;
 ; Look for the actual site params global
 W !,"Checking site params globals...",!
 W "XWB(8994,0): ",$G(^XWB(8994,0)),!  ; RPC Broker
 ;
 ; Try to find the actual site name via KERNEL
 W "Site name via VASITE: ",$G(^VASITE)," ",$P($G(^VASITE),"^",1),!
 ;
 ; Check XPAR (Parameters file - might store kernel params)
 W "XPAR(8989.5,0): ",$G(^XPAR(8989.5,0)),!
 ;
 ; Try Kernel System Parameters via direct globals
 N IEN
 S IEN=$O(^XPAR(0))
 W "XPAR first key: ",IEN,!
 S IEN=$O(^XPAR("INST",0))
 W "XPAR INST: ",IEN,!
 ;
 ; Check FileMan directly - find what's in DIC around 8989
 N X
 S X=8989
 F  S X=$O(^DIC(X)) Q:X=""!(X>8999)  W "  DIC(",X,"): ",$P($G(^DIC(X,0)),"^",1),!
 Q
