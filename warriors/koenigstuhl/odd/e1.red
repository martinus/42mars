;redcode-rf23
;name e1
;author Nenad Tomasev
;assert 1

spstep equ 21574
bstep equ 6567
length equ 16
count equ 1000


 org pGo
silver mov.i <go, {go
 djn.b silver, #length
 mov.ab #length, silver+1+spstep
 mov.ab #length, silver+1
 mov.ab #bstep, dwarf+spstep
 mov.ab #count, dwarf+2+spstep
 add.f gomore, go+spstep
go spl bomb+1+spstep, bomb+1
 mov.ab #count, dwarf+2
 add.f bomb, go
dwarf add.ab #bstep, #bstep
 mov.i bomb, @dwarf
 djn.b dwarf, #count
back jmp silver, >563
gomore dat 8, 9
bomb dat >length, }length

pResult equ 0 ; pMARS puts results in here
pNum equ 2
pSpace1 equ 1127 ; used to store the current strategy
pSpace2 equ 889 ; used to store the loss counter
pLosses equ 2 ; how many losses before we switch
;************************************

;****************Brain*************
pGo ldp.ab #pResult,#0
ldp.a #pSpace1,pTable
pJump jmn.b pWin,pGo
pLoss ldp.ab #pSpace2,#0
 nop.f >pLoss,}-1000
 mod.ab #pLosses,pLoss
pThink jmn.b pWin,pLoss
 nop.f }pTable,}-2000
 stp.ab pTable,#pSpace1
pWin stp.b pLoss,#pSpace2
 mod.a #pNum,pTable
pTable jmp.a @0, silver
 dat.f 0, ccboot

bst equ 23500
length2 equ (kraj-ccboot+1)

ccboot mov clrboot, clrboot+bst
 mov clrboot+1, clrboot+bst+1
 mov clrboot+2, clrboot+bst+2
 mov clrboot+3, clrboot+bst+3
 mov clrboot+4, clrboot+bst+4
 mov clrboot+5, clrboot+bst+5
 mov clrboot+6, clrboot+bst+6
 mov clrboot+7, clrboot+bst+7
 mov clrboot+8, clrboot+bst+8
 mov clrboot+9, clrboot+bst+9
 mov clrboot+10, clrboot+bst+10
check add.ab #1, #0
 mod.ab #2, check
 jmz.b copy, check
 djn.b raskr, #10
 jmp clrboot+bst, 0
raskr spl clrboot+bst, 0
copy mov {kraj, <kraj
loop djn.b -1, #length2
 mov.ab #length2, loop+bst
 mov.i kraj1, kraj+bst
 jmp ccboot+bst, 0
kraj1 dat 1, bst+1
kraj dat 1, bst+1
 for 20
 dat 0, 0
 rof
clrboot mov gate-bst, gate+bst
 mov jm-bst, jm+bst
 mov jm-bst-1, jm+bst-1
 mov clr-bst, clr+bst
 mov clr+1-bst, clr+bst+1
 mov clr+2-bst, clr+bst+2
 mov clr+3-bst, clr+bst+3
 mov clr+4-bst, clr+bst+4
 mov clr+5-bst, clr+bst+5
 mov clr+6-bst, clr+bst+6
 jmp clr+bst+1, 0
 for 350                    ; was 850 [CCB]
 dat 0, 0
 rof
gate dat 0, 13
 dat 0, 0
 dat 0, 0
 dat 0, 14
jm jmp #-20, 13
clr mov.i jm, >gate
 mov.i jm, >gate
 mov.i jm, >gate
 mov.i jm, >gate
 djn.a clr+1, {jm
 jmp clr+1, 0
 end
