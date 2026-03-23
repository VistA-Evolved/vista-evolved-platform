ZVEMENUTREE ;VE/KM - Walk File 19 Menu Tree from EVE;2026-03-22
 ;;1.0;VistA-Evolved Tenant Admin;**MENUTREE**;Mar 22, 2026;Build 1
 Q
 ;
WALK ; Walk full EVE menu tree — output JSON lines for each option
 ; Output format: JSON lines (one per option), depth-prefixed
 ; Usage: D WALK^ZVEMENUTREE
 N ROOT,RNAME
 S RNAME="EVE"
 S ROOT=$O(^DIC(19,"B",RNAME,""))
 I ROOT="" W !,"{""error"":""EVE option not found in File 19""}" Q
 W !,"["
 N FIRST S FIRST=1
 D DESCEND(ROOT,0,.FIRST)
 W !,"]"
 Q
 ;
DESCEND(IEN,DEPTH,FIRST) ; Recursively descend menu tree
 N NAME,TYPE,LOCK,DESC,SUB,SUBIEN
 S NAME=$P($G(^DIC(19,IEN,0)),U,1)
 S TYPE=$P($G(^DIC(19,IEN,0)),U,4)
 S LOCK=$P($G(^DIC(19,IEN,0)),U,6)
 S DESC=$P($G(^DIC(19,IEN,1,1,0)),U,1)
 I DESC="" S DESC=$P($G(^DIC(19,IEN,"U")),U,1)
 ; Output this node
 I 'FIRST W ","
 S FIRST=0
 W !,"{""ien"":",IEN
 W ",""name"":""",$TR(NAME,"""","'"),""""
 W ",""type"":""",$S(TYPE="M":"menu",TYPE="A":"action",TYPE="R":"run routine",TYPE="P":"print",TYPE="E":"edit",TYPE="I":"inquire",TYPE="S":"server",TYPE="B":"broker",TYPE="O":"protocol",TYPE="X":"extended action",1:"other"),""""
 W ",""depth"":",DEPTH
 I LOCK'="" W ",""lock"":""",$TR(LOCK,"""","'"),""""
 I DESC'="" W ",""desc"":""",$TR(DESC,"""","'"),""""
 ; Count sub-items
 N SUBCNT S SUBCNT=0,SUB=0
 F  S SUB=$O(^DIC(19,IEN,10,SUB)) Q:SUB=""  S SUBCNT=SUBCNT+1
 I SUBCNT>0 W ",""children"":",SUBCNT
 W "}"
 ; Recurse into sub-items (menu items stored in multiple 10)
 I SUBCNT>0,DEPTH<6 D
 . S SUB=0
 . F  S SUB=$O(^DIC(19,IEN,10,SUB)) Q:SUB=""  D
 . . S SUBIEN=$P($G(^DIC(19,IEN,10,SUB,0)),U,1)
 . . Q:SUBIEN=""
 . . ; Resolve IEN from "B" index if SUBIEN is a name
 . . I SUBIEN'?1.N D
 . . . N RESOLVED S RESOLVED=$O(^DIC(19,"B",SUBIEN,""))
 . . . I RESOLVED>0 S SUBIEN=RESOLVED
 . . . E  S SUBIEN=""
 . . Q:SUBIEN=""
 . . Q:'$D(^DIC(19,SUBIEN,0))
 . . D DESCEND(SUBIEN,DEPTH+1,.FIRST)
 Q
 ;
ADMIN ; Walk only admin-relevant sub-trees
 ; Output the EVE admin branches: XUSITEMGR, DIUSER, XUTIO, XMMGR, XUTM, etc.
 N ROOT,RNAME
 S RNAME="EVE"
 S ROOT=$O(^DIC(19,"B",RNAME,""))
 I ROOT="" W !,"{""error"":""EVE not found""}" Q
 W !,"{"
 W """eveIen"":",ROOT
 W ",""eveName"":""EVE"""
 ; List direct children of EVE
 W ",""adminMenus"":["
 N SUB,SUBIEN,NAME,FC S FC=1,SUB=0
 F  S SUB=$O(^DIC(19,ROOT,10,SUB)) Q:SUB=""  D
 . S SUBIEN=$P($G(^DIC(19,ROOT,10,SUB,0)),U,1)
 . Q:SUBIEN=""
 . I SUBIEN'?1.N D
 . . N R S R=$O(^DIC(19,"B",SUBIEN,""))
 . . I R>0 S SUBIEN=R
 . . E  S SUBIEN=""
 . Q:SUBIEN=""
 . Q:'$D(^DIC(19,SUBIEN,0))
 . S NAME=$P($G(^DIC(19,SUBIEN,0)),U,1)
 . I 'FC W ","
 . S FC=0
 . W !,"{""ien"":",SUBIEN,",""name"":""",$TR(NAME,"""","'"),""""
 . ; Count descendants
 . N DC S DC=0,DC=$$COUNTDESC(SUBIEN)
 . W ",""descendants"":",DC,"}"
 W "]}"
 Q
 ;
COUNTDESC(PIEN) ; Count all descendant options recursively
 N CT,S,SI
 S CT=0,S=0
 F  S S=$O(^DIC(19,PIEN,10,S)) Q:S=""  D
 . S SI=$P($G(^DIC(19,PIEN,10,S,0)),U,1)
 . Q:SI=""
 . I SI'?1.N D
 . . N R S R=$O(^DIC(19,"B",SI,""))
 . . I R>0 S SI=R
 . . E  S SI=""
 . Q:SI=""
 . Q:'$D(^DIC(19,SI,0))
 . S CT=CT+1
 . S CT=CT+$$COUNTDESC(SI)
 Q CT
