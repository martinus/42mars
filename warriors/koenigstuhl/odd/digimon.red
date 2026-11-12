;redcode-94
;name Digimon
;author Christian Schmidt
;strategy d-clear + 7pt imps
;strategy multi-process bootstrapping
;strategy boot away the clear AND the imps
;strategy table-based imp-launcher
;strategy For JM's Tri-Athelon Round
;assert 1

org pGo

impoff  equ    100
impsize equ    1143
cBoot   equ    2390
iBoot   equ    459

        spl    1
        spl    1
        spl    2
        jmp    imp,       }1
        mov.a  i-iBoot-9, -1
        djn.f  cBoot-iBoot,<-400
        dat    0,         0
imp     mov.i  #impsize,  *0
        dat    0,         0
        dat    0,         0
iEnd    dat    0,         0

ptr     dat    0,         1800
clrb    dat    >2667,     25

clear   spl    #0,        >ptr-15
loop    mov    clrb-15,   >ptr-15
cc      djn.f  loop,      >ptr-15
        dat    0,         0
        dat    0,         0
cEnd    dat    0,         0

pGo     mov.i  clrb,      cEnd+cBoot-18-3
        mov.i  ptr,       cEnd+cBoot-19-3
        spl    2,         }-345
        spl    1,         }-567
        mov    -1,        0
        mov.i  {cEnd,     {cBoo
        mov.i  {iEnd,     {iBoo
        mov.i  {iEnd,     {iBoo
cBoo    spl    cEnd+cBoot
        spl    1
iBoo    jmp    cEnd+iBoot


    for 30
        dat    0,         0
    rof

i       dat    4+impsize, 0

x   for 39
        dat    4+(impsize*(x+1)),0
    rof

end

