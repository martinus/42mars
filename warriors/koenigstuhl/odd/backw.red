;redcode-94nop
;name Backwards
;strategy Backwards oneshot :)
;author Roy van Rijn
;assert 1

        nop     }1      , >1
        nop     }1      , >1
        nop     0       , 0  ;scanned
        nop     }1      , >1
        nop     0       , 0  ;scanned
        add.ba  #1      , 1
        mul.a   1       , 1
        add.a   #1      , 1
        nop     {-1     , 0
        nop     }1      , >1
        nop     }1      , }1
        mul     1       , 1
        sub.f   #1      , 1
        add.x   #-1     , #-1
        add.f   -1      , 1
        sne.f   1       , -1
        djn     -1      , @-1
        add.ab  @-1     , @1
        spl     #0      , 1
        mov     @1      , 1
        dat     <-1     , >1
end
