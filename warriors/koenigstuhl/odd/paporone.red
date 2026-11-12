;redcode-94
;name PaporOne?
;author Roy van Rijn
;strategy Huge Slow Switcher
;strategy Switches between a paper and a oneshot
;assert 1

;Backwards scanning+clearing oneshot
one     nop     }1      , >1
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

for 4
        dat     0       , 0
rof

;A not so small SoL switcher
switch
        nop     }1      , >1
        add.a   #1      , 1
        nop     }1      , >1
        add.a   #1      , 1
        nop     }1      , >1
        add     #1      , @1
        nop     }1      , >1
        add     #1      , 1
        ldp.a   #-1     , 1
        ldp.a   0       , 1
        nop     }1      , >1
        nop     }1      , }1
        seq     #0      , #0
;        sne     #0      , #1
        jmp     1       , 0
        sub.ab  #1      , *-1
        sub.a   #0      , 1
        stp.ab  #1      , #0
        nop     }1      , >1
        nop     }1      , }1
        mul     1       , 1
        sub.f   #1      , 1
        add.x   #-1     , #-1
        add.f   -1      , 1
        add.x   #-1     , #-1
        add.f   -1      , 1
        add.x   #-1     , #-1
        add.a   -1      , 1
        add     #1      , @1
        ldp.a   #-1     , 1
        jmp     @0      , -1
        dat     0       , 1

;Paper (Try to tie)

        nop     }1      , >1
        nop     >1      , >1
        add.b   #1      , *1
        spl     1       , }1
        spl     1       , }1
        spl     1       , }1
        mul     #1      , 1
        spl     @0      , <1
        mov.i   }-1     , >-1
        spl     @0      , <1
        mov.i   }-1     , >-1
        mov.i   #1      , <-1
        mov.i   #1      , >1
        djn.b   -1      , <-1

end switch
