;redcode-94irc
;name Digitalissimo
;author Christian Schmidt
;strategy d-clear + 17pt imps
;assert 1

org pGo

impsize equ     1223;1777
cBoot   equ     1754
iBoot   equ     1806
cStart  equ     849

        spl     1
qTab2   spl     1
        spl     2
        djn.f   imp,            <3227
        add.f   iDec,           -1
        djn.f   cBoot-iBoot,    <400
iDec    nop     #impsize,       #6928
imp     mov.i   #1,             impsize
        dat     0,              0
        dat     0,              0
iEnd    dat     0,              0

ptr     dat     0,              cStart
clrb    dat     >1777,          25

clear   spl     #0,             >ptr-15
loop    mov     clrb-15,        >ptr-15
cc      djn.f   loop,           >ptr-15
        dat     0,              0
        dat     0,              0
cEnd    dat     0,              0

pGo     mov.i   clrb,           cEnd+cBoot-18-3
        mov.i   ptr,            cEnd+cBoot-19-3
        spl     2,              }-345
        spl     1,              }-567
        mov     -1,             0
        mov.i   {cEnd,          {cBoo
        mov.i   {iEnd,          {iBoo
        mov.i   {iEnd,          {iBoo
cBoo    spl     cEnd+cBoot
        spl     1
iBoo    jmp     cEnd+iBoot

        end
