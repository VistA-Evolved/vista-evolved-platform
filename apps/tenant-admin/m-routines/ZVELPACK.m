ZVELPACK ; Language Pack Installer/Verifier
 ; Loads language-pack formatting nodes and dialog translations into VistA.
 ;
 ; Usage:
 ;   D LOAD^ZVELPACK("ko")    — Load Korean pack
 ;   D LOAD^ZVELPACK("es")    — Load Spanish pack
 ;   D VERIFY^ZVELPACK("ko")  — Verify Korean pack is loaded
 ;   D SETLANG^ZVELPACK(198)  — Set site default to Korean
 ;   D SETUSER^ZVELPACK(1,3)  — Set user DUZ=1 to Spanish
 ;   D STATUS^ZVELPACK        — Show current language status
 ;
EN ;
 D STATUS
 Q
 ;
BOOT ; Boot-time language pack loading + site language from env var.
 ; Called by entrypoint.sh on every container start. Idempotent.
 ; Loads all known packs then applies VISTA_SITE_LANG env var.
 S U="^"
 D LOAD("ko")
 D LOAD("es")
 N LANGCODE,LANGIEN
 S LANGCODE=$ZTRNLNM("VISTA_SITE_LANG")
 I LANGCODE]"",LANGCODE'="en" D
 . S LANGIEN=$$IEN(LANGCODE)
 . I LANGIEN S $P(^XTV(8989.3,1,"XUS"),"^",7)=LANGIEN W "Site language: ",LANGCODE," (IEN ",LANGIEN,")",!
 . E  W "Unknown VISTA_SITE_LANG: ",LANGCODE,!
 E  D
 . S $P(^XTV(8989.3,1,"XUS"),"^",7)=""
 . W "Site language: ENGLISH (default)",!
 ;
 ; Level 3 — Menu translations (apply or restore based on site language)
 ; Only one language overlay can be active at a time on the EVE tree.
 ; If switching language, restore previous overlay first, then apply new.
 ;
 N CURACTIVE S CURACTIVE=$G(^ZVEMENU("active"))
 ;
 ; --- Korean site language ---
 I LANGCODE="ko" D  Q
 . ; Restore Spanish if it was active
 . I CURACTIVE="es",$T(RESTORE^ZVEESMEN)]"" D RESTORE^ZVEESMEN
 . ; Apply Korean
 . I $T(APPLY^ZVEKOMEN)]"" D APPLY^ZVEKOMEN
 ;
 ; --- Spanish site language ---
 I LANGCODE="es" D  Q
 . ; Restore Korean if it was active
 . I CURACTIVE="ko",$T(RESTORE^ZVEKOMEN)]"" D RESTORE^ZVEKOMEN
 . ; Apply Spanish
 . I $T(APPLY^ZVEESMEN)]"" D APPLY^ZVEESMEN
 ;
 ; --- English or other: restore any active overlay ---
 I CURACTIVE="ko",$T(RESTORE^ZVEKOMEN)]"" D RESTORE^ZVEKOMEN
 I CURACTIVE="es",$T(RESTORE^ZVEESMEN)]"" D RESTORE^ZVEESMEN
 Q
 ;
LOAD(PACK) ; Load a language pack by ISO-2 code
 ; PACK = "ko", "es", etc.
 N RTN
 I PACK="" W "Error: pack code required (e.g., ""ko"", ""es"")",! Q
 ;
 W "=== Loading language pack: ",PACK," ===",!
 ;
 ; Load formatting nodes
 S RTN="EN^ZVE"_$$UC(PACK)_"FMT"
 I $T(@RTN)]"" D
 . W "Loading formatting nodes...",!
 . D @RTN
 E  W "  WARNING: Formatting routine "_RTN_" not found.",!
 ;
 ; Load dialog translations
 S RTN="EN^ZVE"_$$UC(PACK)_"DLG"
 I $T(@RTN)]"" D
 . W "Loading dialog translations...",!
 . D @RTN
 E  W "  WARNING: Dialog routine "_RTN_" not found.",!
 ;
 W "=== Pack ",PACK," load complete ===",!
 Q
 ;
VERIFY(PACK) ; Verify a language pack is loaded correctly
 N IEN,NODES,DLGS,X,DX,LANG
 I PACK="" W "Error: pack code required",! Q
 ;
 ; Map pack code to language IEN
 S IEN=$$IEN(PACK)
 I 'IEN W "Error: unknown pack code: ",PACK,! Q
 ;
 W "=== Verifying language pack: ",PACK," (IEN ",IEN,") ===",!
 ;
 ; Check LANGUAGE file header node
 I $G(^DI(.85,IEN,0))="" D
 . W "  FAIL: Language IEN ",IEN," not in LANGUAGE file (.85)",!
 E  W "  PASS: Language entry exists: ",$P(^DI(.85,IEN,0),"^"),!
 ;
 ; Check formatting nodes
 S NODES=0
 F X="DD","FMTE","CRD","LC","UC","ORD","TIME","20.2" D
 . I $D(^DI(.85,IEN,X))#2 S NODES=NODES+1 W "  PASS: Formatting node [",X,"]",!
 . E  W "  SKIP: No [",X,"] node",!
 W "  Formatting nodes present: ",NODES,!
 ;
 ; Check dialog translations
 S DLGS=0,DX=0
 F  S DX=$O(^DI(.84,DX)) Q:DX=""  D
 . I $D(^DI(.84,DX,4,IEN)) S DLGS=DLGS+1
 W "  Dialog translations present: ",DLGS,!
 ;
 ; Check B-index
 S LANG=$P($G(^DI(.85,IEN,0)),"^")
 I LANG]"",$D(^DI(.85,"B",LANG,IEN)) W "  PASS: B-index entry exists",!
 E  W "  WARN: B-index entry missing for ",LANG,!
 ;
 W "=== Verification complete ===",!
 Q
 ;
SETLANG(IEN) ; Set site-wide default language
 ; IEN = language IEN (198=Korean, 3=Spanish, ""=English)
 N NAME
 I IEN]"",'$D(^DI(.85,IEN,0)) W "Error: IEN ",IEN," not in LANGUAGE file",! Q
 S NAME=$S(IEN]"":$P($G(^DI(.85,IEN,0)),"^"),1:"ENGLISH (default)")
 S $P(^XTV(8989.3,1,"XUS"),"^",7)=$S(IEN]"":IEN,1:"")
 W "Site default language set to: ",NAME," (IEN=",IEN,")",!
 W "All new logins will use this language.",!
 Q
 ;
SETUSER(DUZ2,IEN) ; Set per-user language preference
 ; DUZ2 = user IEN in file 200, IEN = language IEN
 N NAME
 I '$D(^VA(200,DUZ2,0)) W "Error: user ",DUZ2," not in NEW PERSON file",! Q
 I IEN]"",'$D(^DI(.85,IEN,0)) W "Error: IEN ",IEN," not in LANGUAGE file",! Q
 S NAME=$S(IEN]"":$P($G(^DI(.85,IEN,0)),"^"),1:"(site default)")
 S $P(^VA(200,DUZ2,200),"^",7)=$S(IEN]"":IEN,1:"")
 W "User ",$P($G(^VA(200,DUZ2,0)),"^")," language set to: ",NAME,!
 Q
 ;
STATUS ; Show current language configuration
 N SITELANG,SITENAME,U1LANG,U1NAME
 S U="^"
 W "=== Language Pack Status ===",!
 ;
 ; Site default
 S SITELANG=$P($G(^XTV(8989.3,1,"XUS")),U,7)
 S SITENAME=$S(SITELANG]"":$P($G(^DI(.85,SITELANG,0)),U),1:"ENGLISH (default)")
 W "  Site default: ",SITENAME," (KSP p7=",SITELANG,")",!
 ;
 ; User 1 (PROGRAMMER,ONE)
 S U1LANG=$P($G(^VA(200,1,200)),U,7)
 S U1NAME=$S(U1LANG]"":$P($G(^DI(.85,U1LANG,0)),U),1:"(follows site)")
 W "  User 1 (PROGRAMMER,ONE): ",U1NAME," (p7=",U1LANG,")",!
 ;
 ; Installed packs
 W "  Installed packs:",!
 D PACKSTATUS(198,"ko","Korean")
 D PACKSTATUS(3,"es","Spanish")
 D PACKSTATUS(2,"de","German")
 ;
 W "=== End Status ===",!
 Q
 ;
PACKSTATUS(IEN,CODE,NAME) ; Report status of one language pack
 N FMTNODES,DLGS,DX,X
 S FMTNODES=0,DLGS=0
 F X="DD","FMTE","CRD","LC","UC","ORD","TIME" D
 . I $D(^DI(.85,IEN,X))#2 S FMTNODES=FMTNODES+1
 S DX=0 F  S DX=$O(^DI(.84,DX)) Q:DX=""  I $D(^DI(.84,DX,4,IEN)) S DLGS=DLGS+1
 W "    ",CODE," (",NAME,"): fmt=",FMTNODES,"/7 dlg=",DLGS,!
 Q
 ;
IEN(PACK) ; Map ISO-2 code to language IEN
 N RESULT
 ; Check known packs first
 S RESULT=$S(PACK="ko":198,PACK="es":3,PACK="de":2,PACK="fr":4,PACK="fi":5,PACK="tl":475,PACK="vi":514,1:0)
 ; If unknown, scan LANGUAGE file by ISO-2 code
 I 'RESULT D
 . N LI S LI=0
 . F  S LI=$O(^DI(.85,LI)) Q:LI=""  D  Q:RESULT
 .. I $TR($P($G(^DI(.85,LI,0)),"^",2),"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz")=PACK S RESULT=LI
 Q RESULT
 ;
UC(S) ; Uppercase helper
 Q $TR(S,"abcdefghijklmnopqrstuvwxyz","ABCDEFGHIJKLMNOPQRSTUVWXYZ")
