;redcode-94x
;name R2
;author Roy van Rijn
;strategy Clear+Decoy
;assert 1

jumpptr dat     0       , 8
gate    dat     0       , 30
s       nop     >113    , >114
        nop     >116    , >117
        nop     >119    , >120
        nop     >-113   , >-114
        nop     >-116   , >-117
        nop     >-119   , >-120
        mov     bomb    , >gate
        mov     bomb    , >gate
        jmp     @-10    , >gate
bomb    div     <1      , <1
end s


