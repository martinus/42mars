;redcode-nano
;name SuperSentryV
;author J.J. 'Imrahil' Wingert
; Thanks to S.Fernandes who gave me good advice during the creation
;strategy Scans for any value not 0,0 and bombs it
;assert (CORESIZE==80) && (MAXPROCESSES==80)
;assert (MAXCYCLES==800) && (MAXLENGTH==5)
;       (MINDISTANCE==5)

           org      scanner                  ; setzt den startpunkt auf scanner
somewhere  equ      43                       ; definiert somewhere als 43
scanstep   equ      -5                       ; definiert scanstep als -5
scanstart  equ      -11                      ; definiert scanstart als -11
scan       add.ab   #scanstep,1              ; Schritt 2: erhöht den b-value um scanstep (# beachten das ist der Identifier der scanstep als Zahl behandelt) zurück zu schritt 1
scanner    jmz.f    scan, scanstart          ; Schritt 1: Jump if scanstart = $0,$0 zur Position scanstep
           mov      bomb,>scanner            ; Schritt 3: Wenn an scanstart etwas anderes als $0,$0 (standardwert, auf jeden Fall ein uninteressanter Fleck!) ist kopiere den
                                             ; string bei bomb an die Position des Werts des B-Felds von scanner und erhöhe dieses Feld gleichzeitig um 1
           jmp      scanner, <somewhere      ; springt nach erfolreichem Bomben zurück zu scanner und platziert an der Stelle somewhere (hier 43) einen decrease
bomb       dat      0,0                      ; die Bombe
           end                               ; Der Endpunkt
