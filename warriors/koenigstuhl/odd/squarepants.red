;redcode-94odd
;name Squarepants
;author Roy van Rijn
;strategy Stole bits from D2
;assert 1

bDist1  equ     133
bDist2  equ     4122

pGo
        spl     1       , <3555
        spl     1       , <5335
        spl     1       , <2363

        mov     {pap1   , {1
pBoot1  spl     bDist1  , >5747

        mov     {pap    , {1
pBoot2  djn.f   bDist2  , >4584

for     14
        dat     0       , 0
rof

nstep1  equ     851
cstep1  equ     1857
tstep1  equ     3218

pap     spl     @8      , }tstep1
        mov.i   }pap    , >pap
nothA   spl     @nothA  , }cstep1
        mov.i   }nothA  , >nothA
nothB   spl     @nothB  , }nstep1
        mov.i   }nothB  , >nothB
        mov.i   #1138   , <1
        djn     -2      , <4546

for     14
        dat     0               , 0
rof

iStep   equ     5143
pStep   equ     2044
sStep   equ     1819

pap1    spl     @8              , }pStep
        mov.i   }pap1           , >pap1
        spl     #0              , 0
        mov     bomb            , >ptr
        add.x   imp             , ptr
ptr     jmp     imp-iStep*8     , >sStep-6
bomb    dat     >1              , }1
imp     mov.i   #sStep-1        , iStep

end pGo
