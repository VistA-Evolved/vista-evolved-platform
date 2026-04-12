ZVEESMEN ; Spanish Menu Translation Overlay — EVE Tree (Level 3)
 ; Translates MENU TEXT (Field 1 / piece 2 of ^DIC(19,IEN,0))
 ; for the Systems Manager Menu (EVE) top-level items.
 ;
 ; Pattern: identical to ZVEKOMEN.m (Korean Level 3 pilot)
 ; Backup stored in ^ZVEMENU("backup",IEN). Fully reversible.
 ;
 ; Spanish accented chars used (YottaDB UTF-8 mode):
 ;   a-acute = $C(225)   e-acute = $C(233)   i-acute = $C(237)
 ;   o-acute = $C(243)   u-acute = $C(250)   n-tilde = $C(241)
 ;
 ; Usage:
 ;   D APPLY^ZVEESMEN      — Back up English + write Spanish text
 ;   D RESTORE^ZVEESMEN    — Restore English text from backup
 ;   D STATUS^ZVEESMEN     — Show current EVE tree menu text
 ;
EN ;
 D STATUS
 Q
 ;
APPLY ; Apply Spanish translations to EVE tree menu items
 N COUNT,TOTAL
 S COUNT=0,TOTAL=0
 W "=== Applying Spanish menu translations (EVE tree) ===",!
 ;
 ; --- Parent menu ---
 ; IEN 28 = EVE "Systems Manager Menu"
 ; Spanish: "Menu de Administracion del Sistema"
 D SET1(28,"Men"_$C(250)_" de Administraci"_$C(243)_"n del Sistema",.COUNT,.TOTAL)
 ;
 ; --- Child items ---
 ; IEN 29 = XUPROG "Programmer Options"
 ; Spanish: "Opciones de Programador"
 D SET1(29,"Opciones de Programador",.COUNT,.TOTAL)
 ;
 ; IEN 18 = DIUSER "VA FileMan"
 ; Spanish: "VA FileMan" (proper name preserved)
 D SET1(18,"VA FileMan",.COUNT,.TOTAL)
 ;
 ; IEN 30 = XUTIO "Device Management"
 ; Spanish: "Gestion de Dispositivos"
 D SET1(30,"Gesti"_$C(243)_"n de Dispositivos",.COUNT,.TOTAL)
 ;
 ; IEN 37 = XUSER "User Management"
 ; Spanish: "Gestion de Usuarios"
 D SET1(37,"Gesti"_$C(243)_"n de Usuarios",.COUNT,.TOTAL)
 ;
 ; IEN 8 = XUMAINT "Menu Management"
 ; Spanish: "Gestion de Menus"
 D SET1(8,"Gesti"_$C(243)_"n de Men"_$C(250)_"s",.COUNT,.TOTAL)
 ;
 ; IEN 38 = XUCORE "Core Applications"
 ; Spanish: "Aplicaciones Principales"
 D SET1(38,"Aplicaciones Principales",.COUNT,.TOTAL)
 ;
 ; IEN 96 = XUSITEMGR "Operations Management"
 ; Spanish: "Gestion de Operaciones"
 D SET1(96,"Gesti"_$C(243)_"n de Operaciones",.COUNT,.TOTAL)
 ;
 ; IEN 3465 = XU-SPL-MGR "Spool Management"
 ; Spanish: "Gestion de Cola de Impresion"
 D SET1(3465,"Gesti"_$C(243)_"n de Cola de Impresi"_$C(243)_"n",.COUNT,.TOTAL)
 ;
 ; IEN 122 = XUSPY "Information Security Officer Menu"
 ; Spanish: "Menu del Oficial de Seguridad Informatica"
 D SET1(122,"Men"_$C(250)_" del Oficial de Seguridad Inform"_$C(225)_"tica",.COUNT,.TOTAL)
 ;
 ; IEN 7880 = XTMENU "Application Utilities"
 ; Spanish: "Utilidades de Aplicaciones"
 D SET1(7880,"Utilidades de Aplicaciones",.COUNT,.TOTAL)
 ;
 ; IEN 7886 = XTCM MAIN "Capacity Planning"
 ; Spanish: "Planificacion de Capacidad"
 D SET1(7886,"Planificaci"_$C(243)_"n de Capacidad",.COUNT,.TOTAL)
 ;
 ; IEN 27 = XMMGR "Manage Mailman"
 ; Spanish: "Gestion de Correo"
 D SET1(27,"Gesti"_$C(243)_"n de Correo",.COUNT,.TOTAL)
 ;
 ; IEN 8988 = XUTM MGR "Taskman Management"
 ; Spanish: "Gestion de Taskman"
 D SET1(8988,"Gesti"_$C(243)_"n de Taskman",.COUNT,.TOTAL)
 ;
 ; IEN 7169 = HL MAIN MENU "HL7 Main Menu"
 ; Spanish: "Menu Principal HL7"
 D SET1(7169,"Men"_$C(250)_" Principal HL7",.COUNT,.TOTAL)
 ;
 ; Kill compiled menu cache so XQ rebuilds from updated MENU TEXT
 K ^XUTL("XQO",28)
 S ^ZVEMENU("active")="es"
 S ^ZVEMENU("applied")=$H
 S ^ZVEMENU("count")=COUNT
 W !,"=== Applied: ",COUNT,"/",TOTAL," items ===",!
 W "  XQO cache cleared — menus will rebuild on next login.",!
 Q
 ;
SET1(IEN,ESTEXT,COUNT,TOTAL) ; Set one menu item Spanish text
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
 S $P(^DIC(19,IEN,0),"^",2)=ESTEXT
 ; Update U-node (uppercase Spanish text for matching)
 S ^DIC(19,IEN,"U")=$$UC(ESTEXT)
 S COUNT=COUNT+1
 W "  ",IEN,": ",CUR," -> ",ESTEXT,!
 Q
 ;
UC(S) ; Uppercase helper for Spanish text
 ; Handles accented chars: a-acute->A-acute, e-acute->E-acute, etc.
 N R,I,C
 S R=""
 F I=1:1:$L(S) D
 . S C=$A($E(S,I))
 . ; Standard lowercase -> uppercase
 . I C>96,C<123 S R=R_$C(C-32) Q
 . ; Spanish accented lowercase -> uppercase
 . I C=225 S R=R_$C(193) Q  ; a-acute -> A-acute
 . I C=233 S R=R_$C(201) Q  ; e-acute -> E-acute
 . I C=237 S R=R_$C(205) Q  ; i-acute -> I-acute
 . I C=243 S R=R_$C(211) Q  ; o-acute -> O-acute
 . I C=250 S R=R_$C(218) Q  ; u-acute -> U-acute
 . I C=241 S R=R_$C(209) Q  ; n-tilde -> N-tilde
 . S R=R_$E(S,I)
 Q R
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
 W "=== Spanish Menu Status ===",!
 S ACTIVE=$G(^ZVEMENU("active"))
 W "  Active overlay: ",$S(ACTIVE="es":"SPANISH",ACTIVE="ko":"KOREAN",1:"NONE (English)"),!
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
