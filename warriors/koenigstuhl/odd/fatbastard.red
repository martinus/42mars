;redcode-94nop
;name Fat Bastard
;author Roy van Rijn
;strategy A try to implement offensive power....
;strategy Uses a little trick pointed out on r.g.c
;strategy Could be made a LOT smaller IMO, but....I don't have time!
;assert 1

        mov 3   , >3
        mov 2   , {2
        djn -2  , #-243
bomb    dat -266, 265
for 20
        dat     0       , 0
rof
        add.a   #10     , ptr
        sub.a   #10     , ptr2
        mov.i   bomb    , }ptr
        mov.i   bomb    , {ptr2
start   sne.f   }ptr    , {ptr2
        jmp     -5
        jmz.f   jump    , *ptr2

        mov.f   *ptr2   , 1
        add.ab  #0      , #0
        seq.b   -1      , #-1
        jmp     start-4
ptr2    add.ab  -100    , safe2
        add.ab  -1      , safe2
safe2   mov     check   , 0
        jmp     @-1

jump    mov.f   *ptr    , 1
        add.ab  #0      , #0
        seq.b   -1      , #0
        jmp     start-4
ptr     add.b   100     , safe
        add.ab  -1      , safe
safe    mov     check   , 0
        jmp     @-1
check   jmn     0       , -2
end start
