ZVEPRB93 ;VE probe - kernel site params actual data
 ;
PROBE ;
 ; Check File 8989.3 data in correct env
 W "DIC(8989.3,0): ",$G(^DIC(8989.3,0)),!
 W "DD(8989.3,0): ",$P($G(^DD(8989.3,0)),"^",1),!
 ;
 ; Find the global name for file 8989.3
 W "GL for 8989.3: ",$G(^DD(8989.3,0,"GL")),!
 ;
 ; Try XTV global directly
 N X
 S X=$D(^XTV(8989.3,0))
 W "$D(XTV 8989.3): ",X,!
 S X=$O(^XTV(8989.3,0))
 W "First XTV 8989.3 key: ",X,!
 ;
 ; Try the DIC approach for global lookup
 N GNAME
 S GNAME=$P($G(^DD(8989.3,0,"GL")),"^",1)
 W "Global name (DD): ",GNAME,!
 ;
 ; Use DIQ to get field .01 from entry 1
 N QANS
 S QANS=$$GET1^DIQ(8989.3,"1,",.01)
 W "GET1 8989.3 1, .01: ",QANS,!
 ;
 ; Try using the DIC record
 N DICR
 D ^DIC
 ;
 ; Standard FileMan lookup
 N X,Y,DIC
 S DIC=8989.3,DIC(0)="FEMZ",X=""
 D ^DIC
 IF Y>0 W "Lookup found: ",Y,!
 ELSE  W "No entry found",!
 ;
 ; Check what's actually in XTV for kernel params
 W "XTV subscripts near 8989: "
 S X=8989
 F  S X=$O(^XTV(X)) Q:X=""!(X>8990)  W X," "
 W !
 ;
 ; Direct global check for kernel params
 W "Checking kernel site params globals...",!
 ; Some VistA distros use ^KERNAL8989.3
 ; Check if the file's global pointer is in the DD
 N FILEGLO
 S FILEGLO=$P($G(^DIC(8989.3,0)),"^",3)
 W "DIC(8989.3,0) file global: ",FILEGLO,!
 Q
