ZVEKOMEN ; Korean Menu Translation Overlay — EVE Tree (Level 3)
 ; Translates MENU TEXT (Field 1 / piece 2 of ^DIC(19,IEN,0))
 ; for the Systems Manager Menu (EVE) top-level items.
 ;
 ; Backup stored in ^ZVEMENU("backup",IEN). Fully reversible.
 ;
 ; Usage:
 ;   D APPLY^ZVEKOMEN      — Back up English + write Korean text
 ;   D RESTORE^ZVEKOMEN    — Restore English text from backup
 ;   D STATUS^ZVEKOMEN     — Show current EVE tree menu text
 ;
EN ;
 D STATUS
 Q
 ;
APPLY ; Apply Korean translations to EVE tree menu items
 N COUNT,TOTAL
 S COUNT=0,TOTAL=0
 W "=== Applying Korean menu translations (EVE tree) ===",!
 ;
 ; --- Parent menu ---
 ; IEN 28 = EVE "Systems Manager Menu"
 D SET1(28,$C(49884,49828,53596,32,44288,47532,51088,32,47700,45684),.COUNT,.TOTAL)
 ;
 ; --- Child items ---
 ; IEN 29 = XUPROG "Programmer Options"
 D SET1(29,$C(54532,47196,44536,47000,47672,32,50741,49496),.COUNT,.TOTAL)
 ;
 ; IEN 18 = DIUSER "VA FileMan"
 D SET1(18,"VA "_$C(54028,51068,44288,47532,51088),.COUNT,.TOTAL)
 ;
 ; IEN 30 = XUTIO "Device Management"
 D SET1(30,$C(51109,52824,32,44288,47532),.COUNT,.TOTAL)
 ;
 ; IEN 37 = XUSER "User Management"
 D SET1(37,$C(49324,50857,51088,32,44288,47532),.COUNT,.TOTAL)
 ;
 ; IEN 8 = XUMAINT "Menu Management"
 D SET1(8,$C(47700,45684,32,44288,47532),.COUNT,.TOTAL)
 ;
 ; IEN 38 = XUCORE "Core Applications"
 D SET1(38,$C(54645,49900,32,51025,50857,32,54532,47196,44536,47016),.COUNT,.TOTAL)
 ;
 ; IEN 96 = XUSITEMGR "Operations Management"
 D SET1(96,$C(50868,50689,32,44288,47532),.COUNT,.TOTAL)
 ;
 ; IEN 3465 = XU-SPL-MGR "Spool Management"
 D SET1(3465,$C(49828,54400,32,44288,47532),.COUNT,.TOTAL)
 ;
 ; IEN 122 = XUSPY "Information Security Officer Menu"
 D SET1(122,$C(51221,48372,48372,50504,32,45812,45817,51088,32,47700,45684),.COUNT,.TOTAL)
 ;
 ; IEN 7880 = XTMENU "Application Utilities"
 D SET1(7880,$C(51025,50857,32,50976,54008,47532,54000),.COUNT,.TOTAL)
 ;
 ; IEN 7886 = XTCM MAIN "Capacity Planning"
 D SET1(7886,$C(50857,47049,32,44228,54925),.COUNT,.TOTAL)
 ;
 ; IEN 27 = XMMGR "Manage Mailman"
 D SET1(27,$C(47700,51068,44288,47532,51088,32,44288,47532),.COUNT,.TOTAL)
 ;
 ; IEN 8988 = XUTM MGR "Taskman Management"
 D SET1(8988,$C(53468,49828,53356,44288,47532,51088,32,44288,47532),.COUNT,.TOTAL)
 ;
 ; IEN 7169 = HL MAIN MENU "HL7 Main Menu"
 D SET1(7169,"HL7 "_$C(47700,51064,32,47700,45684),.COUNT,.TOTAL)
 ;
 ; Kill compiled menu cache so XQ rebuilds from updated MENU TEXT
 K ^XUTL("XQO",28)
 S ^ZVEMENU("active")="ko"
 S ^ZVEMENU("applied")=$H
 S ^ZVEMENU("count")=COUNT
 W !,"=== Applied: ",COUNT,"/",TOTAL," items ===",!
 W "  XQO cache cleared — menus will rebuild on next login.",!
 Q
 ;
SET1(IEN,KOTEXT,COUNT,TOTAL) ; Set one menu item Korean text
 ; Backs up MENU TEXT + U-node (idempotent: only backs up once)
 N CUR,UCUR
 S TOTAL=TOTAL+1
 I '$D(^DIC(19,IEN,0)) W "  SKIP: IEN ",IEN," not found",! Q
 S CUR=$P(^DIC(19,IEN,0),"^",2)
 S UCUR=$G(^DIC(19,IEN,"U"))
 ; Only back up if we haven't already (idempotent re-run)
 I '$D(^ZVEMENU("backup",IEN)) D
 . S ^ZVEMENU("backup",IEN)=CUR
 . S ^ZVEMENU("backup-u",IEN)=UCUR
 S $P(^DIC(19,IEN,0),"^",2)=KOTEXT
 ; Update U-node (uppercase Korean text for matching)
 S ^DIC(19,IEN,"U")=KOTEXT
 S COUNT=COUNT+1
 W "  ",IEN,": ",CUR," -> ",KOTEXT,!
 Q
 ;
RESTORE ; Restore English menu text from backup
 N IEN,ORIG,UORIG,COUNT
 S COUNT=0
 W "=== Restoring English menu text ===",!
 I '$D(^ZVEMENU("backup")) W "  No backup found -- nothing to restore.",! Q
 S IEN="" F  S IEN=$O(^ZVEMENU("backup",IEN)) Q:IEN=""  D
 . S ORIG=^ZVEMENU("backup",IEN)
 . S $P(^DIC(19,IEN,0),"^",2)=ORIG
 . ; Restore U-node if backup exists
 . I $D(^ZVEMENU("backup-u",IEN)) S ^DIC(19,IEN,"U")=^ZVEMENU("backup-u",IEN)
 . S COUNT=COUNT+1
 . W "  ",IEN,": restored -> ",ORIG,!
 K ^ZVEMENU("backup"),^ZVEMENU("backup-u")
 ; Kill compiled menu cache so XQ rebuilds with English text
 K ^XUTL("XQO",28)
 S ^ZVEMENU("active")=""
 K ^ZVEMENU("applied"),^ZVEMENU("count")
 W "=== Restored: ",COUNT," items ===",!
 W "  XQO cache cleared -- menus will rebuild on next login.",!
 Q
 ;
STATUS ; Show current menu text for EVE tree items
 N IEN,NAME,MTEXT,ACTIVE
 W "=== Korean Menu Status ===",!
 S ACTIVE=$G(^ZVEMENU("active"))
 W "  Active overlay: ",$S(ACTIVE="ko":"KOREAN",1:"NONE (English)"),!
 I $G(^ZVEMENU("count"))]"" W "  Items translated: ",^ZVEMENU("count"),!
 W !,"  EVE tree menu text:",!
 F IEN=28,29,18,30,37,8,38,96,3465,122,7880,7886,27,8988,7169 D
 . S NAME=$P($G(^DIC(19,IEN,0)),"^",1)
 . S MTEXT=$P($G(^DIC(19,IEN,0)),"^",2)
 . W "    ",IEN," [",NAME,"]: ",MTEXT
 . I $D(^ZVEMENU("backup",IEN)) W "  (en: ",^ZVEMENU("backup",IEN),")"
 . W !
 W "=== End Status ===",!
 Q
