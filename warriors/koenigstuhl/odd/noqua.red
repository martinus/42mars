;redcode-mp
;name Noqua
;author Roy van Rijn
;strategy LP paper
;assert 1

pLen  equ 9

lStep   equ 5244
pStep   equ 5024
bOff    equ 4031
bStep   equ 1550

pPtr    spl    pStep             , pLen
        add.f  pBomb             , pPtr
pLoop   mov    pBomb             , @1
        mov    pBomb             , *bOff
        add.ab #bStep            , -1
        mov    <pPtr             , {pPtr
        jmn    pLoop             , *pPtr
        jmz.b  pPtr              , }pPtr
pBomb   dat    >lStep+pLen       , }pLen

end pLoop
