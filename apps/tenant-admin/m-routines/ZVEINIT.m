ZVEINIT ; Local terminal/runtime initialization
 ; Idempotent startup polish for the local browser terminal lane.
 ; Safe to run on every boot.
 ;
EN ;
 S U="^"
 D VOLUME
 D KSPSITE
 D SIGNON
 D TERMDEV
 D INTRO
 D PROMPT
 D DIALOG
 D LANGPACK
 Q
 ;
VOLUME ; Ensure the current volume has a usable Kernel volume entry.
 N volumeKey,volumeIEN,lastIEN,count,volumeNode
 S volumeKey=$G(^%ZOSF("VOL"))
 Q:volumeKey=""
 S volumeIEN=+$O(^XTV(8989.3,1,4,"B",volumeKey,0))
 I 'volumeIEN D
 . S lastIEN=+$P($G(^XTV(8989.3,1,4,0)),U,3)
 . S count=+$P($G(^XTV(8989.3,1,4,0)),U,4)
 . S volumeIEN=$S(lastIEN>0:lastIEN+1,1:1)
 . S ^XTV(8989.3,1,4,0)="^8989.304A^"_volumeIEN_U_(count+1)
 S volumeNode=$G(^XTV(8989.3,1,4,volumeIEN,0))
 S $P(volumeNode,U)=volumeKey
 I $P(volumeNode,U,2)="" S $P(volumeNode,U,2)="y"
 I +$P(volumeNode,U,3)<30 S $P(volumeNode,U,3)=30
 S ^XTV(8989.3,1,4,volumeIEN,0)=volumeNode
 S ^XTV(8989.3,1,4,"B",volumeKey,volumeIEN)=""
 Q
 ;
TERMDEV ; Ensure a minimal terminal type and home device mapping for the current principal.
 N currentDevice
 S U="^"
 S currentDevice=$I
 D ENSUREDEV(0)
 I $G(currentDevice)'="",$G(currentDevice)'=0 D ENSUREDEV(currentDevice)
 Q
 ;
ENSURETYPE() ; Ensure P-OTHER exists in file 3.2 and return its IEN.
 N subtypeIEN,lastIEN,count
 S subtypeIEN=+$O(^%ZIS(2,"B","P-OTHER",0))
 I subtypeIEN Q subtypeIEN
 S lastIEN=+$P($G(^%ZIS(2,0)),U,3)
 S count=+$P($G(^%ZIS(2,0)),U,4)
 S subtypeIEN=$S(lastIEN>0:lastIEN+1,1:1)
 S ^%ZIS(2,subtypeIEN,0)="P-OTHER"
 S ^%ZIS(2,subtypeIEN,1)="^#^24^*8^^80"
 S ^%ZIS(2,"B","P-OTHER",subtypeIEN)=""
 S ^%ZIS(2,0)="TERMINAL TYPE^3.2I^"_subtypeIEN_U_(count+1)
 Q subtypeIEN
 ;
ENSUREDEV(deviceValue) ; Ensure file 3.5 contains a usable home-device entry for the device value.
 N subtypeIEN,deviceIEN,lastIEN,count,deviceName,location,volumeKey
 S subtypeIEN=$$ENSURETYPE()
 S deviceName=$S(deviceValue=0:"SLAVE DEVICE",1:"TERMINAL "_deviceValue)
 S location=$S(deviceValue=0:"SLAVE",1:deviceValue)
 S deviceIEN=+$O(^%ZIS(1,"C",deviceValue,0))
 I 'deviceIEN D
 . S lastIEN=+$P($G(^%ZIS(1,0)),U,3)
 . S count=+$P($G(^%ZIS(1,0)),U,4)
 . S deviceIEN=$S(lastIEN>0:lastIEN+1,1:1)
 . S ^%ZIS(1,"B",deviceName,deviceIEN)=""
 . S ^%ZIS(1,0)="DEVICE^3.5I^"_deviceIEN_U_(count+1)
 S ^%ZIS(1,deviceIEN,0)=deviceName_U_location_U_deviceValue_U_"TERMINAL"_U_1
 S ^%ZIS(1,deviceIEN,"SUBTYPE")=subtypeIEN
 S ^%ZIS(1,deviceIEN,"TYPE")="TRM"
 S ^%ZIS(1,deviceIEN,1.95)=1
 S ^%ZIS(1,"B",deviceName,deviceIEN)=""
 S ^%ZIS(1,"C",deviceValue,deviceIEN)=""
 S volumeKey=$G(^%ZOSF("VOL"))
 S ^%ZIS(1,"G","SYS."_volumeKey_"."_deviceValue,deviceIEN)=""
 S ^%ZIS(1,"G","SYS.."_deviceValue,deviceIEN)=""
 Q
 ;
INTRO ; Replace generic imported banner with deliberate local text.
 K ^XTV(8989.3,1,"INTRO")
 S ^XTV(8989.3,1,"INTRO",0)="^^2^2^3240101"
 S ^XTV(8989.3,1,"INTRO",1,0)="VistA Evolved Local Sandbox"
 S ^XTV(8989.3,1,"INTRO",2,0)="YottaDB-backed terminal runtime"
 Q
 ;
PROMPT ; Replace the hard-coded <TEST ACCOUNT> label with an explicit sandbox prompt.
 N ERR
 D EN^XPAR("SYS","XQ MENUMANAGER PROMPT",1," <LOCAL SANDBOX>",.ERR)
 Q
 ;
KSPSITE ; Seed Kernel System Parameters (file 8989.3) site record if missing.
 ; Required so DUZ^XUS1A, XOPT^XUS1A, and other Kernel routines don't crash
 ; on bare ^XTV(8989.3,...) references.
 I $G(^XTV(8989.3,0))="" S ^XTV(8989.3,0)="KERNEL SYSTEM PARAMETERS^8989.3I^1^1"
 I $G(^XTV(8989.3,1,0))="" D
 . N sysid S sysid=$G(^%ZOSF("VOL"),"LOCAL")
 . ; Minimal site record: piece 1=station#, piece 7=language, piece 8=agency code
 . S ^XTV(8989.3,1,0)="27^"_sysid_"^"_sysid_"^^^^1^V"
 I $G(^XTV(8989.3,1,"XUS"))="" D
 . ; Defaults matching Kernel XOPT fill: piece order per SET1^XUS default string
 . ; Piece 5 = 0 (disable "Ask Device") — terminal type is seeded by TERMTYPE below.
 . ; Avoids TT^XUS3 prompt that blocks PTY logins when ENQ DA response confuses ^DIC.
 . S ^XTV(8989.3,1,"XUS")="^5^600^1^0^0^^^Y^300^^^^^90^^1^d"
 ; Also force piece 5=0 if it was already seeded with 1
 I $P($G(^XTV(8989.3,1,"XUS")),"^",5)=1 S $P(^XTV(8989.3,1,"XUS"),"^",5)=0
 ; Set site language from VISTA_SITE_LANG env var (operator-deterministic).
 ; Empty/unset/"en" = English (clear piece 7).
 ; "ko" = Korean (198), "es" = Spanish (3), etc.
 N LANGCODE,LANGIEN
 S LANGCODE=$ZTRNLNM("VISTA_SITE_LANG")
 I LANGCODE]"",LANGCODE'="en" D
 . S LANGIEN=$$IEN^ZVELPACK(LANGCODE)
 . I LANGIEN S $P(^XTV(8989.3,1,"XUS"),"^",7)=LANGIEN
 . E  S $P(^XTV(8989.3,1,"XUS"),"^",7)=""
 E  S $P(^XTV(8989.3,1,"XUS"),"^",7)=""
 D TERMTYPE
 Q
 ;
SIGNON ; Seed the sign-on log root (file 3.081) if missing.
 ; Required so SLOG^XUS1 does not GVUNDEF on ^XUSEC(0,0).
 I $G(^XUSEC(0,0))="" S ^XUSEC(0,0)="SIGN-ON LOG^3.081P^^0"
 ; Seed Mail Group file root (file 3.8) if missing.
 I $G(^XMB(3.8,0))="" S ^XMB(3.8,0)="MAIL GROUP^3.8^0^0"
 Q
 ;
TERMTYPE ; Seed C-VT100 terminal type (file 3.2) so ENQ and TT^XUS3 resolve.
 ; TT^XUS3 screen: $P(^(0),U,2) — requires piece 2 (right margin) set.
 ; Also set user 65 terminal type so ENQ fallback populates XUIOP.
 N vtIEN
 S vtIEN=+$O(^%ZIS(2,"B","C-VT100",0))
 I 'vtIEN D
 . N lastIEN,count
 . S lastIEN=+$P($G(^%ZIS(2,0)),"^",3)
 . S count=+$P($G(^%ZIS(2,0)),"^",4)
 . S vtIEN=$S(lastIEN>0:lastIEN+1,1:1)
 . S ^%ZIS(2,vtIEN,0)="C-VT100^80^#^24"
 . S ^%ZIS(2,vtIEN,1)="^#^24^*8^^80"
 . S ^%ZIS(2,"B","C-VT100",vtIEN)=""
 . S ^%ZIS(2,0)="TERMINAL TYPE^3.2I^"_vtIEN_"^"_(count+1)
 ; Fix P-OTHER: ensure piece 2 (right margin) is set so TT screen passes
 N poIEN S poIEN=+$O(^%ZIS(2,"B","P-OTHER",0))
 I poIEN,$P($G(^%ZIS(2,poIEN,0)),"^",2)="" S $P(^%ZIS(2,poIEN,0),"^",2)=80
 ; Set user 65 terminal type to C-VT100
 I $G(^VA(200,65,1.2))="" S ^VA(200,65,1.2)=vtIEN
 Q
 ;
DIALOG ; Seed Dialog file (.84) entries required by the OSE/SMH XQ Menu Manager.
 ; XQ.m M1 label uses $$EZBLD^DIALOG(19001,...) and $$EZBLD^DIALOG(19002,...)
 ; to build the "Select ... Option: " prompt. If these entries are missing,
 ; the prompt is invisible and the user sees a blank line after login.
 ; Idempotent: only seeds if node 0 is empty.
 ;
 ; Entry 19002: normal prompt — "|1|Select |2| Option: "
 ;   |1| = DUZ("TEST") (usually empty), |2| = menu name
 I $G(^DI(.84,19002,0))="" D
 . S ^DI(.84,19002,0)="XQ MENU PROMPT^2^y"
 . S ^DI(.84,19002,2,0)="^^1^1"
 . S ^DI(.84,19002,2,1,0)="|1|Select |2| Option: "
 ;
 ; Entry 19001: testing-another's-menus prompt — "|1|Select |2|'s |3| Option: "
 ;   |1| = DUZ("TEST"), |2| = person name, |3| = menu name
 I $G(^DI(.84,19001,0))="" D
 . S ^DI(.84,19001,0)="XQ MENU PROMPT SAV^2^y"
 . S ^DI(.84,19001,2,0)="^^1^1"
 . S ^DI(.84,19001,2,1,0)="|1|Select |2|'s |3| Option: "
 ;
 ; Update header count if needed
 N hdr S hdr=$G(^DI(.84,0))
 I hdr="" S ^DI(.84,0)="DIALOG^.84I^19002^2"
 E  I +$P(hdr,"^",3)<19002 S $P(^DI(.84,0),"^",3)=19002
 Q
 ;
LANGPACK ; Load language pack data (formatting nodes + dialog translations).
 ; Idempotent. Runs on every boot. Data loads only — does not change
 ; which language is active (that is KSPSITE's job via VISTA_SITE_LANG).
 I $T(LOAD^ZVELPACK)]"" D
 . D LOAD^ZVELPACK("ko")
 . D LOAD^ZVELPACK("es")
 Q
