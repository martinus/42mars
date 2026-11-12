;redcode-94odd
;name Weak oneshot
;author Roy van Rijn
;strategy .66c! without sne/seq/cmp!
;assert 1

sStep   dat     6       , -6
sPtr    dat     -21     , 24
sAdd    add.f   sStep   , sPtr
        jmz.f   2       , @sPtr
        jmp     sClr    , <sPtr
        jmz.f   sAdd    , *sPtr
        mov.x   sPtr    , sPtr
sClr    spl     #0      , 0
        mov.i   sBomb   , >sPtr
        djn.f   -1      , >sPtr
sBomb   dat     <1      , #10
end sAdd
