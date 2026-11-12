;redcode-94nop
;name Aight
;author Roy van Rijn
;strategy Just -8 to 8, we can still have a paper/stone.
;assert 1

pGo     spl     7		        , {3
        mov     }2		        , }-1
bLine   mov     hBomb           , }2
        mov     3               , }-3
        jmz.f   -4              , *-1
hBomb   dat     }7              , >1

wGo     div.x   pGo             , 1
bDat    sub.x   #-5	            , #-3
pEnd    add.a   bDat            , *-2
        add.b   bDat            , bLine
        sub.f   bDat            , dBoo
        mov     hBomb           , {dBoo
        mul.a   -5              , @pBoo-1
        spl     }2              , {bDat
        spl     1               , {bDat
        spl     0               , {dRec
        mov     <dGo            , {dBoo
dBoo    spl     3               , 0
dRec    mov     <pEnd+3         , <dBoo
        spl     *dBoo           , 4
pBoo    jmp     @dBoo

dGo     spl     #0              , {6
        mov     5               , @hPtr
hHit    add     #-8             , hPtr
hPtr    mov     3               , }-7
        djn.f   -3              , {-4
end wGo
