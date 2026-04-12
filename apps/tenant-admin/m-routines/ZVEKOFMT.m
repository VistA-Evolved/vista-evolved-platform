ZVEKOFMT ; Korean language pack — LANGUAGE file (.85) formatting nodes
 ; Source: Plan VI VEHU snapshot, IEN 198
 ; Extracted: 2025-07-14 from local-vista-utf8 container
 ;
 ; These nodes are executable M code called by FileMan's language dispatch.
 ; When DUZ("LANG")=198, the runtime executes these instead of the English
 ; formatting code.
 ;
 ; Idempotent: safe to run multiple times.
 ;
EN ;
 W "Loading Korean formatting nodes into LANGUAGE file (.85) IEN 198...",!
 ;
 ; === Header node (required) ===
 ; Pieces: NAME^ISO2^ISO3^unused^unused^I^L
 S ^DI(.85,198,0)="KOREAN^KO^KOR^^^I^L"
 ;
 ; === Date input mode ===
 ; Forces internal date format to include "I" (ISO) flag
 S ^DI(.85,198,"20.2")="S:$G(%DT)'[""I"" %DT=$G(%DT)_""I"" G CONT^%DT"
 ;
 ; === Date display (DD) ===
 ; Korean standard: YYYY-MM-DD (via $$FMTE^UKOUTL)
 ; See: https://en.wikipedia.org/wiki/Date_and_time_notation_in_South_Korea
 S ^DI(.85,198,"DD")="S Y=$$FMTE^UKOUTL(Y,$G(%F))"
 ;
 ; === Formatted external (FMTE) ===
 ; Full date+time formatting, also delegates to UKOUTL
 S ^DI(.85,198,"FMTE")="S Y=$$FMTE^UKOUTL(Y,$G(%F))"
 ;
 ; === Update B-index ===
 S ^DI(.85,"B","KOREAN",198)=""
 ;
 W "  Korean formatting nodes loaded (DD, FMTE, 20.2).",!
 W "  NOTE: CRD, LC, UC, ORD, TIME not yet defined for Korean.",!
 W "  Korean dates will display as YYYY-MM-DD format.",!
 Q
