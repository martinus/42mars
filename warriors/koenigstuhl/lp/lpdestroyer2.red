;redcode-lp
;name The LP Destroyer II
;author Christian Schmidt
;strategy p-switching LP paper and dwarf
;assert 1

;----Replinator------- 7

l       equ     21;25
zofs    equ     6667;1971

bo1     equ     548;2638
bo2     equ     109;2649
color   equ     7293;4001

from    mov     #l,     #0
ploop   mov     {bo1,   {bo2
        add     {0,     }0
        mov     <from,  {to
        jmn     ploop,  from
        spl     >from,  }color
to      jmz     zofs,   *0

for 29
 dat 0,0
rof

;----p-brain----------- 13

switch ldp.ba what, what
       mod.a #3, what
       ldp.ab #0, switch
       add.a @switch, what
       stp.ab *what, what
what   jmp @0, from
       dat 1, from
       dat 0, from
       dat 1, from
       dat 1, from
       dat 2, dwarf
       dat 0, from
       dat 1, from

for 20
 dat 0,0
rof

; ***** DWARF *****

dstep equ 81
dhop equ 5277
dtime equ 1677
dbmb equ (dend+4)

dwarf mov   dend, @dptr
 mov {dwarf, <dptr
 mov {dwarf, <dptr
dptr mov   datb, *5421
 mov {dwarf, <dptr
 mov {dwarf, <dptr
djmp djn.f @ dptr,  dptr

 dat 0, 0

 spl #0, <dhop+2 ; combines with datb to form a gate
dloop mov dbmb, {(dstep*dtime)+1
 mov dbmb, @dloop ; hit by datb to start clear
 sub #dstep, dloop
dend djn.f dloop, <dhop-2
; DAT 0, 0
; DAT 0, 0
; DAT 0, 0
datb dat <dhop+1,>1

end switch

