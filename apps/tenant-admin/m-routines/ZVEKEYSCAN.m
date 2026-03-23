ZVEKEYSCAN ;VE/KM - Scan File 19.1 keys with holder counts from ^XUSEC;2026-03-22
 ;;1.0;VistA-Evolved Tenant Admin;**KEYSCAN**;Mar 22, 2026;Build 1
 Q
 ;
SCAN ; Scan all security keys and count holders from ^XUSEC
 ; Output: JSON array of {name, ien, holderCount, holders:[duz,...]}
 ; ^XUSEC("keyname",duz)="" is the holder index
 ; Usage: D SCAN^ZVEKEYSCAN
 N KEYIEN,KEYNAME,CT,DUZ0,HC,HLST,FIRST
 S U="^"
 W !,"["
 S FIRST=1,KEYIEN=0
 F  S KEYIEN=$O(^DIC(19.1,KEYIEN)) Q:KEYIEN=""  D
 . S KEYNAME=$P($G(^DIC(19.1,KEYIEN,0)),U,1)
 . Q:KEYNAME=""
 . ; Count holders from ^XUSEC
 . S HC=0,HLST=""
 . I $D(^XUSEC(KEYNAME)) D
 . . N DZ S DZ=""
 . . F  S DZ=$O(^XUSEC(KEYNAME,DZ)) Q:DZ=""  D
 . . . S HC=HC+1
 . . . I HC<11 S HLST=HLST_$S(HC>1:",",1:"")_DZ
 . I 'FIRST W ","
 . S FIRST=0
 . W !,"{""ien"":",KEYIEN
 . W ",""name"":""",$TR(KEYNAME,"""","'"),""""
 . W ",""holderCount"":",HC
 . W ",""holders"":[",HLST,"]"
 . W "}"
 W !,"]"
 Q
 ;
KEYHOLDERS(KEYNAME) ; Get holders for a specific key
 ; Output: JSON array of {duz, name}
 N DZ,NM,FIRST
 S U="^"
 W !,"["
 S FIRST=1
 I $D(^XUSEC(KEYNAME)) D
 . S DZ=""
 . F  S DZ=$O(^XUSEC(KEYNAME,DZ)) Q:DZ=""  D
 . . S NM=$P($G(^VA(200,DZ,0)),U,1)
 . . I 'FIRST W ","
 . . S FIRST=0
 . . W !,"{""duz"":",DZ,",""name"":""",$TR($S(NM'="":NM,1:"Unknown"),"""","'"),"""}"
 W !,"]"
 Q
