ZVECREUSER ; Create demo users for VistA sign-on
 ; Pattern: WorldVistA wvDemopi.m (Sam Habiel)
 ; Uses $$EN^XUSHSH for hashing (SHA), UPDATE^DIE for filing
 ;
 S U="^"
 S DUZ=1 D DUZ^XUP(DUZ)
 ;
 W "Creating demo user...",!
 W "PROVIDER,CLYDE WV -> ",$$PROV(),!
 W "Done. Credentials:",!
 W "  ACCESS CODE:  PROV123",!
 W "  VERIFY CODE:  PROV123!!",!
 H
 ;
PROV() ; Create demo provider
 N NAME S NAME="PROVIDER,CLYDE WV"
 ; Skip if already exists
 Q:$O(^VA(200,"B",NAME,0)) $O(^(0))
 ;
 N C0XFDA,C0XIEN,C0XERR,DIERR
 S C0XFDA(200,"+1,",.01)=NAME
 S C0XFDA(200,"+1,",1)="CWP"
 S C0XFDA(200,"+1,",28)=100
 ;
 ; Access / Verify codes - pre-hashed with XUSHSH
 S C0XFDA(200,"+1,",2)=$$EN^XUSHSH("PROV123")
 S C0XFDA(200,"+1,",11)=$$EN^XUSHSH("PROV123!!")
 S C0XFDA(200,"+1,",7.2)=1
 ;
 ; Electronic Signature (input transform hashes this)
 S C0XFDA(200,"+1,",20.4)="123456"
 ;
 ; Primary Menu = EVE (system manager)
 N PRIMENU S PRIMENU=+$O(^DIC(19,"B","EVE",0))
 I PRIMENU>0 S C0XFDA(200,"+1,",201)="`"_PRIMENU
 ;
 ; Restrict Patient Selection
 S C0XFDA(200,"+1,",101.01)="NO"
 ;
 N DIC S DIC(0)=""
 D UPDATE^DIE("E",$NA(C0XFDA),$NA(C0XIEN),$NA(C0XERR))
 I $D(DIERR) W "DIERR: ",! D ^%ZTER Q ""
 I '$G(C0XIEN(1)) S C0XIEN(1)=+$O(^VA(200,"B",NAME,0))
 I '$G(C0XIEN(1)) S C0XIEN(1)=$$RAWPROV(NAME)
 I '$G(C0XIEN(1)) W "Unable to resolve new user IEN",! Q ""
 ;
 ; Fix verify code change date to far future
 N FDA
 S FDA(200,C0XIEN(1)_",",11.2)=$$FMTH^XLFDT($$FMADD^XLFDT(DT,3000))
 D FILE^DIE(,$NA(FDA))
 S ^XUSEC("XUPROGMODE",C0XIEN(1))=""
 ;
 Q C0XIEN(1)
 ;
RAWPROV(NAME) ; Raw fallback for empty local demo lanes where FileMan create does not materialize file 200.
 N IEN,lastIEN,count,now,future
 S IEN=65
 I $D(^VA(200,IEN,0)) Q IEN
 S lastIEN=+$P($G(^VA(200,0)),U,3)
 S count=+$P($G(^VA(200,0)),U,4)
 S ^VA(200,0)="NEW PERSON^200Is^"_$S(lastIEN>IEN:lastIEN,1:IEN)_U_(count+1)
 S ^VA(200,IEN,0)=NAME_"^CWP^PROV123^^^^^1"
 S ^VA(200,IEN,.1)="70642,0^PROV123!!"
 S now=$$NOW^XLFDT(),future=$$FMADD^XLFDT(DT,3000)
 S ^VA(200,IEN,1.1)=now_"^0^0^"_future_"^"
 N EVE S EVE=+$O(^DIC(19,"B","EVE",0)) S:EVE<1 EVE=28
 S ^VA(200,IEN,201)=EVE
 S ^VA(200,"B",NAME,IEN)=""
 S ^VA(200,"A",$$EN^XUSHSH("PROV123"),IEN)=""
 S ^XUSEC("XUPROGMODE",IEN)=""
 Q IEN
