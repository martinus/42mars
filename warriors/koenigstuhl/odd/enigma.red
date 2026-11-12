;This is my warrior for the final round. I wanted to write something
;more original, but it's my only warrior which doesn't get killed by
;most of '88 programs.

;redcode
;name ]enigma[
;author Michal Janeczek
;strategy Paper with imps
;assert 1

eStep   equ 3039
eImp    equ 1143
eLength equ 8

        spl 1                     , 0
eDst    spl 1                     , ePaper+eLength+eStep
eSrc    spl 1                     , ePaper+eLength
        mov <eSrc                 , <eDst

ePaper  spl eStep                 , eLength+(eStep*2)
        mov <ePaper+eLength+eStep , <ePaper
        mov <eLength              , <1
        spl @0                    , 2365
        spl 0                     , 0
        add #eImp                 , 1
        jmp @0                    , -eImp
        mov 0                     , eImp
