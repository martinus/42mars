;redcode-tiny
;name Rabies
;author John Metcalf
;strategy cc-paper with mirrored resonance
;assert CORESIZE==800

; for a full explanation of mirrored
; resonance see CoreOps issue 2

; quickbomb any areas of core not hit by
; the paper in the first 1000 cycles

qbomb   mov    >qbomb+265,qbomb+79
        mov    >qbomb+665,qbomb+479
        mov    >qbomb+279,qbomb+193
        mov    >qbomb+679,qbomb+593
        mov    >qbomb+145,qbomb+329
        mov    >qbomb+74, qbomb+729
        mov    >qbomb+474,qbomb+122
        mov    >qbomb+84, qbomb+522
        mov    >qbomb+484,qbomb+545

        fact   equ 24
        step1  equ 401-fact*3
        step2  equ fact*2

        spl    2,         <qbomb+154
        spl    1,         <qbomb+452
        spl    1,         <qbomb+629

        mov    {papera,   {boot
boot    spl    papera+406,<qbomb+436

papera  spl    @0+6,      <step1
        mov    }papera,   >papera
paperb  spl    @0,        }step2
        mov    }paperb,   >paperb
clear   mov    >-100,     {clear
        djn.f  clear-1,   {clear

        end

