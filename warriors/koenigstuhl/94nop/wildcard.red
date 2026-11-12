;redcode-94
;name Wild Card
;author M R Bremer
;strategy .66 scanner
;strategy spiral stun
;assert CORESIZE==8000

dist EQU 66
spread EQU dist*2     

org boot+1

BOOTPTR EQU 4000

stun    spl #spread, spread
top     add stun, scan
scan    cmp dist+top, top
        slt.ab #20, scan
        djn.f top, <5100
        mov jump, @scan
        mov stun, <scan
        mov stun, <scan
        sub.f half, scan
test    jmn.b scan, top
        add.a #382, clear
        mov @-1, {clear
jump    jmp -2, 0
half    dat <0-dist,<0-dist-2
clear   spl #2, #3

for 68
        dat last+10, last+11
rof

boot    dat BOOTPTR, 12
        mov stun, }boot
        mov stun+1, }boot 
        mov stun+2, }boot
        mov stun+3, }boot
        mov stun+4, }boot
        mov stun+5, }boot
        mov stun+6, }boot
        mov stun+7, }boot
        mov stun+8, }boot
        mov stun+9, }boot
        mov stun+10, }boot
        mov stun+11, }boot
        mov stun+12, }boot
        mov stun+13, }boot
        mov stun+14, }boot
last    jmp BOOTPTR-15

