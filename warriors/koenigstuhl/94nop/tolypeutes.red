;redcode-94nop quiet 
;name Tolypeutes
;author Roy van Rijn 
;strategy submitted on 22/02/2022 🎂 
;strategy stone/imp 
;strategy uses new qscan with 34 scan locations in 27 lines 
;strategy all scan locations spaced >100 apart 
;strategy based on Armadillo 
;assert 1 

base z for 0 
rof 

qb1 equ 7165 
qb2 equ 1749 
qb3 equ 2719 
qa1 equ 4489 
qa2 equ 5294 
qc1 equ 3618 
qgap equ 5609 
qz equ 5714 

; qscan positions (sorted): 
; 105, 261, 366, 545, 1147, 1252, 1681, 1786, 1916, 2041, 2146, 
; 2419, 2534, 2652, 2979, 3538, 3967, 4072, 4432, 4705, 4810, 
; 4925, 5239, 5370, 5714, 5975, 6154, 6358, 6861, 7096, 7395, 
; 7525, 7630, 7755 
; all gaps are between 105 and 602 

qgo 
sne.i qptr + 1252 , qptr+6861 
seq.i <tab , qptr+1147 
jmp dec , }dec ;tab*qz 
sne.i qptr+2146 , qptr+7755 
seq.i <(tab2-1) , qptr+2041 
djn.a dec , {dec ;(tab2-1)*qz 
sne.i qptr+1916 , qptr+7525 
seq.i >(tab2) , qptr+7630 
jmp dec , {dec ;tab2*qz 
sne.i qptr+4810 , qptr+2419 
seq.i <(qbomb-1) , qptr+4705 
jmp dec , {qptr ; (qbomb-1)*qz 
sne.i qptr+366 , qptr+5975 
seq.i <(qbomb+1) , qptr+261 
jmp dec , }qptr ; (qbomb+1)*qz 
sne.i qptr+1786 , qptr+7395 
seq.i <(qbomb) , qptr+4072 
tab jmp *-6 , qc1 ; also used as qstep 
sne.i qptr+6358 , qptr+3967 
seq.i >qptr , qptr+105 
jmp dec,<qbomb 
seq.i qptr+5370 , qptr+2979 
jmp dec , }qptr 
seq.i qptr+545 , qptr+6154 
djn.b dec,{qptr 
seq.i qptr+4925 , qptr+2534 
jmp dec ,{dec 

sOff equ (7116+base) 
iOff equ (6886+base) 

wGo mov.i imp , iOff + iAway - 3 
spl iBoot , }qb1 
qbomb spl 1 , }qb2 
spl 1 , }qb3 
mov.i <sPtr , {sPtr 
mov.i <sPtr , {sPtr 
sPtr jmp sOff + 1 , sBomb + 1 

for 6 
dat 0 , 0 
rof 

dat }qoff , qa1 
tab2 dat }qoff , qa2 

for 4 
dat 0 , 0 
rof 

iBoot mov.i imp - 1 , {iPtr 
mov.i {iBoot , {iPtr 
mov.i {iBoot , {iPtr 
mov.i {iBoot , {iPtr 
iPtr jmp iOff - 1 

for 4 
dat 0 , 0 
rof 

sStep equ 2090 
sHop equ 46 

sGate equ sInc-6 

sInc spl #sStep , <-sStep 
mov.i {sStep , <(sLoop-sStep-sHop) 
mov.i sBomb , @-1 
add.f sInc , -2 
sLoop djn.f @-1 , *-3 
mov.i sBomb , >sGate 
djn.f -1 , >sGate 
sBomb dat <1 , sHop + 1 

for 4 
dat 0 , 0 
rof 

iGap equ 7377 
iAway equ 2216 

spl #imp + iGap , {-2667-1 
sub.x -1 , 2 
mov.i iAway , }-2 
djn.f imp + iGap - 5336 , <2768 
imp mov.i #1 , 2667 

for 20 
dat 0 , 0 
rof 

qoff equ -87 
qstep equ -7 
qtime equ 19 
zero equ qgo-1 

dec mul.b *qptr , qptr 
sne.i zero , @qptr 
add.ab #qgap , qptr 
mov.i tab2 , @1 
qptr mov.i >qbomb , }qz 
sub.ab tab , qptr 
djn -3 , #qtime 
jmp wGo 

end qgo 

