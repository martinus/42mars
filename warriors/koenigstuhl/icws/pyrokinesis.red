;redcode-icws
;name Pyrokinesis
;author G.Labarga
;assert CORESIZE==8192
;strategy s/p/i

;----- stone
step equ ( 4279 *4)
d2 equ -(1*step)
;----- paper/imp
pdest equ (881*4)
istep equ 3277
;---boot
sloc equ (boot+1672)
ploc equ (boot+1265)

boot: mov <ssrc,<sdst
spl 2
spl 1
psrc: spl 1,pi+6
mov <ssrc,<sdst
sdst: spl @0,sloc
mov <psrc,<pdst
pdst: jmp @0,ploc

pi: mov <imp+1,<1
spl @0,pdest
pump: spl 0
add #istep,igo
igo: jmp @0,imp-(6*istep)
imp: mov 0,istep

ssrc:
sto: spl 0,7
spl 0,<2-step
ref: mov bmb,<d2
mov bmb,@ref
sub #(2*step),@-1
jmp @-2 ;jmp scores better than djn
bmb: dat <1-step,<1-step

qs equ 322 
qd equ 161 

qscan cmp 2*qs+qd , 2*qs 
qt1 jmp qa0 , <3*qs 
cmp qscan+5*qs+qd , qscan+5*qs 
qt2 jmp qa1 , <4*qs 
cmp qscan+4*qs+qd , qscan+4*qs 
qs1 djn qa1 , #qt1 
cmp qscan+10*qs-2 , qscan+10*qs+qd-2
qs2 djn qa2 , #qt2 
cmp qscan+9*qs+qd , qscan+9*qs 
qt3 jmp qa2 , <6*qs 
cmp qscan+6*qs+qd , qscan+6*qs 
jmp qa2 , <qa1 
cmp qscan+8*qs+qd , qscan+8*qs 
jmp qa2 , <qs1 
cmp qscan+11*qs , qscan+11*qs+qd 
jmp qa3 , <qa2 
cmp qscan+18*qs-8 , qscan+18*qs+qd-8
qs3 djn qa3 , #qt3 
cmp qscan+16*qs-2 , qscan+16*qs+qd-2 
jmp qa3 , <qs2 
cmp qscan+12*qs , qscan+12*qs+qd 
jmp qa3 , <qa1 
cmp qscan+14*qs , qscan+14*qs+qd 
jmp qa3 , <qs1 
jmz boot , qscan+15*qs 

qa3 add @qs3 , qp 
qa2 add @qs2 , @qa3 
qa1 add @qs1 , @qa3 
qa0 cmp @qp , <1234 
cmp @0 , 0 
add #qd , qp 
ql mov qb , @qp 
qp mov <2345 , <qscan+2*qs 
add #9 , @ql ;slight changes
djn ql , #6
jmp boot , <43 
qb: dat <1,<-63
end qscan
