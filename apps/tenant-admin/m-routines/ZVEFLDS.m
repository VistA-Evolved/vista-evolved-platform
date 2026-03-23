ZVEFLDS ;VE/KM - Dump field definitions for pending features;2026-03-22
 ;;1.0;VistA-Evolved Tenant Admin;**1**;Mar 22, 2026;Build 1
 Q
 ;
RUN ;
 ; Error Log (3.075)
 W "=== FILE 3.075 ERROR LOG ===",!
 D FIELDS(3.075)
 ; Sign-on Log (3.081)
 W "=== FILE 3.081 SIGN-ON LOG ===",!
 D FIELDS(3.081)
 ; Failed Access (3.05)
 W "=== FILE 3.05 FAILED ACCESS ===",!
 D FIELDS(3.05)
 ; Nursing Location (211.4)
 W "=== FILE 211.4 NURS LOCATION ===",!
 D FIELDS(211.4)
 ; IB Site Params (350.9)
 W "=== FILE 350.9 IB SITE PARAMETERS ===",!
 D FIELDS(350.9)
 ; Encounter Form (357)
 W "=== FILE 357 ENCOUNTER FORM ===",!
 D FIELDS(357)
 ; Claims Tracking (356)
 W "=== FILE 356 CLAIMS TRACKING ===",!
 D FIELDS(356)
 ; File Access Security (200.032) sub-file
 W "=== FILE 200.032 FILE ACCESS ===",!
 D FIELDS(200.032)
 Q
 ;
FIELDS(FN) ;
 N I,X
 S I=0 F  S I=$O(^DD(FN,I)) Q:I'>0  D
 . S X=$G(^DD(FN,I,0))
 . W I_"^"_$P(X,"^",1)_"^"_$P(X,"^",2)_"^"_$P(X,"^",3),!
 Q
 ;
SAMPLE ;
 ; Sample data from key files
 W "=== SAMPLE ERROR LOG ===",!
 N I S I=0 F  S I=$O(^%ZTER(1,I)) Q:I'>0!(I>3)  D
 . W I_"^"_$G(^%ZTER(1,I,0)),!
 ;
 W "=== SAMPLE FAILED ACCESS ===",!
 S I=0 F  S I=$O(^%ZUA(3.05,I)) Q:I'>0!(I>5)  D
 . W I_"^"_$G(^%ZUA(3.05,I,0)),!
 ;
 W "=== SAMPLE NURSING LOCS ===",!
 S I=0 F  S I=$O(^NURSF(211.4,I)) Q:I'>0!(I>5)  D
 . W I_"^"_$G(^NURSF(211.4,I,0)),!
 ;
 W "=== SAMPLE ENCOUNTER FORMS ===",!
 S I=0 F  S I=$O(^IBE(357,I)) Q:I'>0!(I>5)  D
 . W I_"^"_$G(^IBE(357,I,0)),!
 ;
 W "=== SAMPLE CLAIMS TRACKING ===",!
 S I=0 F  S I=$O(^IBT(356,I)) Q:I'>0!(I>5)  D
 . W I_"^"_$G(^IBT(356,I,0)),!
 ;
 W "=== SAMPLE IB SITE PARAMS ===",!
 W "IEN 1: "_$G(^IBE(350.9,1,0)),!
 W "IEN 1 node 1: "_$G(^IBE(350.9,1,1)),!
 W "IEN 1 node 2: "_$G(^IBE(350.9,1,2)),!
 ;
 W "=== FILE ACCESS (200.032 sub) ===",!
 ; Check if DUZ 1 has file access entries
 W "$D(^VA(200,1,""DIFILE""))="_$D(^VA(200,1,"DIFILE")),!
 Q
