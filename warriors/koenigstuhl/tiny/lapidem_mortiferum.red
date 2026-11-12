;redcode-tiny
;name Lapidem Mortiferum
;author Christian Schmidt
;assert 1
;strategy dwarf with a sneaky trick

sStep1  equ     340
sStep2  equ     323
sStep3  equ     715
sStep4  equ     739
sGate   equ     sGo-3
sGap    equ     sGo+16
sTrail  equ     702

sDec1   equ     45
sDec2   equ     sGo+104

sGo     spl     #sStep1 , >sStep2
sAtt    mov     {sStep3 , {sStep4
        add.f   sGo     , sAtt
        mov.i   @sLoop  , >sGate
sLoop   djn.f   -1      , {bomb
        dat     }sTrail , }sGap
bomb    spl     #sTrail , }sGap

        for    6
        dat    0,0
        rof

;-------Decoymaker-------------------
sCnt
z       for    6
        mov    <sDec2+sDec1*z, {sDec2+sDec1*z+sDec1-1
        rof
        djn.f  sGo,      <sDec2+sDec1*8
;-------Decoymaker-------------------

end     sCnt 

