ZVESITEV ; VE — Site Workspace Visibility & Custom Roles RPCs ; Jun 2026
 ;;1.0;VISTA EVOLVED;**1**;Jun 2026;Build 1
 ;
 ; RPCs in this routine:
 ;   ZVE SITE WS GET    - Get workspace visibility for a division
 ;   ZVE SITE WS SET    - Set workspace visibility for a division
 ;   ZVE ROLE CUSTOM LIST - List custom roles
 ;   ZVE ROLE CUSTOM CRT  - Create a custom role
 ;   ZVE ROLE CUSTOM UPD  - Update a custom role
 ;   ZVE ROLE CUSTOM DEL  - Delete a custom role
 ;
 ; Storage:
 ;   ^XTMP("ZVEWS",divisionIen,workspace)=1/0
 ;   ^XTMP("ZVECR",roleId,0)=name^description^createdDate
 ;   ^XTMP("ZVECR",roleId,"KEYS",n)=keyName
 ;
 Q  ; No direct entry
 ;
INSTALL ;
 W !,"=== Installing ZVESITEV RPCs ==="
 D REGONE^ZVEADMIN("ZVE SITE WS GET","WSGET","ZVESITEV","Get workspace visibility")
 D REGONE^ZVEADMIN("ZVE SITE WS SET","WSSET","ZVESITEV","Set workspace visibility")
 D REGONE^ZVEADMIN("ZVE ROLE CUSTOM LIST","CRLIST","ZVESITEV","List custom roles")
 D REGONE^ZVEADMIN("ZVE ROLE CUSTOM CRT","CRCRT","ZVESITEV","Create custom role")
 D REGONE^ZVEADMIN("ZVE ROLE CUSTOM UPD","CRUPD","ZVESITEV","Update custom role")
 D REGONE^ZVEADMIN("ZVE ROLE CUSTOM DEL","CRDEL","ZVESITEV","Delete custom role")
 ; Set XTMP expiration far in future (stored config, not temp data)
 I '$D(^XTMP("ZVEWS",0)) S ^XTMP("ZVEWS",0)=$$FMADD^XLFDT($$NOW^XLFDT,3650)_U_$$NOW^XLFDT_U_"VE Workspace Visibility"
 I '$D(^XTMP("ZVECR",0)) S ^XTMP("ZVECR",0)=$$FMADD^XLFDT($$NOW^XLFDT,3650)_U_$$NOW^XLFDT_U_"VE Custom Roles"
 W !,"=== ZVESITEV install complete ==="
 Q
 ;
 ; ============================================================
 ; ZVE SITE WS GET — Get workspace visibility for a division
 ; ============================================================
 ; Params: DIVIEN
 ; Output:
 ;   "1^COUNT^OK"
 ;   Per-workspace: "workspace^enabled" (1 or 0)
 ; ============================================================
WSGET(R,DIVIEN) ;
 S DIVIEN=+$G(DIVIEN)
 I 'DIVIEN D  Q
 . N CNT,WS,DEFS
 . S DEFS="Dashboard^Patients^Scheduling^Clinical^Pharmacy^Lab^Imaging^Billing^Supply^Admin^Analytics"
 . S CNT=0
 . N I F I=1:1:11 S WS=$P(DEFS,U,I) Q:WS=""  S CNT=CNT+1,R(CNT)=WS_U_1
 . S R(0)="1^"_CNT_"^OK"
 ;
 N CNT,WS
 S CNT=0
 S WS="" F  S WS=$O(^XTMP("ZVEWS",DIVIEN,WS)) Q:WS=""  D
 . S CNT=CNT+1,R(CNT)=WS_U_+$G(^XTMP("ZVEWS",DIVIEN,WS))
 ;
 S R(0)="1^"_CNT_"^OK"
 Q
 ;
 ; ============================================================
 ; ZVE SITE WS SET — Set workspace visibility for a division
 ; ============================================================
 ; Params: DIVIEN, WORKSPACE, ENABLED (1 or 0)
 ; Output: "1^SET^workspace^enabled"
 ; ============================================================
WSSET(R,DIVIEN,WORKSPACE,ENABLED) ;
 S DIVIEN=+$G(DIVIEN)
 I 'DIVIEN S R(0)="0^Division IEN required" Q
 S WORKSPACE=$G(WORKSPACE)
 I WORKSPACE="" S R(0)="0^Workspace name required" Q
 S ENABLED=+$G(ENABLED)
 ;
 S ^XTMP("ZVEWS",DIVIEN,WORKSPACE)=ENABLED
 D AUDITLOG^ZVEADMIN("WS-VIS",DIVIEN,WORKSPACE_"="_ENABLED)
 S R(0)="1^SET^"_WORKSPACE_"^"_ENABLED
 Q
 ;
 ; ============================================================
 ; ZVE ROLE CUSTOM LIST — List all custom roles
 ; ============================================================
 ; Output:
 ;   "1^COUNT^OK"
 ;   Per-role: "id^name^description^keyCount"
 ; ============================================================
CRLIST(R) ;
 N CNT,ID,NM,DESC,KCNT,KNAMES
 S CNT=0
 S ID="" F  S ID=$O(^XTMP("ZVECR",ID)) Q:ID=""  D
 . I ID=0 Q
 . S NM=$P($G(^XTMP("ZVECR",ID,0)),U,1)
 . S DESC=$P($G(^XTMP("ZVECR",ID,0)),U,2)
 . S KCNT=0,KNAMES="" N K S K="" F  S K=$O(^XTMP("ZVECR",ID,"KEYS",K)) Q:K=""  D
 . . S KCNT=KCNT+1
 . . N KN S KN=$G(^XTMP("ZVECR",ID,"KEYS",K))
 . . I KN]"" S KNAMES=KNAMES_$S(KNAMES="":"",1:";")_KN
 . S CNT=CNT+1,R(CNT)=ID_U_NM_U_DESC_U_KCNT_U_KNAMES
 ;
 S R(0)="1^"_CNT_"^OK"
 Q
 ;
 ; ============================================================
 ; ZVE ROLE CUSTOM CRT — Create a custom role
 ; ============================================================
 ; Params: NAME, DESCRIPTION, KEYS (^-delimited key list)
 ; Output: "1^CREATED^roleId^name"
 ; ============================================================
CRCRT(R,NAME,DESCRIPTION,KEYS) ;
 S NAME=$G(NAME)
 I NAME="" S R(0)="0^Role name required" Q
 ;
 ; Generate unique ID based on timestamp
 N ID S ID="CR"_$TR($H,",","")
 S ^XTMP("ZVECR",ID,0)=NAME_U_$G(DESCRIPTION)_U_$$NOW^XLFDT
 ;
 ; Store keys
 I $G(KEYS)]"" D
 . N I,K
 . F I=1:1:$L(KEYS,U) S K=$P(KEYS,U,I) I K]"" S ^XTMP("ZVECR",ID,"KEYS",I)=K
 ;
 D AUDITLOG^ZVEADMIN("ROLE-CRT",DUZ,"Created custom role: "_NAME)
 S R(0)="1^CREATED^"_ID_"^"_NAME
 Q
 ;
 ; ============================================================
 ; ZVE ROLE CUSTOM UPD — Update an existing custom role
 ; ============================================================
 ; Params: ROLEID, NAME, DESCRIPTION, KEYS (^-delimited key list)
 ; Output: "1^UPDATED^roleId^name"
 ; ============================================================
CRUPD(R,ROLEID,NAME,DESCRIPTION,KEYS) ;
 S ROLEID=$G(ROLEID)
 I ROLEID="" S R(0)="0^Role ID required" Q
 I '$D(^XTMP("ZVECR",ROLEID)) S R(0)="0^Role not found: "_ROLEID Q
 S NAME=$G(NAME)
 I NAME="" S R(0)="0^Role name required" Q
 ;
 ; Preserve original created date, update name/description
 N ORIGDATE S ORIGDATE=$P($G(^XTMP("ZVECR",ROLEID,0)),U,3)
 S ^XTMP("ZVECR",ROLEID,0)=NAME_U_$G(DESCRIPTION)_U_ORIGDATE
 ;
 ; Replace keys: kill existing, re-store new list
 K ^XTMP("ZVECR",ROLEID,"KEYS")
 I $G(KEYS)]"" D
 . N I,K
 . F I=1:1:$L(KEYS,U) S K=$P(KEYS,U,I) I K]"" S ^XTMP("ZVECR",ROLEID,"KEYS",I)=K
 ;
 D AUDITLOG^ZVEADMIN("ROLE-UPD",DUZ,"Updated custom role: "_NAME)
 S R(0)="1^UPDATED^"_ROLEID_"^"_NAME
 Q
 ;
 ; ============================================================
 ; ZVE ROLE CUSTOM DEL — Delete a custom role
 ; ============================================================
 ; Params: ROLEID
 ; Output: "1^DELETED^roleId"
 ; ============================================================
CRDEL(R,ROLEID) ;
 S ROLEID=$G(ROLEID)
 I ROLEID="" S R(0)="0^Role ID required" Q
 I '$D(^XTMP("ZVECR",ROLEID)) S R(0)="0^Role not found: "_ROLEID Q
 ;
 N NM S NM=$P($G(^XTMP("ZVECR",ROLEID,0)),U,1)
 K ^XTMP("ZVECR",ROLEID)
 D AUDITLOG^ZVEADMIN("ROLE-DEL",DUZ,"Deleted custom role: "_NM)
 S R(0)="1^DELETED^"_ROLEID
 Q
