;redcode-94nop
;name D-Clear reGen
;author Roy van Rijn
;strategy Stupid generating d-clears
;strategy Designed for R12 (Read/Write limits)
;assert 1

sBoot   spl     sStart  , <-100
        spl     sStart2 , <-100
        djn.f   sStart3 , <-100

sStep   equ     -383
sDist   equ     335

sGate   mov.i   0       , <sDist
sStart  mov.i   {sEnd   , {sPtr
        jmn.a    -1     , *sPtr
        add.a   #4      , sStep-4
sPtr    spl     sStep   , {sBomb
        mov     sBomb   , >sGate
        mov     sBomb   , >sGate
        djn.f   -2      , >sGate
sBomb   dat     <1      , {9
sEnd    dat     0       , 0

for     24
        dat     0       , 0
rof

sStep2  equ     383
sDist2  equ     -323

sGate2  mov.i   0       , <sDist2
sStart2 mov.i   {sEnd2  , {sPtr2
        jmn.a    -1     , *sPtr2
        add.a   #4      , sStep2-4
sPtr2   spl     sStep2  , {sBomb2
        mov     sBomb2  , >sGate2
        mov     sBomb2  , >sGate2
        djn.f   -2      , >sGate2
sBomb2  dat     <1      , {9
sEnd2   dat     0       , 0

for     43
        dat     0       , 0
rof

sStep3  equ     -133
sDist3  equ     235

sGate3  mov.i   0       , <sDist3
sStart3 mov.i   {sEnd3  , {sPtr3
        jmn.a    -1     , *sPtr3
        add.a   #4      , sStep3-4
sPtr3   spl     sStep3  , {sBomb3
        mov     sBomb3  , >sGate3
        mov     sBomb3  , >sGate3
        djn.f   -1      , >sGate3
sBomb3  dat     <2      , {9
sEnd3   dat     0       , 0

end sBoot
