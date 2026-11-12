;redcode-94x
;name TieRip
;author Roy van Rijn
;assert 1
        mov.i   sSpl    , 500
        mov.i   sSpl+1  , 500
        mov.i   sSpl+2  , 500
        mov.i   sSpl+3  , 500
        jmp     496
        dat     0       , 0
        dat     0       , 0
        dat     0       , 0
        dat     0       , 0
        dat     0       , 0
        dat     0       , 0
        dat     0       , 0
sSpl    spl     #0      , #-114
        mov     sSpl    , <sSpl
        sub     #12     , sSpl
        jmp     -2
end