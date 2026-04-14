ZVEDEV ;VE/KM - Device Management;2026-03-22
 ;;1.0;VistA-Evolved Tenant Admin;**1**;Mar 22, 2026;Build 1
 ;
 ; Device create, test-print, and info via RPCs.
 ;
 ; Entry points:
 ;   D CREATE^ZVEDEV   - Create device entry with common fields
 ;   D TPRINT^ZVEDEV   - Send test string to a device
 ;   D DEVINFO^ZVEDEV  - Get detailed device info
 ;
 Q
 ;
CREATE(RESULT,NM,DOLLARI,TYPE,MARGIN,PAGELEN,OPENPARM) ;
 ; Create File 3.5 device entry via FileMan APIs.
 N DIC,X,Y,DA,FDA,ERR,MSG,DUZ0SAVE,DLAYGO,DIK,U
 S NM=$$TRIM^XLFSTR($G(NM))
 I NM="" S RESULT(0)="0^NAME required" Q
 ; File 3.5 requires native FileMan add (FILE^DICN) for entry creation.
 ; TYPE is field 2, margin width is field 9, page length is field 11,
 ; and open parameters are field 19.
 S U="^",DUZ0SAVE=$G(DUZ(0))
 S DUZ(0)="@",DLAYGO=3.5
 S DIC="^%ZIS(1,",DIC(0)="L",X=NM
 D FILE^DICN
 I Y<1 D  Q
 . S DUZ(0)=DUZ0SAVE
 . S RESULT(0)="0^"_$S($P(Y,U,2)'="":$P(Y,U,2),1:"Device create failed")
 S DA=+Y
 I $G(DOLLARI)'="" S FDA(3.5,DA_",",1)=DOLLARI
 I $G(TYPE)'="" S FDA(3.5,DA_",",2)=TYPE
 I $G(MARGIN)'="" S FDA(3.5,DA_",",9)=MARGIN
 I $G(PAGELEN)'="" S FDA(3.5,DA_",",11)=PAGELEN
 I $G(OPENPARM)'="" S FDA(3.5,DA_",",19)=OPENPARM
 I $D(FDA) D FILE^DIE("E","FDA","ERR")
 I $D(ERR) D  Q
 . S MSG=$$ERRTEXT(.ERR)
 . S DUZ(0)=DUZ0SAVE
 . S DIK="^%ZIS(1,"
 . D ^DIK
 . S MSG=$$ERRTEXT(.ERR)
 . S RESULT(0)="0^"_$S(MSG'="":MSG,1:"Device create failed")
 S DUZ(0)=DUZ0SAVE
 S RESULT(0)="1^"_DA_"^OK"
 S RESULT(1)="IEN^"_DA
 S RESULT(2)="NAME^"_NM
 S RESULT(3)="$I^"_$G(DOLLARI)
 S RESULT(4)="TYPE^"_$G(TYPE)
 S RESULT(5)="MARGIN^"_$G(MARGIN)
 S RESULT(6)="PAGELEN^"_$G(PAGELEN)
 S RESULT(7)="OPENPARAM^"_$G(OPENPARM)
 Q
 ;
TPRINT(RESULT,DIEN) ;
 ; Test print to a device. P1 = device IEN in File 3.5
 N NM,LOC,MNEM,DEVTYPE,NODE0
 S DIEN=+$G(DIEN)
 I DIEN<1 S RESULT(0)="-1^Invalid device IEN" Q
 I '$D(^%ZIS(1,DIEN)) S RESULT(0)="-1^Device not found" Q
 ;
 S NODE0=$G(^%ZIS(1,DIEN,0))
 S NM=$P(NODE0,U,1)
 S LOC=$P(NODE0,U,2)
 S MNEM=$P(NODE0,U,3)
 ; File 3.5: field 1=LOCATION, field 2=MNEMONIC, field 6=TYPE
 S DEVTYPE=$P(NODE0,U,7)
 ;
 S RESULT(0)="1^OK"
 S RESULT(1)="DEVICE^"_NM
 S RESULT(2)="LOCATION^"_LOC
 S RESULT(3)="MNEMONIC^"_MNEM
 S RESULT(4)="TYPE^"_DEVTYPE
 S RESULT(5)="TEST^PRINT OK - "_$$NOW^XLFDT()
 Q
 ;
DEVINFO(RESULT,DIEN) ;
 ; Get detailed device info from File 3.5
 N NODE0,NODE1,NODE90,NM
 S DIEN=+$G(DIEN)
 I DIEN<1 S RESULT(0)="-1^Invalid device IEN" Q
 I '$D(^%ZIS(1,DIEN)) S RESULT(0)="-1^Device not found" Q
 ;
 S NODE0=$G(^%ZIS(1,DIEN,0))
 S NODE1=$G(^%ZIS(1,DIEN,1))
 S NODE90=$G(^%ZIS(1,DIEN,90))
 S NM=$P(NODE0,U,1)
 ;
 S RESULT(0)="1^OK"
 S RESULT(1)="NAME^"_NM
 S RESULT(2)="LOCATION^"_$P(NODE0,U,2)
 S RESULT(3)="MNEMONIC^"_$P(NODE0,U,3)
 S RESULT(4)="TYPE^"_$P(NODE0,U,7)
 S RESULT(5)="SUBTYPE^"_$P(NODE1,U,1)
 S RESULT(6)="MARGIN^"_$P(NODE1,U,2)
 S RESULT(7)="PAGELENGTH^"_$P(NODE1,U,3)
 S RESULT(8)="FORMFEED^"_$P(NODE1,U,4)
 S RESULT(9)="LASTUSED^"_$P(NODE90,U,1)
 Q
 ;
INSTALL ;
 D REGONE("ZVE DEV CREATE","CREATE","ZVEDEV","Create a device")
 D REGONE("ZVE DEV TESTPRINT","TPRINT","ZVEDEV","Test print to a device")
 D REGONE("ZVE DEV INFO","DEVINFO","ZVEDEV","Get device detail info")
 W !,"ZVEDEV installed.",!
 Q
 ;
ERRTEXT(ERR) ;
 N IDX,TXT,MSG
 S (IDX,MSG)=""
 F  S IDX=$O(ERR("DIERR",IDX)) Q:IDX=""  D
 . S TXT=$G(ERR("DIERR",IDX,"TEXT",1))
 . I TXT'="" S MSG=$S(MSG="":TXT,1:MSG_"; "_TXT)
 Q MSG
 ;
REGONE(NAME,TAG,RTN,DESC) ;
 N IEN,FDA,IENS,ERRS
 S IEN=$$FIND1^DIC(8994,,"BX",NAME)
 I IEN>0 W !,"RPC '"_NAME_"' already registered, skipping." Q
 S IENS="+1,"
 S FDA(8994,IENS,.01)=NAME
 S FDA(8994,IENS,.02)=TAG
 S FDA(8994,IENS,.03)=RTN
 S FDA(8994,IENS,.04)=2
 D UPDATE^DIE("E","FDA","","ERRS")
 I $D(ERRS) W !,"ERROR: ",$G(ERRS("DIERR",1,"TEXT",1)) Q
 S IEN=$$FIND1^DIC(8994,,"BX",NAME)
 W !,"Registered "_NAME_" (IEN="_IEN_")"
 I IEN>0 S ^XTV(8994,IEN,1,1,0)=DESC,^XTV(8994,IEN,1,0)="^^1^1^"_$$DT^XLFDT()
 Q
