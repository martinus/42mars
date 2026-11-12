;redcode-94x
;name R1
;author Roy van Rijn
;strategy one-shot
;assert 1
        dat     0       , 7
        dat     0       , 0
        dat     0       , 0
        dat     0       , 8
        dat     0       , 0
        dat     #-10    , #10
start   mov     j       , l
        add.f   -2      , 1
ptr     seq     -100    , 105
        add.ab  #4      , -9
j       jmp     @-10
        mov     bomb    , >ptr
        mov     bomb    , {ptr
l       dat     0       , 0
bomb    dat     1       , 10

        end start

