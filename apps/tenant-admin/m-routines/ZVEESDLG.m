ZVEESDLG ; Spanish language pack — DIALOG file (.84) translations
 ; Level 2: Core Prompt Translated (26 dialogs)
 ; Created: 2026-03-14
 ; Target: Language IEN 3 (SPANISH)
 ;
 ; Translation quality: AI-drafted with second-pass critique.
 ;  - Formal usted register for clinical/operator context
 ;  - y/n shortkeys preserved (VistA kernel requires Y/N input)
 ;  - |n| placeholders preserved exactly
 ;  - Consistent terminology: opcion, Seleccione, Pulse, Ingrese
 ;  - Inverted question marks for proper Spanish
 ;
 ; Unicode codepoints used (YottaDB UTF-8 mode):
 ;   a-acute  = $C(225)   A-acute  = $C(193)
 ;   e-acute  = $C(233)   E-acute  = $C(201)
 ;   i-acute  = $C(237)   I-acute  = $C(205)
 ;   o-acute  = $C(243)   O-acute  = $C(211)
 ;   u-acute  = $C(250)   U-acute  = $C(218)
 ;   n-tilde  = $C(241)   N-tilde  = $C(209)
 ;   inv-?    = $C(191)   inv-!    = $C(161)
 ;
EN ;
 S U="^"
 W "Loading Spanish dialog translations (26 entries)...",!
 N CNT S CNT=0
 ;
 ; ===== Category 1: YES/NO (4 dialogs) =====
 ;
 ; --- Dialog 7001: Yes^No ---
 ; English: Yes^No
 ; Spanish: Si^No (accent on i)
 S ^DI(.84,7001,4,3,0)="3"
 S ^DI(.84,7001,4,3,1,0)="^^1^1^3260314^"
 S ^DI(.84,7001,4,3,1,1,0)="S"_$C(237)_U_"No"
 S CNT=CNT+1
 ;
 ; --- Dialog 7003: y:YES;n:NO ---
 ; English: y:YES;n:NO
 ; Spanish: y:SI;n:NO (keep y/n keys — VistA kernel checks Y/N)
 S ^DI(.84,7003,4,3,0)="3"
 S ^DI(.84,7003,4,3,1,0)="^^1^1^3260314^"
 S ^DI(.84,7003,4,3,1,1,0)="y:S"_$C(205)_";n:NO"
 S CNT=CNT+1
 ;
 ; --- Dialog 8040: Answer with 'Yes' or 'No' ---
 ; English: Answer with 'Yes' or 'No'
 ; Spanish: Responda con 'Si' o 'No'
 S ^DI(.84,8040,4,3,0)="3"
 S ^DI(.84,8040,4,3,1,0)="^^1^1^3260314^"
 S ^DI(.84,8040,4,3,1,1,0)="Responda con 'S"_$C(237)_"' o 'No'"
 S CNT=CNT+1
 ;
 ; --- Dialog 9040: Enter either 'Y' or 'N'. ---
 ; English: Enter either 'Y' or 'N'.
 ; Spanish: Ingrese 'Y' o 'N'. (keep Y/N — operator keys)
 S ^DI(.84,9040,4,3,0)="3"
 S ^DI(.84,9040,4,3,1,0)="^^1^1^3260314^"
 S ^DI(.84,9040,4,3,1,1,0)="Ingrese 'Y' o 'N'."
 S CNT=CNT+1
 ;
 ; ===== Category 2: Menu prompts (20 dialogs) =====
 ;
 ; --- Dialog 19001: |1| Select |2|'s |3| Option: ---
 ; English: |1| Select |2|'s |3| Option:
 ; Spanish: |1| Seleccione opcion |3| de |2|:
 S ^DI(.84,19001,4,3,0)="3"
 S ^DI(.84,19001,4,3,1,0)="^^1^1^3260314^"
 S ^DI(.84,19001,4,3,1,1,0)="|1| Seleccione opci"_$C(243)_"n |3| de |2|:"
 S CNT=CNT+1
 ;
 ; --- Dialog 19002: |1| Select |2| Option: ---
 ; English: |1| Select |2| Option:
 ; Spanish: |1| Seleccione opcion |2|:
 S ^DI(.84,19002,4,3,0)="3"
 S ^DI(.84,19002,4,3,1,0)="^^1^1^3260314^"
 S ^DI(.84,19002,4,3,1,1,0)="|1| Seleccione opci"_$C(243)_"n |2|:"
 S CNT=CNT+1
 ;
 ; --- Dialog 19003: Press RETURN to continue (long form) ---
 ; English:   **> Press 'RETURN' to continue, '^' to stop, or '?[option text]' for more
 ; Spanish:   **> Pulse INTRO para continuar, '^' para detener, o '?[texto opcion]' para mas
 S ^DI(.84,19003,4,3,0)="3"
 S ^DI(.84,19003,4,3,1,0)="^^1^1^3260314^"
 S ^DI(.84,19003,4,3,1,1,0)="  **> Pulse INTRO para continuar, '"_U_"' para detener, o '?[texto opci"_$C(243)_"n]' para m"_$C(225)_"s"
 S CNT=CNT+1
 ;
 ; --- Dialog 19004: Press RETURN to continue (short form) ---
 ; English: Press 'RETURN' to continue, '^' to stop:
 ; Spanish: Pulse INTRO para continuar, '^' para detener:
 S ^DI(.84,19004,4,3,0)="3"
 S ^DI(.84,19004,4,3,1,0)="^^1^1^3260314^"
 S ^DI(.84,19004,4,3,1,1,0)="Pulse INTRO para continuar, '"_U_"' para detener: "
 S CNT=CNT+1
 ;
 ; --- Dialog 19005: Option name ---
 ; English: Option name
 ; Spanish: Nombre de opcion
 S ^DI(.84,19005,4,3,0)="3"
 S ^DI(.84,19005,4,3,1,0)="^^1^1^3260314^"
 S ^DI(.84,19005,4,3,1,1,0)="Nombre de opci"_$C(243)_"n"
 S CNT=CNT+1
 ;
 ; --- Dialog 19006: Synonym ---
 ; English: Synonym
 ; Spanish: Sinonimo
 S ^DI(.84,19006,4,3,0)="3"
 S ^DI(.84,19006,4,3,1,0)="^^1^1^3260314^"
 S ^DI(.84,19006,4,3,1,1,0)="Sin"_$C(243)_"nimo"
 S CNT=CNT+1
 ;
 ; --- Dialog 19007: Extended help available ---
 ; English: Extended help available.  Type "?|1|" to see it.
 ; Spanish: Ayuda ampliada disponible. Escriba "?|1|" para verla.
 S ^DI(.84,19007,4,3,0)="3"
 S ^DI(.84,19007,4,3,1,0)="^^1^1^3260314^"
 S ^DI(.84,19007,4,3,1,1,0)="Ayuda ampliada disponible. Escriba "_$C(34)_"?|1|"_$C(34)_" para verla."
 S CNT=CNT+1
 ;
 ; --- Dialog 19008: Sorry, no help text ---
 ; English: Sorry, no help text available for this option.
 ; Spanish: Lo sentimos, no hay texto de ayuda disponible para esta opcion.
 S ^DI(.84,19008,4,3,0)="3"
 S ^DI(.84,19008,4,3,1,0)="^^1^1^3260314^"
 S ^DI(.84,19008,4,3,1,1,0)="Lo sentimos, no hay texto de ayuda disponible para esta opci"_$C(243)_"n."
 S CNT=CNT+1
 ;
 ; --- Dialog 19009: Shall I show secondary menus ---
 ; English: Shall I show you your secondary menus too
 ; Spanish: Desea ver tambien sus menus secundarios? (with inv-? and accents)
 S ^DI(.84,19009,4,3,0)="3"
 S ^DI(.84,19009,4,3,1,0)="^^1^1^3260314^"
 S ^DI(.84,19009,4,3,1,1,0)=$C(191)_"Desea ver tambi"_$C(233)_"n sus men"_$C(250)_"s secundarios?"
 S CNT=CNT+1
 ;
 ; --- Dialog 19010: Your secondary options ---
 ; English: Your secondary options
 ; Spanish: Sus opciones secundarias
 S ^DI(.84,19010,4,3,0)="3"
 S ^DI(.84,19010,4,3,1,0)="^^1^1^3260314^"
 S ^DI(.84,19010,4,3,1,1,0)="Sus opciones secundarias"
 S CNT=CNT+1
 ;
 ; --- Dialog 19011: Would you like to see Common Options ---
 ; English: Would you like to see the Common Options
 ; Spanish: Desea ver las opciones comunes? (with inv-?)
 S ^DI(.84,19011,4,3,0)="3"
 S ^DI(.84,19011,4,3,1,0)="^^1^1^3260314^"
 S ^DI(.84,19011,4,3,1,1,0)=$C(191)_"Desea ver las opciones comunes?"
 S CNT=CNT+1
 ;
 ; --- Dialog 19012: Common Options description ---
 ; English: The Common Options, options available to everyone
 ; Spanish: Opciones comunes, opciones disponibles para todos
 S ^DI(.84,19012,4,3,0)="3"
 S ^DI(.84,19012,4,3,1,0)="^^1^1^3260314^"
 S ^DI(.84,19012,4,3,1,1,0)="Opciones comunes, opciones disponibles para todos"
 S CNT=CNT+1
 ;
 ; --- Dialog 19013: Out of order ---
 ; English: Out of order
 ; Spanish: Fuera de servicio
 S ^DI(.84,19013,4,3,0)="3"
 S ^DI(.84,19013,4,3,1,0)="^^1^1^3260314^"
 S ^DI(.84,19013,4,3,1,1,0)="Fuera de servicio"
 S CNT=CNT+1
 ;
 ; --- Dialog 19014: Not available on ---
 ; English: Not available on
 ; Spanish: No disponible en
 S ^DI(.84,19014,4,3,0)="3"
 S ^DI(.84,19014,4,3,1,0)="^^1^1^3260314^"
 S ^DI(.84,19014,4,3,1,1,0)="No disponible en"
 S CNT=CNT+1
 ;
 ; --- Dialog 19015: Can't be run on all devices ---
 ; English: Can't be run on all devices
 ; Spanish: No se puede ejecutar en todos los dispositivos
 S ^DI(.84,19015,4,3,0)="3"
 S ^DI(.84,19015,4,3,1,0)="^^1^1^3260314^"
 S ^DI(.84,19015,4,3,1,1,0)="No se puede ejecutar en todos los dispositivos"
 S CNT=CNT+1
 ;
 ; --- Dialog 19016: Locked with ---
 ; English: Locked with
 ; Spanish: Bloqueado con
 S ^DI(.84,19016,4,3,0)="3"
 S ^DI(.84,19016,4,3,1,0)="^^1^1^3260314^"
 S ^DI(.84,19016,4,3,1,1,0)="Bloqueado con"
 S CNT=CNT+1
 ;
 ; --- Dialog 19017: Reverse Lock ---
 ; English: Reverse Lock
 ; Spanish: Bloqueo inverso
 S ^DI(.84,19017,4,3,0)="3"
 S ^DI(.84,19017,4,3,1,0)="^^1^1^3260314^"
 S ^DI(.84,19017,4,3,1,1,0)="Bloqueo inverso"
 S CNT=CNT+1
 ;
 ; --- Dialog 19018: You can also select a secondary option ---
 ; English: You can also select a secondary option
 ; Spanish: Tambien puede seleccionar una opcion secundaria
 S ^DI(.84,19018,4,3,0)="3"
 S ^DI(.84,19018,4,3,1,0)="^^1^1^3260314^"
 S ^DI(.84,19018,4,3,1,1,0)="Tambi"_$C(233)_"n puede seleccionar una opci"_$C(243)_"n secundaria"
 S CNT=CNT+1
 ;
 ; --- Dialog 19019: Or a Common Option ---
 ; English: Or a Common Option
 ; Spanish: O una opcion comun
 S ^DI(.84,19019,4,3,0)="3"
 S ^DI(.84,19019,4,3,1,0)="^^1^1^3260314^"
 S ^DI(.84,19019,4,3,1,1,0)="O una opci"_$C(243)_"n com"_$C(250)_"n"
 S CNT=CNT+1
 ;
 ; --- Dialog 19020: Enter ?? for more options ---
 ; English: Enter ?? for more options, ??? for brief descriptions, ?OPTION for help text
 ; Spanish: Ingrese ?? para mas opciones, ??? para descripciones breves, ?OPCION para texto de ayuda
 S ^DI(.84,19020,4,3,0)="3"
 S ^DI(.84,19020,4,3,1,0)="^^1^1^3260314^"
 S ^DI(.84,19020,4,3,1,1,0)="Ingrese ?? para m"_$C(225)_"s opciones, ??? para descripciones breves, ?OPCI"_$C(211)_"N para texto de ayuda"
 S CNT=CNT+1
 ;
 ; ===== Category 3: Sign-on prompts (2 dialogs) =====
 ;
 ; --- Dialog 30810.51: ACCESS CODE: ---
 ; English: ACCESS CODE:
 ; Spanish: CODIGO DE ACCESO: (with accent on O)
 S ^DI(.84,30810.51,4,3,0)="3"
 S ^DI(.84,30810.51,4,3,1,0)="^^1^1^3260314^"
 S ^DI(.84,30810.51,4,3,1,1,0)="C"_$C(211)_"DIGO DE ACCESO: "
 S CNT=CNT+1
 ;
 ; --- Dialog 30810.52: VERIFY CODE: ---
 ; English: VERIFY CODE:
 ; Spanish: CODIGO DE VERIFICACION: (with accents on O's)
 S ^DI(.84,30810.52,4,3,0)="3"
 S ^DI(.84,30810.52,4,3,1,0)="^^1^1^3260314^"
 S ^DI(.84,30810.52,4,3,1,1,0)="C"_$C(211)_"DIGO DE VERIFICACI"_$C(211)_"N: "
 S CNT=CNT+1
 ;
 W "  Loaded ",CNT," Spanish dialog translations.",!
 Q
