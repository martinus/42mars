;redcode-94m quiet
;name Gatling
;author Roy van Rijn
;strategy A rather fat oneshot
;assert 1

sStep   equ    797
sTimes  equ    1794
sStart  equ    1115
sGap    equ    18

gate    dat    sStart+sGap, sStart

        dat    0,        0

ai      dat    <5334,    <2667
sb2     spl    #ai-bptr, bptr-gate
sb1     spl    #sb2-bptr,bptr-gate

        dat    0,        0
        dat    0,        0
        dat    0,        0

        add.f  sbmb,     gate
scan    sne.i  *gate,    @gate
        djn.b  -2,       #sTimes
        mov.a  #-10,     gate

sbmb    spl    #sStep,   >sStep
clear   mov.i  *bptr,    >gate
        mov.i  *bptr,    >gate
        djn.f  clear,    {gate

        dat    0,        0

bptr    dat    sb1,      0

end scan
