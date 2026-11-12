;redcode-rf23
;name e4
;author Nenad Tomasev
;assert 1

dc equ 21556
pbdist equ 19000
ps equ 21475
ps2 equ 8537

 org pGo
g dat 0, 0
 for 15
 dat 0, 0
 rof
gate1 mov.i bomb1, >g
 jmp gate1, <g
bomb1 dat >1, }1
 for 10
 dat 0, 0
 rof
gate2 mov.i bomb2, >g
 jmp gate2, <g
bomb2 dat >1, }1
 for 10
 dat 0, 0
 rof
gate3 mov.i bomb3, >g
 jmp gate3, <g
bomb3 dat >1, }1


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
pTable jmp.a @0, ccboot
 dat.f 0, poc
 for 190    ; was 440 [CCB]
 dat 0, 0
 rof

gate equ clp-6
clcount equ 140000
ch1 equ -450
ch2 equ -500
off equ 6370
len equ 16

clp mov.ab #-off, gate
 mov *jb, >gate
 mov *jb, >gate
 sne.i ch1, ch2
l djn.b clp+1, #clcount
 jmz.b fix, l
copy0 mov {where, <where
cloop djn.b copy0, #len
 spl @where, 0
 mov.ab #len, (cloop+off)
 add.f more, where+off
where dat db+1, (db+1+off)
more dat 5, 4
fix jmp <l, }jb
jb jmp #0, (db-gate+15)
db dat {1, (db-gate+15)

bst equ 23500
length equ (kraj-ccboot+1)

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
 mov clrboot+11, clrboot+bst+11
 mov clrboot+12, clrboot+bst+12
 mov clrboot+13, clrboot+bst+13
 mov clrboot+14, clrboot+bst+14
 mov clrboot+15, clrboot+bst+15
 mov clrboot+16, clrboot+bst+16
 mov clrboot+17, clrboot+bst+17
 add.ab #1, ch+bst
 mod.ab #4, ch+bst
check add.ab #1, #0
 mod.ab #2, check
 jmz.b copy, check
 djn.b raskr, #20
 jmp clrboot+bst, 0
raskr spl clrboot+bst, 0
copy mov {kraj, <kraj
loop djn.b -1, #length
 mov.ab #length, loop+bst
 mov.i kraj1, kraj+bst
 jmp ccboot+bst, 0
kraj1 dat 1, bst+1
kraj dat 1, bst+1
 for 20
 dat 0, 0
 rof
clrboot mov clp-bst, clp+bst
 mov clp+1-bst, clp+bst+1
 mov clp+2-bst, clp+bst+2
 mov clp+3-bst, clp+bst+3
 mov clp+4-bst, clp+bst+4
 mov clp+5-bst, clp+bst+5
 mov clp+6-bst, clp+bst+6
 mov clp+7-bst, clp+bst+7
 mov clp+8-bst, clp+bst+8
 mov clp+9-bst, clp+bst+9
 mov clp+10-bst, clp+bst+10
 mov clp+11-bst, clp+bst+11
 mov clp+12-bst, clp+bst+12
 mov clp+13-bst, clp+bst+13
 mov clp+14-bst, clp+bst+14
 mov clp+15-bst, clp+bst+15
 sne.ab #0, 1
ch jmp clp+bst, #-1
 for 150              ; was 400 [CCB]
 dat 0, 0
 rof
poc mov imp, imp+1000
 spl @poc, {-2654
 mov imp, imp+24000
 spl @-1, {-3654
 spl 1, {-4654
 spl gate1, }0
 spl gate2, }0
 jmp gate3, }0
imp mov.i #1, 1
 end
